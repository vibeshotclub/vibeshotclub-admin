import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyBotApiKey } from '@/lib/utils/auth'

// GET - 获取活跃创作者列表 (供爬虫使用)
export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key')
    if (!verifyBotApiKey(apiKey)) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    const supabase = await createAdminClient()

    const { data, error } = await supabase
      .from('twitter_creators')
      .select('id, username, display_name, last_tweet_id')
      .eq('is_active', true)
      .order('username', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ creators: data })
  } catch (error) {
    console.error('Bot get creators error:', error)
    return NextResponse.json({ error: 'Failed to fetch creators' }, { status: 500 })
  }
}

// PATCH - 更新创作者抓取状态 (供爬虫使用)
export async function PATCH(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key')
    if (!verifyBotApiKey(apiKey)) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    const body = await request.json()
    const { creator_id, last_tweet_id, increment_fetch, increment_success } = body

    if (!creator_id) {
      return NextResponse.json({ error: 'creator_id is required' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // 构建更新对象
    const updates: Record<string, unknown> = {
      last_fetched_at: new Date().toISOString(),
    }

    if (last_tweet_id) {
      updates.last_tweet_id = last_tweet_id
    }

    // 更新基本字段
    const { error: updateError } = await supabase
      .from('twitter_creators')
      .update(updates)
      .eq('id', creator_id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // 使用 RPC 函数增加计数
    if (increment_fetch || increment_success) {
      const { error: rpcError } = await supabase.rpc('increment_creator_counts', {
        p_creator_id: creator_id,
        p_fetch_count: increment_fetch ? 1 : 0,
        p_success_count: increment_success ? 1 : 0,
      })

      if (rpcError) {
        console.error('RPC error:', rpcError)
        // 不中断，计数失败不影响主流程
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Bot update creator error:', error)
    return NextResponse.json({ error: 'Failed to update creator' }, { status: 500 })
  }
}
