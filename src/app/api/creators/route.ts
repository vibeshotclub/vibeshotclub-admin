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

    const supabase = await createAdminClient()

    // 默认按创建时间倒序
    const { data, error } = await supabase
      .from('twitter_creators')
      .select('*')
      .order('created_at', { ascending: false })

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
    // [修改] 解构 is_vsc
    const { username, display_name, avatar_url, description, is_active, is_vsc } = body

    if (!username?.trim()) {
      return NextResponse.json({ error: 'username 为必填项' }, { status: 400 })
    }

    // 清理用户名 (移除 @ 符号)
    const cleanUsername = username.trim().replace(/^@/, '')

    const supabase = await createAdminClient()

    // 检查是否已存在
    const { data: existing } = await supabase
      .from('twitter_creators')
      .select('id')
      .eq('username', cleanUsername)
      .single()

    if (existing) {
      return NextResponse.json({ error: '该创作者已存在' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('twitter_creators')
      .insert({
        username: cleanUsername,
        display_name: display_name?.trim() || null,
        avatar_url: avatar_url?.trim() || null,
        description: description?.trim() || null,
        is_active: is_active ?? true,
        is_vsc: is_vsc ?? false, // [修改] 写入数据库
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