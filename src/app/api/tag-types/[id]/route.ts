import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/utils/auth'

// PUT - 更新标签组
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
    const { name, slug, color } = body

    if (!name || !slug) {
      return NextResponse.json(
        { error: '名称和标识符必填' },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()

    const { data, error } = await supabase
      .from('tag_types')
      .update({ name, slug, color })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: '名称或标识符已存在' },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tagType: data })
  } catch (error) {
    console.error('Update tag type error:', error)
    return NextResponse.json({ error: '更新标签组失败' }, { status: 500 })
  }
}

// DELETE - 删除标签组
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

    // Check if there are tags using this type
    const { count } = await supabase
      .from('tags')
      .select('*', { count: 'exact', head: true })
      .eq('type_id', id)

    if (count && count > 0) {
      return NextResponse.json(
        { error: `该标签组下有 ${count} 个标签，请先删除或转移这些标签` },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('tag_types')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete tag type error:', error)
    return NextResponse.json({ error: '删除标签组失败' }, { status: 500 })
  }
}
