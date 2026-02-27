import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/utils/auth'
import { processImage } from '@/lib/utils/image'
import { uploadToR2 } from '@/lib/r2/client'
import OpenAI from 'openai'

interface TweetData {
  tweet_id: string
  text: string
  created_at: string
  image_urls: string[]
  url: string
}

interface PromptAnalysis {
  is_relevant: boolean
  confidence: number
  reason: string
  extracted_prompt?: string
  extracted_negative_prompt?: string
  suggested_title?: string
  suggested_model?: string
}

// AI分析系统提示词
const AI_SYSTEM_PROMPT = `你是一个专业的 AI 图像生成提示词分析专家。你的任务是判断 Twitter 推文是否包含 AI 图像生成的提示词 (prompt)。

判断标准:
1. 推文必须包含用于 AI 图像生成工具 (如 Midjourney, DALL-E, Stable Diffusion, Flux, ComfyUI 等) 的提示词
2. 提示词通常是英文，包含描述性的图像描述、风格、参数等
3. 可能包含模型参数如 --ar, --v, --style 等
4. 必须有配图 (图片已确认存在)

请分析以下推文并返回 JSON 格式结果。`

// 生成AI分析的用户提示词
function getAIUserPrompt(text: string, imageCount: number): string {
  return `请分析这条推文:

推文内容:
${text}

推文包含 ${imageCount} 张图片。

请返回以下 JSON 格式:
{
  "is_relevant": true/false,
  "confidence": 0.0-1.0,
  "reason": "判断理由",
  "extracted_prompt": "提取的正向提示词 (如果相关)",
  "extracted_negative_prompt": "提取的负向提示词 (如果有)",
  "suggested_title": "建议的标题 (中文，简短)",
  "suggested_model": "推测使用的模型 (如 midjourney-v6, flux-1.1-pro 等)"
}

只返回 JSON，不要其他内容。`
}

// 解析AI响应
function parseAIResponse(resultText: string): PromptAnalysis {
  let text = resultText.trim()
  if (text.startsWith('```')) {
    text = text.split('```')[1]
    if (text.startsWith('json')) {
      text = text.slice(4)
    }
  }

  try {
    const result = JSON.parse(text)
    return {
      is_relevant: result.is_relevant ?? false,
      confidence: result.confidence ?? 0.0,
      reason: result.reason ?? '',
      extracted_prompt: result.extracted_prompt,
      extracted_negative_prompt: result.extracted_negative_prompt,
      suggested_title: result.suggested_title,
      suggested_model: result.suggested_model,
    }
  } catch {
    return {
      is_relevant: false,
      confidence: 0,
      reason: '解析AI响应失败',
    }
  }
}

// 使用DeepSeek分析
async function analyzeTweet(text: string, imageCount: number): Promise<PromptAnalysis> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    console.warn('未配置 DEEPSEEK_API_KEY，跳过AI分析')
    return {
      is_relevant: true, // 无AI时默认相关
      confidence: 1.0,
      reason: '未配置AI，跳过分析',
    }
  }

  try {
    const client = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com',
    })

    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: AI_SYSTEM_PROMPT },
        { role: 'user', content: getAIUserPrompt(text, imageCount) }
      ],
    })

    const content = response.choices[0]?.message?.content
    if (content) {
      return parseAIResponse(content)
    }
    throw new Error('No response from DeepSeek')
  } catch (error) {
    console.error('DeepSeek analysis error:', error)
    return {
      is_relevant: true, // 分析失败时默认相关，不影响入库
      confidence: 0.5,
      reason: `AI分析失败: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
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

// 通过用户名获取用户ID (twitter241)
async function getUserId(username: string, rapidApiKey: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://twitter241.p.rapidapi.com/user?username=${encodeURIComponent(username)}`,
      {
        headers: {
          'x-rapidapi-key': rapidApiKey,
          'x-rapidapi-host': 'twitter241.p.rapidapi.com',
        },
      }
    )

    if (!response.ok) {
      console.error('Get user ID error:', response.status)
      return null
    }

    const data = await response.json()
    // twitter241 返回格式: { result: { data: { user: { result: { rest_id: "xxx" } } } } }
    const userId = data?.result?.data?.user?.result?.rest_id
    return userId || null
  } catch (error) {
    console.error('Get user ID error:', error)
    return null
  }
}

