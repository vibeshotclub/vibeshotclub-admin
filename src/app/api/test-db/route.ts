import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 直接创建 Supabase 客户端，不使用 SSR 封装
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    console.log('URL:', supabaseUrl)
    console.log('Key exists:', !!serviceKey)
    console.log('Key prefix:', serviceKey?.slice(0, 20))

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // 直接查询 prompts 表
    const { data, error, count } = await supabase
      .from('prompts')
      .select('*', { count: 'exact' })

    console.log('Direct query result:', { dataLength: data?.length, count, error })

    if (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      count,
      data,
    })
  } catch (err) {
    console.error('Test DB error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 })
  }
}
