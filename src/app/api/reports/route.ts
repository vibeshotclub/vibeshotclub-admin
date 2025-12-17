import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/utils/auth'
import { uploadToR2 } from '@/lib/r2/client'
import type { DailyReportFormData } from '@/types/database'

// GET - 获取日报列表
export async function GET(request: NextRequest) {
  try {
    const isAuthenticated = await verifyAdminSession()
    if (!isAuthenticated) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    const supabase = await createAdminClient()

    // 获取总数
    const { count } = await supabase
      .from('daily_reports')
      .select('*', { count: 'exact', head: true })

    // 获取列表
    const { data: reports, error } = await supabase
      .from('daily_reports')
      .select('*')
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Get reports error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      reports,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Get reports error:', error)
    return NextResponse.json({ error: '获取日报列表失败' }, { status: 500 })
  }
}

// POST - 创建日报
export async function POST(request: NextRequest) {
  try {
    const isAuthenticated = await verifyAdminSession()
    if (!isAuthenticated) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body: DailyReportFormData = await request.json()
    const { date, title, content, summary, is_published } = body

    if (!date || !title || !content) {
      return NextResponse.json(
        { error: 'date, title, content 为必填项' },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()

    // 检查日期是否已存在
    const { data: existing } = await supabase
      .from('daily_reports')
      .select('id')
      .eq('date', date)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: '该日期的日报已存在' },
        { status: 400 }
      )
    }

    // 上传 Markdown 到 R2
    const key = `reports/${date}.md`
    const contentUrl = await uploadToR2(key, Buffer.from(content, 'utf-8'), 'text/markdown')

    // 创建数据库记录
    const { data, error } = await supabase
      .from('daily_reports')
      .insert({
        date,
        title,
        summary: summary || null,
        content_url: contentUrl,
        source: 'manual',
        is_published: is_published ?? false,
      })
      .select()
      .single()

    if (error) {
      console.error('Create report error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ report: data }, { status: 201 })
  } catch (error) {
    console.error('Create report error:', error)
    return NextResponse.json({ error: '创建日报失败' }, { status: 500 })
  }
}
