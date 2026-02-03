import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/utils/auth'
import { processImage } from '@/lib/utils/image'
import { uploadToR2 } from '@/lib/r2/client'

interface TweetData {
  tweet_id: string
  text: string
  created_at: string
  image_urls: string[]
  url: string
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

// 检查失败记录是否已存在于备注中
function isFailedRecordExists(description: string | null, tweetUrl: string): boolean {
  if (!description) return false
  return description.includes(tweetUrl)
}

// 记录失败的图片到创作者备注（去重）
async function appendToCreatorDescription(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  creatorId: string,
  tweetUrl: string
) {
  // 获取当前描述
  const { data: creator } = await supabase
    .from('twitter_creators')
    .select('description')
    .eq('id', creatorId)
    .single()

  const currentDesc = creator?.description || ''
  
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
    .eq('id', creatorId)
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

// POST - 手动抓取创作者推文
export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession()
    if (!isAdmin) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await request.json()
    const { creator_id, username, since_date } = body

    if (!creator_id || !username || !since_date) {
      return NextResponse.json(
        { error: 'creator_id, username, since_date 为必填项' },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()

    // 调用 Twitter API 获取推文
    const rapidApiKey = process.env.RAPIDAPI_KEY
    if (!rapidApiKey) {
      return NextResponse.json(
        { error: '未配置 RAPIDAPI_KEY' },
        { status: 500 }
      )
    }

    const sinceTimestamp = new Date(since_date).getTime()
    const tweets: TweetData[] = []
    let cursor: string | null = null
    const maxPages = 10

    // 分页获取推文
    for (let page = 0; page < maxPages; page++) {
      const params = new URLSearchParams({ screenname: username })
      if (cursor) {
        params.append('cursor', cursor)
      }

      const response = await fetch(
        `https://twitter-api45.p.rapidapi.com/timeline.php?${params}`,
        {
          headers: {
            'x-rapidapi-key': rapidApiKey,
            'x-rapidapi-host': 'twitter-api45.p.rapidapi.com',
          },
        }
      )

      if (!response.ok) {
        console.error('Twitter API error:', response.status)
        break
      }

      const data = await response.json()
      const timeline = data.timeline || []
      const nextCursor = data.next_cursor

      let reachedSinceDate = false

      for (const item of timeline) {
        // 跳过转推
        if (item.retweeted) continue

        const tweetId = item.tweet_id
        if (!tweetId) continue

        // 解析时间
        let createdAt = new Date()
        if (item.created_at) {
          try {
            createdAt = new Date(item.created_at)
          } catch {
            // ignore
          }
        }

        // 检查是否超出日期范围
        if (createdAt.getTime() < sinceTimestamp) {
          reachedSinceDate = true
          break
        }

        // 提取图片 URL
        const imageUrls: string[] = []
        const media = item.media || {}
        const photos = media.photo || []
        for (const photo of photos) {
          const mediaUrl = photo.media_url_https
          if (mediaUrl) {
            imageUrls.push(`${mediaUrl}?format=jpg&name=large`)
          }
        }

        // 只保留有图片的推文
        if (imageUrls.length > 0) {
          tweets.push({
            tweet_id: tweetId,
            text: item.text || '',
            created_at: createdAt.toISOString(),
            image_urls: imageUrls,
            url: `https://twitter.com/${username}/status/${tweetId}`,
          })
        }
      }

      if (reachedSinceDate || !nextCursor) {
        break
      }

      cursor = nextCursor
      // 添加延迟防止限流
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // 统计
    const stats = {
      tweets_found: tweets.length,
      prompts_created: 0,
      duplicates_skipped: 0,
      images_failed: 0,
    }

    // 获取当前创作者备注（用于检查是否已记录失败）
    const { data: creatorData } = await supabase
      .from('twitter_creators')
      .select('description')
      .eq('id', creator_id)
      .single()
    const currentDescription = creatorData?.description || ''

    // 处理每条推文
    for (const tweet of tweets) {
      // 检查是否重复（通过 prompt_text）
      if (await isPromptExists(supabase, tweet.text)) {
        stats.duplicates_skipped++
        continue
      }

      // 检查是否重复（通过来源URL）
      if (await isSourceUrlExists(supabase, tweet.url)) {
        stats.duplicates_skipped++
        continue
      }

      // 检查是否已记录为失败（如果是，跳过）
      if (isFailedRecordExists(currentDescription, tweet.url)) {
        stats.images_failed++
        continue
      }

      // 下载并处理图片
      const processedImages: Array<{ image_url: string; thumbnail_url: string }> = []
      const failedUrls: string[] = []

      for (const url of tweet.image_urls) {
        try {
          const processed = await processAndUploadImage(url)
          processedImages.push(processed)
        } catch (error) {
          console.error(`Failed to process image ${url}:`, error)
          failedUrls.push(url)
        }
      }

      // 如果所有图片都失败，记录到描述并跳过
      if (processedImages.length === 0) {
        stats.images_failed++
        await appendToCreatorDescription(
          supabase,
          creator_id,
          tweet.url
        )
        continue
      }

      // 获取最大 sort_order
      const { data: maxSort } = await supabase
        .from('prompts')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .single()

      const sort_order = (maxSort?.sort_order || 0) + 1

      // 创建提示词
      const coverImage = processedImages[0]
      const { data: prompt, error: promptError } = await supabase
        .from('prompts')
        .insert({
          title: `@${username} 的提示词`,
          description: `来源: ${tweet.url}`,
          prompt_text: tweet.text.trim(),
          image_url: coverImage.image_url,
          thumbnail_url: coverImage.thumbnail_url,
          author_name: username,
          source: 'twitter',
          is_featured: false,
          is_published: true,
          sort_order,
        })
        .select()
        .single()

      if (promptError) {
        console.error('Create prompt error:', promptError)
        continue
      }

      // 插入图片记录
      const imageRecords = processedImages.map((img, index) => ({
        prompt_id: prompt.id,
        image_url: img.image_url,
        thumbnail_url: img.thumbnail_url,
        sort_order: index,
      }))
      await supabase.from('prompt_images').insert(imageRecords)

      stats.prompts_created++
    }

    // 更新抓取时间
    await supabase
      .from('twitter_creators')
      .update({ last_fetched_at: new Date().toISOString() })
      .eq('id', creator_id)

    // 更新统计计数（fetch_count +1, success_count + 本次创建数）
    await supabase.rpc('increment_creator_counts', {
      p_creator_id: creator_id,
      p_fetch_count: 1,
      p_success_count: stats.prompts_created,
    })

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Manual crawl error:', error)
    return NextResponse.json(
      { error: '抓取失败', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}