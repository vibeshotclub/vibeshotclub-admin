import sharp from 'sharp'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_DIMENSION = 2048 // 2K resolution

interface ProcessedImage {
  main: Buffer
  thumbnail: Buffer
}

export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  // Main image: max 2048px on long edge (2K), PNG format for best quality
  let main = await sharp(buffer)
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png({ compressionLevel: 6 })
    .toBuffer()

  // If result > 5MB, increase compression
  if (main.length > MAX_SIZE) {
    main = await sharp(buffer)
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png({ compressionLevel: 8 })
      .toBuffer()
  }

  // If still > 5MB, reduce dimensions slightly
  if (main.length > MAX_SIZE) {
    main = await sharp(buffer)
      .resize({
        width: 1920,
        height: 1920,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png({ compressionLevel: 9 })
      .toBuffer()
  }

  // Thumbnail: 400px width, PNG format
  const thumbnail = await sharp(buffer)
    .resize(400, null, { withoutEnlargement: true })
    .png({ compressionLevel: 8 })
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
