'use client'

import { useState } from 'react'
import { Upload, Image as AntImage, Button, Spin, message } from 'antd'
import { InboxOutlined, DeleteOutlined, LoadingOutlined } from '@ant-design/icons'
import type { UploadProps } from 'antd'

const { Dragger } = Upload

interface ImageUploaderProps {
  value?: string
  onChange: (imageUrl: string, thumbnailUrl: string) => void
}

export function ImageUploader({ value, onChange }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null)

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: 'image/png,image/jpeg,image/jpg,image/gif,image/webp',
    showUploadList: false,
    beforeUpload: () => false, // 阻止自动上传，手动处理
    onChange: async (info) => {
      const file = info.file as unknown as File
      if (!file) return

      // 验证文件大小
      if (file.size > 10 * 1024 * 1024) {
        message.error('文件大小不能超过 10MB')
        return
      }

      // 显示预览
      const objectUrl = URL.createObjectURL(file)
      setPreviewUrl(objectUrl)
      setUploading(true)

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

        onChange(data.image_url, data.thumbnail_url)
        setPreviewUrl(data.thumbnail_url)
        message.success('上传成功')
      } catch (error) {
        setPreviewUrl(null)
        message.error((error as Error).message)
      } finally {
        setUploading(false)
        URL.revokeObjectURL(objectUrl)
      }
    },
  }

  const handleRemove = () => {
    setPreviewUrl(null)
    onChange('', '')
  }

  if (previewUrl) {
    return (
      <div style={{ position: 'relative', width: '100%' }}>
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          borderRadius: 8,
          overflow: 'hidden',
          background: '#1f1f1f',
        }}>
          <AntImage
            src={previewUrl}
            alt="Preview"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            preview={{
              mask: '点击预览',
            }}
          />
          {uploading && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Spin indicator={<LoadingOutlined style={{ fontSize: 32, color: '#fff' }} spin />} />
            </div>
          )}
        </div>
        {!uploading && (
          <Button
            type="primary"
            danger
            icon={<DeleteOutlined />}
            onClick={handleRemove}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
            }}
          >
            删除
          </Button>
        )}
      </div>
    )
  }

  return (
    <Dragger {...uploadProps} disabled={uploading}>
      <p className="ant-upload-drag-icon">
        <InboxOutlined style={{ fontSize: 48, color: '#1890ff' }} />
      </p>
      <p className="ant-upload-text">点击或拖拽图片到此处上传</p>
      <p className="ant-upload-hint">
        支持 PNG, JPG, WebP 格式，最大 10MB
      </p>
    </Dragger>
  )
}
