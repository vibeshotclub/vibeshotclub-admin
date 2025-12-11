import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/utils/auth'

// GET - 获取单个提示词
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createAdminClient()

    const { data, error } = await supabase
      .from('prompts')
      .select(
        `
        *,
        prompt_tags (
          tag_id,
          tags (id, name, type, color)
        )
      `
      )
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '提示词不存在' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform to flatten tags
    const prompt = {
      ...data,
      tags: data.prompt_tags?.map((pt: { tags: unknown }) => pt.tags) || [],
      prompt_tags: undefined,
    }

    return NextResponse.json({ prompt })
  } catch (error) {
    console.error('Get prompt error:', error)
    return NextResponse.json({ error: '获取提示词失败' }, { status: 500 })
  }
}

// PUT - 更新提示词
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await verifyAdminSession()
    if (!isAdmin) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const {
      title,
      description,
      prompt_text,
      negative_prompt,
      image_url,
      thumbnail_url,
      author_name,
      author_wechat,
      source,
      model,
      is_featured,
      is_published,
      tag_ids,
    } = body

    if (!title || !prompt_text || !image_url) {
      return NextResponse.json(
        { error: '标题、提示词和图片必填' },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()

    // Update prompt
    const { data: prompt, error: promptError } = await supabase
      .from('prompts')
      .update({
        title,
        description,
        prompt_text,
        negative_prompt,
        image_url,
        thumbnail_url,
        author_name,
        author_wechat,
        source,
        model,
        is_featured,
        is_published,
      })
      .eq('id', id)
      .select()
      .single()

    if (promptError) {
      return NextResponse.json({ error: promptError.message }, { status: 500 })
    }

    // Update tags - delete all and re-insert
    await supabase.from('prompt_tags').delete().eq('prompt_id', id)

    if (tag_ids?.length > 0) {
      const tagLinks = tag_ids.map((tagId: string) => ({
        prompt_id: id,
        tag_id: tagId,
      }))

      await supabase.from('prompt_tags').insert(tagLinks)
    }

    return NextResponse.json({ prompt })
  } catch (error) {
    console.error('Update prompt error:', error)
    return NextResponse.json({ error: '更新提示词失败' }, { status: 500 })
  }
}

// DELETE - 删除提示词
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await verifyAdminSession()
    if (!isAdmin) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createAdminClient()

    const { error } = await supabase.from('prompts').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete prompt error:', error)
    return NextResponse.json({ error: '删除提示词失败' }, { status: 500 })
  }
}
