'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, Image as AntImage, Button, Spin, App, Space } from 'antd'
import { DeleteOutlined, LoadingOutlined, PlusOutlined, CloudUploadOutlined } from '@ant-design/icons'
import type { UploadProps } from 'antd'
import type { ImageData } from '@/types/database'

interface ImageUploaderProps {
  value?: ImageData[]
  onChange?: (images: ImageData[]) => void
  maxCount?: number
}

export function ImageUploader({ value = [], onChange, maxCount = 9 }: ImageUploaderProps) {
  const { message } = App.useApp()
  const [uploading, setUploading] = useState(false)
  const [uploadingCount, setUploadingCount] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const pendingImagesRef = useRef<ImageData[]>([])
  const valueRef = useRef<ImageData[]>(value)
  const onChangeRef = useRef(onChange)
  const containerRef = useRef<HTMLDivElement>(null)
  const handleUploadRef = useRef<(file: File) => void>(() => {})
  const dragCounterRef = useRef(0)

  // 保持 ref 同步
  useEffect(() => {
    valueRef.current = value
  }, [value])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const isFull = value.length >= maxCount
  const isDisabled = uploading || isFull

  // 完成上传后的回调处理
  const flushPendingImages = useCallback(() => {
    if (pendingImagesRef.current.length > 0) {
      const newImages = [...valueRef.current, ...pendingImagesRef.current]
      pendingImagesRef.current = []
      // 使用 queueMicrotask 避免在渲染期间更新状态
      queueMicrotask(() => {
        onChangeRef.current?.(newImages)
      })
    }
  }, [])

  const handleUpload = async (file: File) => {
    if (isFull) {
      message.warning(`最多只能上传 ${maxCount} 张图片`)
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      message.error(`${file.name} 文件大小不能超过 10MB`)
      return
    }

    setUploading(true)
    setUploadingCount(prev => prev + 1)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '上传失败')
      }

      const newImage: ImageData = {
        image_url: data.image_url,
        thumbnail_url: data.thumbnail_url,
      }

      // 累积到 pending 数组
      pendingImagesRef.current = [...pendingImagesRef.current, newImage]
      message.success(`${file.name} 上传成功`)
    } catch (error) {
      message.error(`${file.name}: ${(error as Error).message}`)
    } finally {
      setUploadingCount(prev => {
        const newCount = prev - 1
        // 当所有文件都上传完成时，一次性更新
        if (newCount === 0) {
          setUploading(false)
          flushPendingImages()
        }
        return newCount
      })
    }
  }

  // 保持 handleUpload ref 同步
  useEffect(() => {
    handleUploadRef.current = handleUpload
  })

  // 处理粘贴事件
  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (valueRef.current.length >= maxCount || uploading) return

    const items = e.clipboardData?.items
    if (!items) return

    const imageFiles: File[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          imageFiles.push(file)
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault()
      imageFiles.forEach(file => {
        // 粘贴的图片没有文件名，生成一个
        const ext = file.type.split('/')[1] || 'png'
        const newFile = new File([file], `pasted-image-${Date.now()}.${ext}`, { type: file.type })
        handleUploadRef.current(newFile)
      })
    }
  }, [maxCount, uploading])

  // 监听全局粘贴事件
  useEffect(() => {
    document.addEventListener('paste', handlePaste)
    return () => {
      document.removeEventListener('paste', handlePaste)
    }
  }, [handlePaste])

  // 拖拽事件处理
  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer?.types.includes('Files')) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setIsDragging(false)

    if (valueRef.current.length >= maxCount || uploading) return

    const files = e.dataTransfer?.files
    if (!files) return

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.type.startsWith('image/')) {
        handleUploadRef.current(file)
      }
    }
  }, [maxCount, uploading])

  // 监听全局拖拽事件
  useEffect(() => {
    document.addEventListener('dragenter', handleDragEnter)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('drop', handleDrop)
    return () => {
      document.removeEventListener('dragenter', handleDragEnter)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('drop', handleDrop)
    }
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop])

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    accept: 'image/png,image/jpeg,image/jpg,image/gif,image/webp',
    showUploadList: false,
    beforeUpload: (file) => {
      if (!isDisabled) {
        handleUpload(file)
      }
      return false
    },
  }

  const handleRemove = (index: number) => {
    const newImages = value.filter((_, i) => i !== index)
    onChange?.(newImages)
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const newImages = [...value]
    ;[newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]]
    onChange?.(newImages)
  }

  const handleMoveDown = (index: number) => {
    if (index === value.length - 1) return
    const newImages = [...value]
    ;[newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]]
    onChange?.(newImages)
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 12,
      }}
    >
      {/* 拖拽遮罩层 */}
      {isDragging && !isFull && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(168, 85, 247, 0.15)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            border: '3px dashed #a855f7',
            pointerEvents: 'none',
          }}
        >
          <CloudUploadOutlined style={{ fontSize: 64, color: '#a855f7' }} />
          <span style={{ marginTop: 16, fontSize: 18, color: '#a855f7', fontWeight: 500 }}>
            释放鼠标上传图片
          </span>
          <span style={{ marginTop: 8, fontSize: 14, color: 'rgba(168, 85, 247, 0.7)' }}>
            支持 PNG、JPG、GIF、WebP 格式
          </span>
        </div>
      )}

      {/* 已上传图片列表 */}
      {value.map((img, index) => (
        <div
          key={index}
          style={{
            position: 'relative',
            borderRadius: 8,
            overflow: 'hidden',
            background: '#1f1f1f',
            aspectRatio: '1 / 1',
          }}
        >
          <AntImage
            src={img.thumbnail_url || img.image_url}
            alt={`Image ${index + 1}`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
            preview={{
              src: img.image_url,
              mask: '预览',
            }}
          />
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            padding: '4px 8px',
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ color: '#fff', fontSize: 12 }}>
              {index === 0 ? '封面' : `#${index + 1}`}
            </span>
            <Space size={4}>
              {index > 0 && (
                <Button
                  type="text"
                  size="small"
                  onClick={() => handleMoveUp(index)}
                  style={{ color: '#fff', padding: '0 4px' }}
                >
                  ↑
                </Button>
              )}
              {index < value.length - 1 && (
                <Button
                  type="text"
                  size="small"
                  onClick={() => handleMoveDown(index)}
                  style={{ color: '#fff', padding: '0 4px' }}
                >
                  ↓
                </Button>
              )}
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleRemove(index)}
                style={{ padding: '0 4px' }}
              />
            </Space>
          </div>
        </div>
      ))}

      {/* 上传按钮 - 与图片同行，正方形，Neon风格 */}
      <Upload {...uploadProps} disabled={isDisabled} style={{ display: 'block' }}>
        <div
          style={{
            width: '100%',
            paddingBottom: '100%',
            position: 'relative',
            borderRadius: 8,
            border: `1px dashed ${isDisabled ? 'rgba(168, 85, 247, 0.1)' : 'rgba(168, 85, 247, 0.4)'}`,
            background: isDisabled ? 'rgba(20, 20, 30, 0.4)' : 'rgba(20, 20, 30, 0.6)',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            opacity: isDisabled ? 0.5 : 1,
            transition: 'all 0.3s',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {uploading ? (
              <>
                <Spin indicator={<LoadingOutlined style={{ fontSize: 24, color: '#a855f7' }} spin />} />
                <span style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                  {uploadingCount}张
                </span>
              </>
            ) : (
              <>
                <PlusOutlined style={{ fontSize: 28, color: isDisabled ? 'rgba(168, 85, 247, 0.3)' : '#a855f7' }} />
                <span style={{ marginTop: 8, fontSize: 12, color: isDisabled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.45)' }}>
                  {isFull ? '已满' : '点击或粘贴'}
                </span>
              </>
            )}
          </div>
        </div>
      </Upload>
    </div>
  )
}