// 从 twitter241 响应中提取图片URL
function extractImageUrls(tweet: any): string[] {
  const imageUrls: string[] = []
  
  // 尝试多种可能的媒体字段路径
  const mediaArray = 
    tweet?.legacy?.extended_entities?.media ||
    tweet?.legacy?.entities?.media ||
    tweet?.extended_entities?.media ||
    tweet?.entities?.media ||
    []

  for (const media of mediaArray) {
    if (media.type === 'photo' || media.type === 'image') {
      const url = media.media_url_https || media.media_url
      if (url) {
        imageUrls.push(`${url}?format=jpg&name=large`)
      }
    }
  }

  return imageUrls
}

// 从 twitter241 响应中解析推文
function parseTweet241(item: any, username: string): TweetData | null {
  try {
    // twitter241 的推文可能在不同层级
    const tweet = item?.content?.itemContent?.tweet_results?.result || 
                  item?.tweet_results?.result ||
                  item?.result ||
                  item

    // 获取 legacy 数据（包含推文详情）
    const legacy = tweet?.legacy || tweet

    // 跳过转推
    if (legacy?.retweeted_status_result || legacy?.retweeted) {
      return null
    }

    // 获取推文ID
    const tweetId = legacy?.id_str || tweet?.rest_id || legacy?.id
    if (!tweetId) return null

    // 获取推文文本
    const text = legacy?.full_text || legacy?.text || ''

    // 解析时间
    let createdAt = new Date()
    if (legacy?.created_at) {
      try {
        createdAt = new Date(legacy.created_at)
      } catch {
        // ignore
      }
    }

    // 提取图片URL
    const imageUrls = extractImageUrls(tweet) || extractImageUrls(legacy)

    // 只保留有图片的推文
    if (imageUrls.length === 0) {
      return null
    }

    return {
      tweet_id: tweetId,
      text,
      created_at: createdAt.toISOString(),
      image_urls: imageUrls,
      url: `https://twitter.com/${username}/status/${tweetId}`,
    }
  } catch (error) {
    console.error('Parse tweet error:', error)
    return null
  }
}

