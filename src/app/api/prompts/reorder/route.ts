import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/utils/auth'

// POST - 批量更新排序
export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession()
    if (!isAdmin) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { ids } = await request.json()

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: '请提供排序列表' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Update sort_order for each prompt
    // Higher index = higher sort_order (appears first)
    const updates = ids.map((id: string, index: number) =>
      supabase
        .from('prompts')
        .update({ sort_order: ids.length - index })
        .eq('id', id)
    )

    await Promise.all(updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reorder prompts error:', error)
    return NextResponse.json({ error: '排序失败' }, { status: 500 })
  }
}
