/**
 * 在浏览器端压缩图片
 * 使用 Canvas API 将图片压缩到指定大小以下
 */

const MAX_SIZE = 5 * 1024 * 1024 // 5MB - 目标上传大小限制
const MAX_DIMENSION = 2048 // 最大尺寸 (2K)
const INITIAL_QUALITY = 0.9
const MIN_QUALITY = 0.5

export async function compressImage(file: File): Promise<File> {
  // 如果文件已经小于限制，直接返回
  if (file.size <= MAX_SIZE) {
    return file
  }

  // 非图片文件直接返回
  if (!file.type.startsWith('image/')) {
    return file
  }

  // GIF 不压缩（会丢失动画）
  if (file.type === 'image/gif') {
    return file
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = async () => {
      URL.revokeObjectURL(url)

      try {
        const compressedFile = await compressWithCanvas(img, file.name, file.type)
        resolve(compressedFile)
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }

    img.src = url
  })
}

async function compressWithCanvas(
  img: HTMLImageElement,
  fileName: string,
  mimeType: string
): Promise<File> {
  // 计算缩放后的尺寸
  let { width, height } = img

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
    width = Math.round(width * ratio)
    height = Math.round(height * ratio)
  }

  // 创建 canvas
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('无法创建 Canvas 上下文')
  }

  // 绘制图片
  ctx.drawImage(img, 0, 0, width, height)

  // 输出格式 - 统一转为 PNG 以获得最佳质量
  const outputType = 'image/png'
  const outputName = fileName.replace(/\.[^.]+$/, '.png')

  // 逐步降低质量直到文件小于限制
  let quality = INITIAL_QUALITY
  let blob: Blob | null = null

  while (quality >= MIN_QUALITY) {
    blob = await canvasToBlob(canvas, outputType, quality)

    if (blob.size <= MAX_SIZE) {
      break
    }

    quality -= 0.1
  }

  // 如果质量降到最低还是太大，缩小尺寸再试
  if (blob && blob.size > MAX_SIZE) {
    const scale = Math.sqrt(MAX_SIZE / blob.size) * 0.9 // 留点余量
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    blob = await canvasToBlob(canvas, outputType, MIN_QUALITY)
  }

  if (!blob) {
    throw new Error('图片压缩失败')
  }

  return new File([blob], outputName, { type: outputType })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Canvas toBlob 失败'))
        }
      },
      type,
      quality
    )
  })
}
