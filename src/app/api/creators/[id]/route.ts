import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/utils/auth'
import type { TwitterCreatorFormData } from '@/types/database'

// GET - 获取单个创作者
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await verifyAdminSession()
    if (!isAdmin) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createAdminClient()

    const { data, error } = await supabase
      .from('twitter_creators')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: '创作者不存在' }, { status: 404 })
    }

    return NextResponse.json({ creator: data })
  } catch (error) {
    console.error('Get creator error:', error)
    return NextResponse.json({ error: '获取创作者失败' }, { status: 500 })
  }
}

// PUT - 更新创作者
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await verifyAdminSession()
    if (!isAdmin) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { id } = await params
    const body: TwitterCreatorFormData = await request.json()
    // [修改] 增加 is_vsc
    const { username, display_name, avatar_url, description, is_active, is_vsc } = body

    if (!username?.trim()) {
      return NextResponse.json({ error: 'username 为必填项' }, { status: 400 })
    }

    const cleanUsername = username.trim().replace(/^@/, '')
    const supabase = await createAdminClient()

    const { data, error } = await supabase
      .from('twitter_creators')
      .update({
        username: cleanUsername,
        display_name: display_name?.trim() || null,
        avatar_url: avatar_url?.trim() || null,
        description: description?.trim() || null,
        is_active,
        is_vsc, // [修改] 更新字段
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '该用户名已存在' }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ creator: data })
  } catch (error) {
    console.error('Update creator error:', error)
    return NextResponse.json({ error: '更新创作者失败' }, { status: 500 })
  }
}

// DELETE - 删除创作者
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await verifyAdminSession()
    if (!isAdmin) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createAdminClient()

    const { error } = await supabase
      .from('twitter_creators')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete creator error:', error)
    return NextResponse.json({ error: '删除创作者失败' }, { status: 500 })
  }
}