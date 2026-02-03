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
  creator_id?: string  // 可选的创作者ID，用于记录失败信息
}

// 从 URL 下载图片（支持代理，失败时自动回退直连）
async function downloadImage(url: string): Promise<Buffer> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000) // 30秒超时
  
  try {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY
    
    // 优先尝试使用代理
    if (proxyUrl) {
      try {
        const { HttpsProxyAgent } = await import('https-proxy-agent')
        const nodeFetch = (await import('node-fetch')).default
        const agent = new HttpsProxyAgent(proxyUrl)
        
        const res = await nodeFetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          signal: controller.signal,
          agent,
        })
        
        if (!res.ok) {
          throw new Error(`Failed to download image: ${res.status}`)
        }

        const contentType = res.headers.get('content-type')
        if (!contentType?.startsWith('image/')) {
          throw new Error(`Invalid content type: ${contentType}`)
        }

        const arrayBuffer = await res.arrayBuffer()
        return Buffer.from(arrayBuffer)
      } catch (proxyError) {
        console.warn(`Proxy failed, falling back to direct connection: ${proxyError}`)
        // 代理失败，继续使用直连
      }
    }
    
    // 直连请求
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
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
  } finally {
    clearTimeout(timeoutId)
  }
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

// 检查 prompt 是否已存在（通过 prompt_text 去重）
async function isPromptExists(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  promptText: string
): Promise<boolean> {
  const { data } = await supabase
    .from('prompts')
    .select('id')
    .eq('prompt_text', promptText.trim())
    .limit(1)
    .single()

  return !!data
}

// 检查是否已存在相同的来源URL（通过 description 字段中的来源链接去重）
async function isSourceUrlExists(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  sourceUrl: string
): Promise<boolean> {
  const { data } = await supabase
    .from('prompts')
    .select('id')
    .like('description', `%${sourceUrl}%`)
    .limit(1)
    .single()

  return !!data
}

// 检查失败记录是否已存在于备注中
function isFailedRecordExists(description: string | null, tweetUrl: string): boolean {
  if (!description) return false
  return description.includes(tweetUrl)
}

// 记录失败的图片到创作者备注（去重）
async function appendToCreatorDescription(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  authorName: string,
  tweetUrl: string
) {
  // 通过 author_name (username) 查找创作者
  const { data: creator } = await supabase
    .from('twitter_creators')
    .select('id, description')
    .eq('username', authorName)
    .single()

  if (!creator) return

  const currentDesc = creator.description || ''
  
  // 检查是否已记录过该推文的失败
  if (isFailedRecordExists(currentDesc, tweetUrl)) {
    return // 已存在则不重复记录
  }
  
  const timestamp = new Date().toISOString().split('T')[0]
  const newEntry = `[${timestamp}] 图片处理失败: ${tweetUrl}`
  
  // 追加到描述中
  const updatedDesc = currentDesc 
    ? `${currentDesc}\n${newEntry}`
    : newEntry

  await supabase
    .from('twitter_creators')
    .update({ description: updatedDesc })
    .eq('id', creator.id)
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

    const supabase = await createAdminClient()

    // 检查 prompt 是否已存在（去重）
    if (await isPromptExists(supabase, prompt_text)) {
      return NextResponse.json({
        success: false,
        skipped: true,
        reason: 'duplicate',
        message: 'Prompt with same text already exists',
      }, { status: 200 })
    }

    // 提取推文 URL（从 description 中）
    const tweetUrl = description?.replace('来源: ', '') || ''

    // 检查是否已存在相同的来源URL（通过 description 去重）
    if (tweetUrl && await isSourceUrlExists(supabase, tweetUrl)) {
      return NextResponse.json({
        success: false,
        skipped: true,
        reason: 'duplicate_source',
        message: 'Prompt with same source URL already exists',
      }, { status: 200 })
    }

    // 如果是 twitter 来源，检查该推文是否已记录为失败
    if (source === 'twitter' && author_name && tweetUrl) {
      const { data: creator } = await supabase
        .from('twitter_creators')
        .select('description')
        .eq('username', author_name)
        .single()
      
      if (creator && isFailedRecordExists(creator.description, tweetUrl)) {
        return NextResponse.json({
          success: false,
          skipped: true,
          reason: 'previously_failed',
          message: 'This tweet was previously recorded as failed',
        }, { status: 200 })
      }
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

    // 如果所有图片都失败，记录到创作者备注并返回
    if (processedImages.length === 0) {
      // 记录到创作者描述（如果是 twitter 来源）
      if (source === 'twitter' && author_name && tweetUrl) {
        await appendToCreatorDescription(supabase, author_name, tweetUrl)
      }

      return NextResponse.json({
        success: false,
        error: 'All images failed to process',
        failed_urls: failedUrls,
        recorded: !!(source === 'twitter' && author_name),
      }, { status: 400 })
    }

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