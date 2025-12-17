import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyBotApiKey } from '@/lib/utils/auth'
import { uploadToR2, deleteFromR2, getKeyFromUrl } from '@/lib/r2/client'

interface BotReportRequest {
  date: string
  title: string
  summary?: string
  content: string
}

// POST - Bot 上传日报
export async function POST(request: NextRequest) {
  try {
    // 验证 API Key
    const apiKey = request.headers.get('x-api-key')
    if (!verifyBotApiKey(apiKey)) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    // 解析请求体
    const body: BotReportRequest = await request.json()
    const { date, title, content, summary } = body

    // 验证必填字段
    if (!date || !title || !content) {
      return NextResponse.json(
        { error: 'date, title, content 为必填项' },
        { status: 400 }
      )
    }

    // 验证日期格式 (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: '日期格式错误，应为 YYYY-MM-DD' },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()

    // 检查是否已存在该日期的日报
    const { data: existing } = await supabase
      .from('daily_reports')
      .select('id, content_url')
      .eq('date', date)
      .single()

    // 上传 Markdown 到 R2
    const key = `reports/${date}.md`
    const contentUrl = await uploadToR2(key, Buffer.from(content, 'utf-8'), 'text/markdown')

    if (existing) {
      // 更新已存在的日报
      const { data, error } = await supabase
        .from('daily_reports')
        .update({
          title,
          summary: summary || null,
          content_url: contentUrl,
          source: 'bot',
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('Update report error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        report: data,
        message: '日报已更新',
      })
    }

    // 创建新日报
    const { data, error } = await supabase
      .from('daily_reports')
      .insert({
        date,
        title,
        summary: summary || null,
        content_url: contentUrl,
        source: 'bot',
        is_published: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Create report error:', error)
      // 如果数据库插入失败，尝试删除已上传的文件
      try {
        await deleteFromR2(key)
      } catch {}
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      report: data,
      message: '日报已创建',
    }, { status: 201 })
  } catch (error) {
    console.error('Bot report error:', error)
    return NextResponse.json({ error: '处理日报失败' }, { status: 500 })
  }
}
