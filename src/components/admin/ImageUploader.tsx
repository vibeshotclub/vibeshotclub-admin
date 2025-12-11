'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, Image as AntImage, Button, Spin, message, Space } from 'antd'
import { DeleteOutlined, LoadingOutlined, PlusOutlined } from '@ant-design/icons'
import type { UploadProps } from 'antd'
import type { ImageData } from '@/types/database'

interface ImageUploaderProps {
  value?: ImageData[]
  onChange?: (images: ImageData[]) => void
  maxCount?: number
}

export function ImageUploader({ value = [], onChange, maxCount = 9 }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadingCount, setUploadingCount] = useState(0)
  const pendingImagesRef = useRef<ImageData[]>([])
  const valueRef = useRef<ImageData[]>(value)
  const onChangeRef = useRef(onChange)

  // 保持 ref 同步
  useEffect(() => {
    valueRef.current = value
  }, [value])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const isFull = value.length >= maxCount
  const isDisabled = uploading || isFull

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
          if (pendingImagesRef.current.length > 0) {
            // 使用 ref 获取最新的 value
            onChangeRef.current?.([...valueRef.current, ...pendingImagesRef.current])
            pendingImagesRef.current = []
          }
        }
        return newCount
      })
    }
  }

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
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: 12,
    }}>
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

      {/* 上传按钮 - 与图片同行，正方形 */}
      <Upload {...uploadProps} disabled={isDisabled} style={{ display: 'block' }}>
        <div
          style={{
            width: '100%',
            paddingBottom: '100%',
            position: 'relative',
            borderRadius: 8,
            border: `1px dashed ${isDisabled ? '#303030' : '#404040'}`,
            background: isDisabled ? '#1a1a1a' : '#252525',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            opacity: isDisabled ? 0.4 : 1,
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
                <Spin indicator={<LoadingOutlined style={{ fontSize: 24, color: '#fff' }} spin />} />
                <span style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                  {uploadingCount}张
                </span>
              </>
            ) : (
              <>
                <PlusOutlined style={{ fontSize: 28, color: isDisabled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.65)' }} />
                <span style={{ marginTop: 8, fontSize: 12, color: isDisabled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.45)' }}>
                  {isFull ? '已满' : '添加'}
                </span>
              </>
            )}
          </div>
        </div>
      </Upload>
    </div>
  )
}
