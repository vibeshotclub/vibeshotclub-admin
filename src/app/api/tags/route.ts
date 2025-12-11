import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/utils/auth'

// GET - 获取所有标签
export async function GET() {
  try {
    const supabase = await createAdminClient()

    const { data, error } = await supabase
      .from('tags')
      .select(`
        *,
        tag_type:tag_types(id, name, slug, color, sort_order)
      `)
      .order('name')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform to include type from tag_type.slug for backward compatibility
    const tags = data?.map(tag => ({
      ...tag,
      type: tag.tag_type?.slug || tag.type,
    }))

    return NextResponse.json({ tags })
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
    const { name, type_id, color } = body

    if (!name || !type_id) {
      return NextResponse.json({ error: '标签名称和分组必填' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Get type slug for backward compatibility
    const { data: tagType } = await supabase
      .from('tag_types')
      .select('slug')
      .eq('id', type_id)
      .single()

    const { data, error } = await supabase
      .from('tags')
      .insert({
        name,
        type_id,
        type: tagType?.slug || 'style', // backward compatibility
        color: color || '#3b82f6'
      })
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
