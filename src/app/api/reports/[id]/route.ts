import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/utils/auth'
import { uploadToR2, deleteFromR2, getKeyFromUrl, getFromR2 } from '@/lib/r2/client'
import type { DailyReportFormData } from '@/types/database'

// GET - 获取单个日报（包含内容）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAuthenticated = await verifyAdminSession()
    if (!isAuthenticated) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createAdminClient()

    const { data: report, error } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '日报不存在' }, { status: 404 })
      }
      console.error('Get report error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 从 R2 获取 Markdown 内容
    let content = ''
    try {
      const key = getKeyFromUrl(report.content_url)
      if (key) {
        content = await getFromR2(key)
      }
    } catch (e) {
      console.error('Get content from R2 error:', e)
      // 即使获取内容失败，也返回其他信息
    }

    return NextResponse.json({
      report: {
        ...report,
        content,
      },
    })
  } catch (error) {
    console.error('Get report error:', error)
    return NextResponse.json({ error: '获取日报失败' }, { status: 500 })
  }
}

// PUT - 更新日报
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAuthenticated = await verifyAdminSession()
    if (!isAuthenticated) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { id } = await params
    const body: DailyReportFormData = await request.json()
    const { date, title, content, summary, is_published } = body

    if (!title) {
      return NextResponse.json({ error: 'title 为必填项' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // 获取当前记录
    const { data: current, error: fetchError } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: '日报不存在' }, { status: 404 })
      }
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    // 如果日期改变，检查新日期是否已被占用
    if (date && date !== current.date) {
      const { data: existing } = await supabase
        .from('daily_reports')
        .select('id')
        .eq('date', date)
        .neq('id', id)
        .single()

      if (existing) {
        return NextResponse.json(
          { error: '该日期的日报已存在' },
          { status: 400 }
        )
      }
    }

    const updateData: Record<string, unknown> = {
      title,
      summary: summary || null,
      is_published: is_published ?? current.is_published,
    }

    // 如果内容有变化，更新 R2
    if (content) {
      const newDate = date || current.date
      const key = `reports/${newDate}.md`
      const contentUrl = await uploadToR2(key, Buffer.from(content, 'utf-8'), 'text/markdown')
      updateData.content_url = contentUrl

      // 如果日期改变，删除旧文件
      if (date && date !== current.date) {
        const oldKey = getKeyFromUrl(current.content_url)
        if (oldKey) {
          try {
            await deleteFromR2(oldKey)
          } catch {}
        }
      }
    }

    // 如果日期改变，更新日期
    if (date && date !== current.date) {
      updateData.date = date
    }

    const { data, error } = await supabase
      .from('daily_reports')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Update report error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ report: data })
  } catch (error) {
    console.error('Update report error:', error)
    return NextResponse.json({ error: '更新日报失败' }, { status: 500 })
  }
}

// DELETE - 删除日报
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAuthenticated = await verifyAdminSession()
    if (!isAuthenticated) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createAdminClient()

    // 获取日报信息以删除 R2 文件
    const { data: report } = await supabase
      .from('daily_reports')
      .select('content_url')
      .eq('id', id)
      .single()

    // 删除数据库记录
    const { error } = await supabase
      .from('daily_reports')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Delete report error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 删除 R2 文件
    if (report?.content_url) {
      const key = getKeyFromUrl(report.content_url)
      if (key) {
        try {
          await deleteFromR2(key)
        } catch {}
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete report error:', error)
    return NextResponse.json({ error: '删除日报失败' }, { status: 500 })
  }
}
