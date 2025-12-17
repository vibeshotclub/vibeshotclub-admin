import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { verifyAdminSession } from '@/lib/utils/auth'
import { processImage } from '@/lib/utils/image'
import { uploadToR2 } from '@/lib/r2/client'

export async function POST(request: NextRequest) {
  try {
    // Verify admin session
    const isAdmin = await verifyAdminSession()
    if (!isAdmin) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: '请选择文件' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: '只能上传图片文件' }, { status: 400 })
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: '文件大小不能超过 10MB' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const id = randomUUID()
    const ext = 'png'

    // Process images with Sharp
    const { main, thumbnail } = await processImage(buffer)

    // Upload to R2
    const imageUrl = await uploadToR2(`images/${id}.${ext}`, main, 'image/png')
    const thumbnailUrl = await uploadToR2(`thumbnails/${id}.${ext}`, thumbnail, 'image/png')

    return NextResponse.json({
      image_url: imageUrl,
      thumbnail_url: thumbnailUrl,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: '上传失败，请稍后重试' },
      { status: 500 }
    )
  }
}
