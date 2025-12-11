import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/utils/auth'

// GET - 获取所有标签组
export async function GET() {
  try {
    const supabase = await createAdminClient()

    const { data, error } = await supabase
      .from('tag_types')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tagTypes: data })
  } catch (error) {
    console.error('Get tag types error:', error)
    return NextResponse.json({ error: '获取标签组失败' }, { status: 500 })
  }
}

// POST - 创建标签组
export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession()
    if (!isAdmin) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await request.json()
    const { name, slug, color } = body

    if (!name || !slug) {
      return NextResponse.json(
        { error: '名称和标识符必填' },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()

    // Get max sort_order
    const { data: maxSort } = await supabase
      .from('tag_types')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const sort_order = (maxSort?.sort_order || 0) + 1

    const { data, error } = await supabase
      .from('tag_types')
      .insert({ name, slug, color: color || '#3b82f6', sort_order })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: '名称或标识符已存在' },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tagType: data }, { status: 201 })
  } catch (error) {
    console.error('Create tag type error:', error)
    return NextResponse.json({ error: '创建标签组失败' }, { status: 500 })
  }
}
