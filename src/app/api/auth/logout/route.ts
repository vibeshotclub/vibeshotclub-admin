import { NextResponse } from 'next/server'
import { clearAdminSession } from '@/lib/utils/auth'

export async function POST() {
  try {
    await clearAdminSession()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: '退出失败' },
      { status: 500 }
    )
  }
}
