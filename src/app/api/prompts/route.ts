import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/utils/auth'

// GET - 获取提示词列表
export async function GET(request: NextRequest) {
  try {
    const supabase = await createAdminClient()
    const { searchParams } = new URL(request.url)

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search')
    const tagId = searchParams.get('tag')
    const featured = searchParams.get('featured')
    const published = searchParams.get('published')

    // Build query - 先尝试包含 prompt_images
    let query = supabase
      .from('prompts')
      .select(
        `
        *,
        prompt_tags (
          tag_id,
          tags (id, name, type, color)
        )
      `,
        { count: 'exact' }
      )
      .order('is_featured', { ascending: false })
      .order('sort_order', { ascending: false })
      .order('created_at', { ascending: false })

    // Filters
    if (search) {
      query = query.or(
        `title.ilike.%${search}%,prompt_text.ilike.%${search}%,author_name.ilike.%${search}%`
      )
    }

    if (featured === 'true') {
      query = query.eq('is_featured', true)
    }

    if (published !== undefined) {
      query = query.eq('is_published', published === 'true')
    }

    // Pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error('Supabase query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 单独获取 prompt_images (如果表存在)
    let imagesMap: Record<string, Array<{ id: string; image_url: string; thumbnail_url: string | null; sort_order: number }>> = {}
    if (data && data.length > 0) {
      const promptIds = data.map(p => p.id)
      const { data: images } = await supabase
        .from('prompt_images')
        .select('id, prompt_id, image_url, thumbnail_url, sort_order')
        .in('prompt_id', promptIds)
        .order('sort_order', { ascending: true })

      if (images) {
        images.forEach(img => {
          if (!imagesMap[img.prompt_id]) {
            imagesMap[img.prompt_id] = []
          }
          imagesMap[img.prompt_id].push(img)
        })
      }
    }

    // Transform data to flatten tags and add images
    const prompts = data?.map((prompt) => ({
      ...prompt,
      tags: prompt.prompt_tags?.map((pt: { tags: unknown }) => pt.tags) || [],
      images: imagesMap[prompt.id] || [],
      prompt_tags: undefined,
    }))

    // Filter by tag if needed (post-query filter for many-to-many)
    let filteredPrompts = prompts
    if (tagId) {
      filteredPrompts = prompts?.filter((p) =>
        p.tags.some((t: { id: string }) => t.id === tagId)
      )
    }

    return NextResponse.json({
      prompts: filteredPrompts,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Get prompts error:', error)
    return NextResponse.json({
      error: '获取提示词失败',
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// POST - 创建提示词
export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession()
    if (!isAdmin) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

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

    // Get max sort_order
    const { data: maxSort } = await supabase
      .from('prompts')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const sort_order = (maxSort?.sort_order || 0) + 1

    // Use first image as cover
    const coverImage = imageList[0]

    // Create prompt
    const { data: prompt, error: promptError } = await supabase
      .from('prompts')
      .insert({
        title,
        description,
        prompt_text,
        negative_prompt,
        image_url: coverImage.image_url,
        thumbnail_url: coverImage.thumbnail_url,
        author_name,
        author_wechat,
        source: source || 'manual',
        model,
        is_featured: is_featured || false,
        is_published: is_published ?? true,
        sort_order,
      })
      .select()
      .single()

    if (promptError) {
      return NextResponse.json({ error: promptError.message }, { status: 500 })
    }

    // Insert tags if provided
    if (tag_ids?.length > 0) {
      const tagLinks = tag_ids.map((tagId: string) => ({
        prompt_id: prompt.id,
        tag_id: tagId,
      }))

      await supabase.from('prompt_tags').insert(tagLinks)
    }

    // Insert images to prompt_images table
    if (imageList.length > 0) {
      const imageRecords = imageList.map(
        (img: { image_url: string; thumbnail_url?: string }, index: number) => ({
          prompt_id: prompt.id,
          image_url: img.image_url,
          thumbnail_url: img.thumbnail_url,
          sort_order: index,
        })
      )

      await supabase.from('prompt_images').insert(imageRecords)
    }

    return NextResponse.json({ prompt }, { status: 201 })
  } catch (error) {
    console.error('Create prompt error:', error)
    return NextResponse.json({ error: '创建提示词失败' }, { status: 500 })
  }
}
