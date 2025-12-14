import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { verifyBotApiKey } from '@/lib/utils/auth'
import { processImage } from '@/lib/utils/image'
import { uploadToR2 } from '@/lib/r2/client'

// POST - Bot 上传图片
export async function POST(request: NextRequest) {
  try {
    // 验证 API Key
    const apiKey = request.headers.get('x-api-key')
    if (!verifyBotApiKey(apiKey)) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
    }

    // 验证文件大小 (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size cannot exceed 10MB' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const id = randomUUID()
    const ext = 'webp'

    // 处理图片
    const { main, thumbnail } = await processImage(buffer)

    // 上传到 R2
    const imageUrl = await uploadToR2(`images/${id}.${ext}`, main, 'image/webp')
    const thumbnailUrl = await uploadToR2(`thumbnails/${id}.${ext}`, thumbnail, 'image/webp')

    return NextResponse.json({
      success: true,
      image_url: imageUrl,
      thumbnail_url: thumbnailUrl,
    })
  } catch (error) {
    console.error('Bot upload error:', error)
    return NextResponse.json({
      error: 'Failed to upload image',
      detail: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