// POST - 手动抓取创作者推文
export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession()
    if (!isAdmin) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await request.json()
    const { creator_id, username, since_date, skip_ai_analysis } = body

    if (!creator_id || !username || !since_date) {
      return NextResponse.json(
        { error: 'creator_id, username, since_date 为必填项' },
        { status: 400 }
      )
    }

    // 是否启用AI分析（默认启用，除非明确跳过或未配置API Key）
    const hasDeepSeekKey = !!process.env.DEEPSEEK_API_KEY
    const enableAIAnalysis = !skip_ai_analysis && hasDeepSeekKey
    const relevanceThreshold = 0.7

    const supabase = await createAdminClient()

    // 调用 Twitter API 获取推文
    const rapidApiKey = process.env.RAPIDAPI_KEY
    if (!rapidApiKey) {
      return NextResponse.json(
        { error: '未配置 RAPIDAPI_KEY' },
        { status: 500 }
      )
    }

    // 第一步：获取用户ID
    console.log(`[twitter241] 获取用户 @${username} 的ID...`)
    const userId = await getUserId(username, rapidApiKey)
    if (!userId) {
      return NextResponse.json(
        { 
          error: '获取用户信息失败', 
          detail: `无法获取 @${username} 的用户ID，请确认用户名正确且账号未被封禁`,
        },
        { status: 400 }
      )
    }
    console.log(`[twitter241] 用户ID: ${userId}`)

    const sinceTimestamp = new Date(since_date).getTime()
    const tweets: TweetData[] = []
    let cursor: string | null = null
    const maxPages = 10

    // 分页获取推文
    for (let page = 0; page < maxPages; page++) {
      console.log(`[twitter241] 获取第 ${page + 1} 页推文...`)
      
      const params = new URLSearchParams({ 
        user: userId,
        count: '40',
      })
      if (cursor) {
        params.append('cursor', cursor)
      }

      const response = await fetch(
        `https://twitter241.p.rapidapi.com/user-tweets?${params}`,
        {
          headers: {
            'x-rapidapi-key': rapidApiKey,
            'x-rapidapi-host': 'twitter241.p.rapidapi.com',
          },
        }
      )

      if (!response.ok) {
        console.error('Twitter API error:', response.status)
        
        // 429 Rate Limit 错误
        if (response.status === 429) {
          return NextResponse.json(
            { 
              error: 'Twitter API 请求频率超限 (429)', 
              detail: '请登录 RapidAPI 控制台查看 twitter241 的配额使用情况。可能需要：1) 等待配额重置 2) 升级到更高的订阅套餐。',
              action_url: 'https://rapidapi.com/developer/billing/subscriptions-and-usage'
            },
            { status: 429 }
          )
        }
        
        // 401/403 认证错误
        if (response.status === 401 || response.status === 403) {
          return NextResponse.json(
            { 
              error: 'Twitter API 认证失败', 
              detail: response.status === 403 
                ? '请确认：1) RAPIDAPI_KEY 是否正确配置 2) 是否已订阅 twitter241 服务（需要在 RapidAPI 上订阅付费套餐）'
                : '请检查 RAPIDAPI_KEY 是否正确配置',
              action_url: 'https://rapidapi.com/davethebeast/api/twitter241/pricing'
            },
            { status: response.status }
          )
        }
        
        break
      }

      const data = await response.json()
      
      // twitter241 返回格式: { result: { timeline: { instructions: [...] } } }
      const instructions = data?.result?.timeline?.instructions || []
      let entries: any[] = []
      
      for (const instruction of instructions) {
        if (instruction.type === 'TimelineAddEntries' || instruction.entries) {
          entries = instruction.entries || []
          break
        }
      }

      let reachedSinceDate = false
      let nextCursor: string | null = null

      for (const entry of entries) {
        // 处理 cursor
        if (entry.entryId?.startsWith('cursor-bottom')) {
          nextCursor = entry.content?.value || null
          continue
        }

        // 跳过非推文条目
        if (!entry.entryId?.startsWith('tweet-')) {
          continue
        }

        const tweet = parseTweet241(entry, username)
        if (!tweet) continue

        // 检查是否超出日期范围
        const tweetTime = new Date(tweet.created_at).getTime()
        if (tweetTime < sinceTimestamp) {
          reachedSinceDate = true
          break
        }

        tweets.push(tweet)
      }

      console.log(`[twitter241] 第 ${page + 1} 页获取到 ${tweets.length} 条有图片的推文`)

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
      tweets_analyzed: 0,
      tweets_relevant: 0,
      prompts_created: 0,
      duplicates_skipped: 0,
      images_failed: 0,
      ai_filtered: 0,
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
      // 检查是否重复
      if (await isPromptExists(supabase, tweet.text)) {
        stats.duplicates_skipped++
        continue
      }

      // 检查是否已记录为失败（如果是，跳过）
      if (isFailedRecordExists(currentDescription, tweet.url)) {
        stats.images_failed++
        continue
      }

      // AI分析
      let analysis: PromptAnalysis | null = null
      let finalPromptText = tweet.text.trim()
      let finalTitle = `@${username} 的提示词`
      let suggestedModel: string | undefined

      if (enableAIAnalysis) {
        stats.tweets_analyzed++
        analysis = await analyzeTweet(tweet.text, tweet.image_urls.length)
        
        // 检查相关性
        if (!analysis.is_relevant || analysis.confidence < relevanceThreshold) {
          stats.ai_filtered++
          console.log(`[AI过滤] ${tweet.url} - ${analysis.reason} (置信度: ${analysis.confidence})`)
          continue
        }
        
        stats.tweets_relevant++
        
        // 使用AI提取的信息
        if (analysis.extracted_prompt) {
          finalPromptText = analysis.extracted_prompt
        }
        if (analysis.suggested_title) {
          finalTitle = analysis.suggested_title
        }
        suggestedModel = analysis.suggested_model
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
          title: finalTitle,
          description: `来源: ${tweet.url}`,
          prompt_text: finalPromptText,
          negative_prompt: analysis?.extracted_negative_prompt || null,
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

    // 手动抓取统计日志
    console.log(`[手动抓取] @${username} | 抓到: ${stats.tweets_found} 条 | AI分析: ${stats.tweets_analyzed} 条 | 相关: ${stats.tweets_relevant} 条 | 入库: ${stats.prompts_created} 条 | 跳过重复: ${stats.duplicates_skipped} 条 | AI过滤: ${stats.ai_filtered} 条 | 图片失败: ${stats.images_failed} 条`)

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Manual crawl error:', error)
    return NextResponse.json(
      { error: '抓取失败', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}