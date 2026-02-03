import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/utils/auth'
import { deleteFromR2, getKeyFromUrl } from '@/lib/r2/client'

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

    // 单独获取 prompt_images
    const { data: images } = await supabase
      .from('prompt_images')
      .select('id, image_url, thumbnail_url, sort_order')
      .eq('prompt_id', id)
      .order('sort_order', { ascending: true })

    // Transform to flatten tags and add images
    const prompt = {
      ...data,
      tags: data.prompt_tags?.map((pt: { tags: unknown }) => pt.tags) || [],
      images: images || [],
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
      images,
      author_name,
      author_wechat,
      source,
      model,
      is_featured,
      is_published,
      tag_ids,
    } = body

    if (!title || !prompt_text) {
      return NextResponse.json(
        { error: '标题和提示词必填' },
        { status: 400 }
      )
    }

    // Check if images array is provided, else fallback to single image
    const imageList = images?.length > 0 ? images : image_url ? [{ image_url, thumbnail_url }] : []

    if (imageList.length === 0) {
      return NextResponse.json(
        { error: '请上传至少一张图片' },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()

    // 获取旧图片信息以便清理 R2
    const { data: oldImages } = await supabase
      .from('prompt_images')
      .select('image_url, thumbnail_url')
      .eq('prompt_id', id)

    // Use first image as cover
    const coverImage = imageList[0]

    // Update prompt
    const { data: prompt, error: promptError } = await supabase
      .from('prompts')
      .update({
        title,
        description,
        prompt_text,
        negative_prompt,
        image_url: coverImage.image_url,
        thumbnail_url: coverImage.thumbnail_url,
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

    // Update images - delete all and re-insert
    await supabase.from('prompt_images').delete().eq('prompt_id', id)

    if (imageList.length > 0) {
      const imageRecords = imageList.map(
        (img: { image_url: string; thumbnail_url?: string }, index: number) => ({
          prompt_id: id,
          image_url: img.image_url,
          thumbnail_url: img.thumbnail_url,
          sort_order: index,
        })
      )

      await supabase.from('prompt_images').insert(imageRecords)
    }

    // 清理 R2 中不再使用的图片
    if (oldImages && oldImages.length > 0) {
      const newUrls = new Set(imageList.map((img: any) => img.image_url))
      const newThumbUrls = new Set(imageList.map((img: any) => img.thumbnail_url).filter(Boolean))

      for (const oldImg of oldImages) {
        // 如果旧图片不在新列表中，则删除
        if (oldImg.image_url && !newUrls.has(oldImg.image_url)) {
          const key = getKeyFromUrl(oldImg.image_url)
          if (key) {
            try {
              await deleteFromR2(key)
            } catch (err) {
              console.error(`Failed to delete old image from R2: ${oldImg.image_url}`, err)
            }
          }
        }
        // 如果旧缩略图不在新列表中，则删除
        if (oldImg.thumbnail_url && !newThumbUrls.has(oldImg.thumbnail_url)) {
          const key = getKeyFromUrl(oldImg.thumbnail_url)
          if (key) {
            try {
              await deleteFromR2(key)
            } catch (err) {
              console.error(`Failed to delete old thumbnail from R2: ${oldImg.thumbnail_url}`, err)
            }
          }
        }
      }
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

    // 获取图片信息以便删除 R2 文件
    const { data: images } = await supabase
      .from('prompt_images')
      .select('image_url, thumbnail_url')
      .eq('prompt_id', id)

    // prompt_images will be deleted automatically via ON DELETE CASCADE
    const { error } = await supabase.from('prompts').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 删除 R2 中的图片文件
    if (images && images.length > 0) {
      for (const img of images) {
        // 删除原图
        if (img.image_url) {
          const key = getKeyFromUrl(img.image_url)
          if (key) {
            try {
              await deleteFromR2(key)
            } catch (err) {
              console.error(`Failed to delete image from R2: ${img.image_url}`, err)
            }
          }
        }
        // 删除缩略图
        if (img.thumbnail_url) {
          const key = getKeyFromUrl(img.thumbnail_url)
          if (key) {
            try {
              await deleteFromR2(key)
            } catch (err) {
              console.error(`Failed to delete thumbnail from R2: ${img.thumbnail_url}`, err)
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete prompt error:', error)
    return NextResponse.json({ error: '删除提示词失败' }, { status: 500 })
  }
}
