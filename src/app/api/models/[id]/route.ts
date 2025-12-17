import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/utils/auth'
import type { AIModelFormData } from '@/types/database'

// GET - 获取单个模型
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createAdminClient()

    const { data, error } = await supabase
      .from('ai_models')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '模型不存在' }, { status: 404 })
      }
      console.error('Get model error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ model: data })
  } catch (error) {
    console.error('Get model error:', error)
    return NextResponse.json({ error: '获取模型失败' }, { status: 500 })
  }
}

// PUT - 更新模型
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAuthenticated = await verifyAdminSession()
    if (!isAuthenticated) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { id: currentId } = await params
    const body: AIModelFormData = await request.json()
    const { id: newId, name, vendor, category, is_active, sort_order } = body

    if (!name || !vendor || !category) {
      return NextResponse.json({ error: 'name, vendor, category 为必填项' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // 如果 ID 发生变化，需要先检查新 ID 是否存在，然后删除旧记录创建新记录
    if (newId && newId !== currentId) {
      // 检查新 ID 是否已存在
      const { data: existing } = await supabase
        .from('ai_models')
        .select('id')
        .eq('id', newId)
        .single()

      if (existing) {
        return NextResponse.json({ error: '新的模型 ID 已存在' }, { status: 400 })
      }

      // 获取旧记录
      const { data: oldModel } = await supabase
        .from('ai_models')
        .select('*')
        .eq('id', currentId)
        .single()

      if (!oldModel) {
        return NextResponse.json({ error: '模型不存在' }, { status: 404 })
      }

      // 删除旧记录
      await supabase.from('ai_models').delete().eq('id', currentId)

      // 创建新记录
      const { data, error } = await supabase
        .from('ai_models')
        .insert({
          id: newId,
          name,
          vendor,
          category,
          is_active: is_active ?? oldModel.is_active,
          sort_order: sort_order ?? oldModel.sort_order,
        })
        .select()
        .single()

      if (error) {
        console.error('Update model error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ model: data })
    }

    // ID 没变，直接更新
    const { data, error } = await supabase
      .from('ai_models')
      .update({
        name,
        vendor,
        category,
        is_active,
        sort_order,
      })
      .eq('id', currentId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '模型不存在' }, { status: 404 })
      }
      console.error('Update model error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ model: data })
  } catch (error) {
    console.error('Update model error:', error)
    return NextResponse.json({ error: '更新模型失败' }, { status: 500 })
  }
}

// DELETE - 删除模型
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

    const { error } = await supabase
      .from('ai_models')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Delete model error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete model error:', error)
    return NextResponse.json({ error: '删除模型失败' }, { status: 500 })
  }
}
