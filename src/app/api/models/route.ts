import { NextResponse } from 'next/server'
import { getActiveModels, getModelsByCategory } from '@/lib/data/ai-models'

// GET - 获取 AI 模型列表
export async function GET() {
  try {
    const { closed, open } = getModelsByCategory()

    return NextResponse.json({
      models: getActiveModels(),
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
