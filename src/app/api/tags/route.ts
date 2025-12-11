import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/utils/auth'

// GET - 获取所有标签
export async function GET() {
  try {
    const supabase = await createAdminClient()

    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .order('type')
      .order('name')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tags: data })
  } catch (error) {
    console.error('Get tags error:', error)
    return NextResponse.json({ error: '获取标签失败' }, { status: 500 })
  }
}

// POST - 创建标签
export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession()
    if (!isAdmin) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await request.json()
    const { name, type, color } = body

    if (!name || !type) {
      return NextResponse.json({ error: '标签名称和类型必填' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    const { data, error } = await supabase
      .from('tags')
      .insert({ name, type, color: color || '#3b82f6' })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '标签名称已存在' }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tag: data }, { status: 201 })
  } catch (error) {
    console.error('Create tag error:', error)
    return NextResponse.json({ error: '创建标签失败' }, { status: 500 })
  }
}
