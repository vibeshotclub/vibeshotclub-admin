import sharp from 'sharp'

interface ProcessedImage {
  main: Buffer
  thumbnail: Buffer
}

export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  // Main image: max 1200px width, webp format, quality 85
  const main = await sharp(buffer)
    .resize(1200, null, { withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer()

  // Thumbnail: 400px width, webp format, quality 75
  const thumbnail = await sharp(buffer)
    .resize(400, null, { withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer()

  return { main, thumbnail }
}

export async function getImageMetadata(buffer: Buffer) {
  const metadata = await sharp(buffer).metadata()
  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
  }
}
