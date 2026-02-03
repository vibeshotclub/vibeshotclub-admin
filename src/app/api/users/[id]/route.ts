import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/utils/auth'
import type { UserFormData } from '@/types/database'

// GET - 获取单个用户
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
      .from('users')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    return NextResponse.json({ user: data })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json({ error: '获取用户失败' }, { status: 500 })
  }
}

// PUT - 更新用户
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
    const body: UserFormData = await request.json()

    const { username, email, roles, is_vsc, membership_expires_at } = body

    const supabase = await createAdminClient()

    const { data, error } = await supabase
      .from('users')
      .update({
        username: username?.trim() || null,
        email: email?.trim() || null,
        roles,
        is_vsc,
        membership_expires_at: membership_expires_at || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ user: data })
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json({ error: '更新用户失败' }, { status: 500 })
  }
}

// DELETE - 删除用户
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
      .from('users')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json({ error: '删除用户失败' }, { status: 500 })
  }
}