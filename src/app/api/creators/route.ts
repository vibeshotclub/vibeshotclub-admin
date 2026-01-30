import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/utils/auth'
import type { TwitterCreatorFormData } from '@/types/database'

// GET - 获取创作者列表
export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession()
    if (!isAdmin) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sortBy = searchParams.get('sort_by') || 'created_at'

    const supabase = await createAdminClient()

    // 根据参数排序
    let query = supabase.from('twitter_creators').select('*')
    
    if (sortBy === 'sort_order') {
      query = query.order('sort_order', { ascending: true })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ creators: data })
  } catch (error) {
    console.error('Get creators error:', error)
    return NextResponse.json({ error: '获取创作者列表失败' }, { status: 500 })
  }
}

// POST - 创建创作者
export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession()
    if (!isAdmin) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body: TwitterCreatorFormData = await request.json()

    const { username, display_name, avatar_url, x_url, xiaohongshu_url, description, is_active, is_vsc } = body

    // 清理用户名 (移除 @ 符号)
    const cleanUsername = username?.trim() ? username.trim().replace(/^@/, '') : null

    // 自动生成 x_url
    const finalXUrl = x_url?.trim() || (cleanUsername ? `https://x.com/${cleanUsername}` : null)

    const supabase = await createAdminClient()

    // 检查是否已存在
    if (cleanUsername) {
      const { data: existing } = await supabase
        .from('twitter_creators')
        .select('id')
        .eq('username', cleanUsername)
        .single()

      if (existing) {
        return NextResponse.json({ error: '该创作者已存在' }, { status: 400 })
      }
    }

    // 获取下一个 sort_order
    const { data: maxSortData } = await supabase
      .from('twitter_creators')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const nextSortOrder = (maxSortData?.sort_order || 0) + 1

    const { data, error } = await supabase
      .from('twitter_creators')
      .insert({
        username: cleanUsername,
        display_name: display_name?.trim() || null,
        avatar_url: avatar_url?.trim() || null,
        x_url: finalXUrl,
        xiaohongshu_url: xiaohongshu_url?.trim() || null,
        description: description?.trim() || null,
        is_active: is_active ?? true,
        is_vsc: is_vsc ?? false,
        sort_order: nextSortOrder,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ creator: data }, { status: 201 })
  } catch (error) {
    console.error('Create creator error:', error)
    return NextResponse.json({ error: '创建创作者失败' }, { status: 500 })
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

    // 批量更新 sort_order
    for (const item of updates) {
      const { error } = await supabase
        .from('twitter_creators')
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