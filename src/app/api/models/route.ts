import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/utils/auth'
import type { AIModel, AIModelFormData } from '@/types/database'

// GET - 获取 AI 模型列表
export async function GET(request: NextRequest) {
  try {
    const supabase = await createAdminClient()
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active_only') === 'true'

    let query = supabase
      .from('ai_models')
      .select('*')
      .order('sort_order', { ascending: false })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data: models, error } = await query

    if (error) {
      console.error('Get models error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 按类别分组
    const closed = (models as AIModel[]).filter(m => m.category === 'closed')
    const open = (models as AIModel[]).filter(m => m.category === 'open')

    return NextResponse.json({
      models,
      grouped: {
        closed,
        open,
      },
    })
  } catch (error) {
    console.error('Get models error:', error)
    return NextResponse.json({ error: '获取模型列表失败' }, { status: 500 })
  }
}

// POST - 创建模型
export async function POST(request: NextRequest) {
  try {
    const isAuthenticated = await verifyAdminSession()
    if (!isAuthenticated) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body: AIModelFormData = await request.json()
    const { id, name, vendor, category, is_active, sort_order } = body

    if (!id || !name || !vendor || !category) {
      return NextResponse.json({ error: 'id, name, vendor, category 为必填项' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // 检查 ID 是否已存在
    const { data: existing } = await supabase
      .from('ai_models')
      .select('id')
      .eq('id', id)
      .single()

    if (existing) {
      return NextResponse.json({ error: '模型 ID 已存在' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('ai_models')
      .insert({
        id,
        name,
        vendor,
        category,
        is_active: is_active ?? true,
        sort_order: sort_order ?? 0,
      })
      .select()
      .single()

    if (error) {
      console.error('Create model error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ model: data }, { status: 201 })
  } catch (error) {
    console.error('Create model error:', error)
    return NextResponse.json({ error: '创建模型失败' }, { status: 500 })
  }
}
