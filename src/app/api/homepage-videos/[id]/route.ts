import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/utils/auth'
import { deleteFromR2, getKeyFromUrl } from '@/lib/r2/client'

// GET - 获取单个视频
export async function GET(
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

    const { data, error } = await supabase
      .from('homepage_videos')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: '视频不存在' }, { status: 404 })
    }

    return NextResponse.json({ video: data })
  } catch (error) {
    console.error('Get homepage video error:', error)
    return NextResponse.json({ error: '获取视频失败' }, { status: 500 })
  }
}

// PUT - 更新视频信息
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
    const { title, description, is_active } = body

    const supabase = await createAdminClient()

    const { data, error } = await supabase
      .from('homepage_videos')
      .update({
        title: title?.trim() || null,
        description: description?.trim() || null,
        is_active,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ video: data })
  } catch (error) {
    console.error('Update homepage video error:', error)
    return NextResponse.json({ error: '更新视频失败' }, { status: 500 })
  }
}

// DELETE - 删除视频
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

    // 先获取视频信息
    const { data: video } = await supabase
      .from('homepage_videos')
      .select('video_url, thumbnail_url')
      .eq('id', id)
      .single()

    if (video) {
      // 删除 R2 中的视频文件
      const videoKey = getKeyFromUrl(video.video_url)
      if (videoKey) {
        try {
          await deleteFromR2(videoKey)
        } catch (e) {
          console.error('Failed to delete video from R2:', e)
        }
      }

      // 删除缩略图
      if (video.thumbnail_url) {
        const thumbKey = getKeyFromUrl(video.thumbnail_url)
        if (thumbKey) {
          try {
            await deleteFromR2(thumbKey)
          } catch (e) {
            console.error('Failed to delete thumbnail from R2:', e)
          }
        }
      }
    }

    // 删除数据库记录
    const { error } = await supabase
      .from('homepage_videos')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete homepage video error:', error)
    return NextResponse.json({ error: '删除视频失败' }, { status: 500 })
  }
}