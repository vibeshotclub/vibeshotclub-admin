import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/utils/auth'
import { uploadToR2 } from '@/lib/r2/client'
import type { VideoOrientation } from '@/types/database'

// 支持的视频格式
const SUPPORTED_FORMATS = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

// GET - 获取视频列表
export async function GET() {
  try {
    const isAdmin = await verifyAdminSession()
    if (!isAdmin) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const supabase = await createAdminClient()

    const { data, error } = await supabase
      .from('homepage_videos')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ videos: data })
  } catch (error) {
    console.error('Get homepage videos error:', error)
    return NextResponse.json({ error: '获取视频列表失败' }, { status: 500 })
  }
}

// POST - 上传新视频
export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession()
    if (!isAdmin) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('video') as File | null
    const title = formData.get('title') as string | null
    const description = formData.get('description') as string | null
    const orientation = (formData.get('orientation') as VideoOrientation) || 'portrait'
    const thumbnailFile = formData.get('thumbnail') as File | null
    
    // 前端处理后的视频元数据
    const processedWidth = parseInt(formData.get('processed_width') as string) || null
    const processedHeight = parseInt(formData.get('processed_height') as string) || null
    const originalWidth = parseInt(formData.get('original_width') as string) || null
    const originalHeight = parseInt(formData.get('original_height') as string) || null
    const duration = parseFloat(formData.get('duration') as string) || 5.0

    if (!file) {
      return NextResponse.json({ error: '请选择视频文件' }, { status: 400 })
    }

    // 验证文件格式
    if (!SUPPORTED_FORMATS.includes(file.type)) {
      return NextResponse.json(
        { error: `不支持的视频格式。支持: ${SUPPORTED_FORMATS.join(', ')}` },
        { status: 400 }
      )
    }

    // 验证文件大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: '视频文件过大，最大支持 100MB' },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()

    // 生成唯一文件名
    const videoId = randomUUID()
    const ext = file.name.split('.').pop() || 'mp4'
    const videoKey = `homepage-videos/${videoId}.${ext}`

    // 上传视频到 R2
    const videoBuffer = Buffer.from(await file.arrayBuffer())
    const videoUrl = await uploadToR2(videoKey, videoBuffer, file.type)

    // 上传缩略图（如果有）
    let thumbnailUrl: string | null = null
    if (thumbnailFile) {
      const thumbKey = `homepage-videos/thumbnails/${videoId}.jpg`
      const thumbBuffer = Buffer.from(await thumbnailFile.arrayBuffer())
      thumbnailUrl = await uploadToR2(thumbKey, thumbBuffer, 'image/jpeg')
    }

    // 保存到数据库
    const { data, error } = await supabase
      .from('homepage_videos')
      .insert({
        title: title?.trim() || null,
        description: description?.trim() || null,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        orientation,
        original_width: originalWidth,
        original_height: originalHeight,
        processed_width: processedWidth,
        processed_height: processedHeight,
        duration,
        file_size: file.size,
        mime_type: file.type,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ video: data }, { status: 201 })
  } catch (error) {
    console.error('Upload homepage video error:', error)
    return NextResponse.json(
      { error: '上传视频失败', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// PATCH - 批量更新排序
export async function PATCH(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession()
    if (!isAdmin) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await request.json()
    const { updates } = body as { updates: Array<{ id: string; sort_order: number }> }

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: 'updates 数组为必填项' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    for (const item of updates) {
      const { error } = await supabase
        .from('homepage_videos')
        .update({ sort_order: item.sort_order })
        .eq('id', item.id)

      if (error) {
        console.error(`Failed to update sort_order for ${item.id}:`, error)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Batch update sort order error:', error)
    return NextResponse.json({ error: '批量更新排序失败' }, { status: 500 })
  }
}