import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/utils/auth'

export async function GET() {
  try {
    const isAuthenticated = await verifyAdminSession()
    return NextResponse.json({ authenticated: isAuthenticated })
  } catch (error) {
    console.error('Auth check error:', error)
    return NextResponse.json({ authenticated: false })
  }
}
