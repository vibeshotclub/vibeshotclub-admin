import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import type { AIModel } from '@/types/database'

// GET - 获取 AI 模型列表
export async function GET() {
  try {
    const supabase = await createAdminClient()

    const { data: models, error } = await supabase
      .from('ai_models')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: false })

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
