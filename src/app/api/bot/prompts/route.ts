import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyBotApiKey } from '@/lib/utils/auth'
import { processImage } from '@/lib/utils/image'
import { uploadToR2 } from '@/lib/r2/client'
import type { PromptSource } from '@/types/database'

interface BotPromptRequest {
  title: string
  description?: string
  prompt_text: string
  negative_prompt?: string
  image_urls: string[]  // 图片 URL 数组，第一张作为封面
  author_name?: string
  source?: PromptSource
  model?: string
  is_featured?: boolean
  is_published?: boolean
  tag_ids?: string[]
}

// 从 URL 下载图片
async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; VibeshotBot/1.0)',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`)
  }

  const contentType = response.headers.get('content-type')
  if (!contentType?.startsWith('image/')) {
    throw new Error(`Invalid content type: ${contentType}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// 处理并上传单张图片
async function processAndUploadImage(imageUrl: string): Promise<{
  image_url: string
  thumbnail_url: string
}> {
  const buffer = await downloadImage(imageUrl)
  const id = randomUUID()
  const ext = 'png'

  const { main, thumbnail } = await processImage(buffer)

  const uploadedImageUrl = await uploadToR2(`images/${id}.${ext}`, main, 'image/png')
  const uploadedThumbnailUrl = await uploadToR2(`thumbnails/${id}.${ext}`, thumbnail, 'image/png')

  return {
    image_url: uploadedImageUrl,
    thumbnail_url: uploadedThumbnailUrl,
  }
}

// POST - 机器人创建提示词
export async function POST(request: NextRequest) {
  try {
    // 验证 API Key
    const apiKey = request.headers.get('x-api-key')
    if (!verifyBotApiKey(apiKey)) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    const body: BotPromptRequest = await request.json()
    const {
      title,
      description,
      prompt_text,
      negative_prompt,
      image_urls,
      author_name,
      source = 'wechat',
      model,
      is_featured = false,
      is_published = true,
      tag_ids,
    } = body

    // 验证必填字段
    if (!title?.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    if (!prompt_text?.trim()) {
      return NextResponse.json({ error: 'prompt_text is required' }, { status: 400 })
    }

    if (!image_urls?.length) {
      return NextResponse.json({ error: 'image_urls is required (at least one)' }, { status: 400 })
    }

    // 下载并处理所有图片
    const processedImages: Array<{ image_url: string; thumbnail_url: string }> = []
    const failedUrls: string[] = []

    for (const url of image_urls) {
      try {
        const processed = await processAndUploadImage(url)
        processedImages.push(processed)
      } catch (error) {
        console.error(`Failed to process image ${url}:`, error)
        failedUrls.push(url)
      }
    }

    if (processedImages.length === 0) {
      return NextResponse.json({
        error: 'All images failed to process',
        failed_urls: failedUrls,
      }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // 获取最大 sort_order
    const { data: maxSort } = await supabase
      .from('prompts')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const sort_order = (maxSort?.sort_order || 0) + 1

    // 第一张图作为封面
    const coverImage = processedImages[0]

    // 创建提示词
    const { data: prompt, error: promptError } = await supabase
      .from('prompts')
      .insert({
        title: title.trim(),
        description: description?.trim(),
        prompt_text: prompt_text.trim(),
        negative_prompt: negative_prompt?.trim(),
        image_url: coverImage.image_url,
        thumbnail_url: coverImage.thumbnail_url,
        author_name: author_name?.trim(),
        source,
        model: model?.trim(),
        is_featured,
        is_published,
        sort_order,
      })
      .select()
      .single()

    if (promptError) {
      return NextResponse.json({ error: promptError.message }, { status: 500 })
    }

    // 插入标签关联
    if (tag_ids?.length) {
      const tagLinks = tag_ids.map((tagId: string) => ({
        prompt_id: prompt.id,
        tag_id: tagId,
      }))
      await supabase.from('prompt_tags').insert(tagLinks)
    }

    // 插入图片记录
    const imageRecords = processedImages.map((img, index) => ({
      prompt_id: prompt.id,
      image_url: img.image_url,
      thumbnail_url: img.thumbnail_url,
      sort_order: index,
    }))
    await supabase.from('prompt_images').insert(imageRecords)

    return NextResponse.json({
      success: true,
      prompt: {
        id: prompt.id,
        title: prompt.title,
        created_at: prompt.created_at,
      },
      images_count: processedImages.length,
      failed_urls: failedUrls.length > 0 ? failedUrls : undefined,
    }, { status: 201 })

  } catch (error) {
    console.error('Bot create prompt error:', error)
    return NextResponse.json({
      error: 'Failed to create prompt',
      detail: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
