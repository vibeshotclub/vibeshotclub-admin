'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Card,
  Button,
  Table,
  Space,
  Switch,
  Typography,
  App,
  Modal,
  Form,
  Input,
  Radio,
  Popconfirm,
  Tag,
  Progress,
  Slider,
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  VideoCameraOutlined,
  ScissorOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { useHomepageVideos } from '@/hooks/useHomepageVideos'
import type { HomepageVideo, VideoOrientation } from '@/types/database'

const { Text } = Typography
const { TextArea } = Input

export default function HomepageVideosPage() {
  const { message } = App.useApp()
  const { videos, isLoading, mutate, deleteVideo, updateVideo } = useHomepageVideos()

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingVideo, setEditingVideo] = useState<HomepageVideo | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // 视频裁剪相关状态
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [orientation, setOrientation] = useState<VideoOrientation>('portrait')
  const [trimRange, setTrimRange] = useState<[number, number]>([0, 5])
  const [videoDuration, setVideoDuration] = useState(0)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [videoMetadata, setVideoMetadata] = useState<{
    width: number
    height: number
  } | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [editForm] = Form.useForm()

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证格式
    const supportedFormats = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']
    if (!supportedFormats.includes(file.type)) {
      message.error('不支持的视频格式，请上传 MP4、MOV 或 WebM 格式')
      return
    }

    // 验证大小
    if (file.size > 100 * 1024 * 1024) {
      message.error('视频文件过大，最大支持 100MB')
      return
    }

    setSelectedFile(file)
    const url = URL.createObjectURL(file)
    setVideoSrc(url)
  }

  // 视频加载完成
  const handleVideoLoaded = () => {
    if (videoRef.current) {
      const duration = videoRef.current.duration
      setVideoDuration(duration)
      setTrimRange([0, Math.min(5, duration)])
      setVideoMetadata({
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight,
      })

      // 自动检测方向
      const isPortrait = videoRef.current.videoHeight > videoRef.current.videoWidth
      setOrientation(isPortrait ? 'portrait' : 'landscape')
    }
  }

  // 预览时间点
  const handleSliderChange = (value: number[]) => {
    setTrimRange(value as [number, number])
    if (videoRef.current) {
      videoRef.current.currentTime = value[0]
    }
  }

  // 播放预览片段
  const handlePlayPreview = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = trimRange[0]
      videoRef.current.play()

      // 在结束时间停止
      const checkTime = () => {
        if (videoRef.current && videoRef.current.currentTime >= trimRange[1]) {
          videoRef.current.pause()
          videoRef.current.currentTime = trimRange[0]
        } else {
          requestAnimationFrame(checkTime)
        }
      }
      requestAnimationFrame(checkTime)
    }
  }

  // 生成缩略图
  const generateThumbnail = useCallback(async (): Promise<Blob | null> => {
    if (!videoRef.current || !canvasRef.current) return null

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // 设置缩略图时间点（片段开始）
    video.currentTime = trimRange[0]

    return new Promise((resolve) => {
      video.onseeked = () => {
        // 根据方向计算裁剪区域
        let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight
        let dw = 400, dh = 600 // 默认竖屏 2:3

        if (orientation === 'portrait') {
          // 竖屏 2:3 中心裁剪
          const targetRatio = 2 / 3
          const videoRatio = video.videoWidth / video.videoHeight

          if (videoRatio > targetRatio) {
            // 视频更宽，裁剪两边
            sw = video.videoHeight * targetRatio
            sx = (video.videoWidth - sw) / 2
          } else {
            // 视频更高，裁剪上下
            sh = video.videoWidth / targetRatio
            sy = (video.videoHeight - sh) / 2
          }
          dw = 400
          dh = 600
        } else {
          // 横屏保持原比例
          dw = 600
          dh = Math.round(600 * (video.videoHeight / video.videoWidth))
        }

        canvas.width = dw
        canvas.height = dh
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh)

        canvas.toBlob((blob) => {
          resolve(blob)
        }, 'image/jpeg', 0.85)
      }
    })
  }, [orientation, trimRange])

  // 处理上传
  const handleUpload = async () => {
    if (!selectedFile) {
      message.error('请先选择视频文件')
      return
    }

    setIsSubmitting(true)
    setUploadProgress(10)

    try {
      // 生成缩略图
      setUploadProgress(20)
      const thumbnail = await generateThumbnail()

      // 准备表单数据
      const formData = new FormData()
      formData.append('video', selectedFile)
      formData.append('title', title)
      formData.append('description', description)
      formData.append('orientation', orientation)
      formData.append('duration', String(trimRange[1] - trimRange[0]))
      
      if (videoMetadata) {
        formData.append('original_width', String(videoMetadata.width))
        formData.append('original_height', String(videoMetadata.height))
        
        // 计算处理后尺寸
        if (orientation === 'portrait') {
          const targetRatio = 2 / 3
          const processedWidth = Math.min(videoMetadata.width, Math.round(videoMetadata.height * targetRatio))
          const processedHeight = Math.round(processedWidth / targetRatio)
          formData.append('processed_width', String(processedWidth))
          formData.append('processed_height', String(processedHeight))
        } else {
          formData.append('processed_width', String(videoMetadata.width))
          formData.append('processed_height', String(videoMetadata.height))
        }
      }

      if (thumbnail) {
        formData.append('thumbnail', thumbnail, 'thumbnail.jpg')
      }

      setUploadProgress(40)

      // 上传
      const response = await fetch('/api/homepage-videos', {
        method: 'POST',
        body: formData,
      })

      setUploadProgress(90)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '上传失败')
      }

      setUploadProgress(100)
      message.success('视频上传成功')
      
      // 重置状态
      resetUploadState()
      setIsUploadModalOpen(false)
      mutate()
    } catch (error) {
      message.error((error as Error).message)
    } finally {
      setIsSubmitting(false)
      setUploadProgress(0)
    }
  }

  // 重置上传状态
  const resetUploadState = () => {
    setSelectedFile(null)
    setVideoSrc(null)
    setTitle('')
    setDescription('')
    setTrimRange([0, 5])
    setVideoDuration(0)
    setVideoMetadata(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 打开编辑弹窗
  const openEditModal = (video: HomepageVideo) => {
    setEditingVideo(video)
    editForm.setFieldsValue({
      title: video.title || '',
      description: video.description || '',
      is_active: video.is_active,
    })
    setIsEditModalOpen(true)
  }

  // 保存编辑
  const handleEdit = async (values: { title: string; description: string; is_active: boolean }) => {
    if (!editingVideo) return

    setIsSubmitting(true)
    try {
      await updateVideo(editingVideo.id, values)
      message.success('视频信息已更新')
      setIsEditModalOpen(false)
    } catch (error) {
      message.error((error as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 切换激活状态
  const handleToggleActive = async (video: HomepageVideo) => {
    try {
      await updateVideo(video.id, { is_active: !video.is_active })
      message.success(video.is_active ? '已停用' : '已启用')
    } catch (error) {
      message.error((error as Error).message)
    }
  }

  // 删除视频
  const handleDelete = async (id: string) => {
    try {
      await deleteVideo(id)
      message.success('视频已删除')
    } catch (error) {
      message.error((error as Error).message)
    }
  }

  // 格式化文件大小
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const columns: ColumnsType<HomepageVideo> = [
    {
      title: '缩略图',
      dataIndex: 'thumbnail_url',
      key: 'thumbnail',
      width: 120,
      render: (url, record) => (
        <div
          style={{
            width: 80,
            height: 120,
            background: '#1a1a2e',
            borderRadius: 8,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {url ? (
            <img
              src={url}
              alt={record.title || '视频缩略图'}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <VideoCameraOutlined style={{ fontSize: 24, color: 'rgba(255,255,255,0.3)' }} />
          )}
        </div>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      render: (title, record) => (
        <div>
          <div>{title || <Text type="secondary">未命名</Text>}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.orientation === 'portrait' ? '竖屏' : '横屏'} · {record.duration}s
          </Text>
        </div>
      ),
    },
    {
      title: '尺寸',
      key: 'dimensions',
      width: 120,
      render: (_, record) => (
        <Text type="secondary">
          {record.processed_width || record.original_width || '-'} × {record.processed_height || record.original_height || '-'}
        </Text>
      ),
    },
    {
      title: '文件大小',
      dataIndex: 'file_size',
      key: 'file_size',
      width: 100,
      render: (size) => <Text type="secondary">{formatFileSize(size)}</Text>,
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 80,
      render: (order) => <Tag>#{order}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (is_active, record) => (
        <Switch
          checked={is_active}
          onChange={() => handleToggleActive(record)}
          size="small"
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<PlayCircleOutlined />}
            onClick={() => window.open(record.video_url, '_blank')}
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          />
          <Popconfirm
            title="确认删除"
            description="删除后无法恢复，确定要删除这个视频吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <AdminLayout>
      <Card
        title={
          <Space>
            <VideoCameraOutlined />
            <span>首页视频</span>
            <Text type="secondary" style={{ fontSize: 14, fontWeight: 400 }}>
              共 {videos.length} 个视频
            </Text>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsUploadModalOpen(true)}
          >
            上传视频
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={videos}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 上传视频弹窗 */}
      <Modal
        title={
          <Space>
            <ScissorOutlined />
            <span>上传并裁剪视频</span>
          </Space>
        }
        open={isUploadModalOpen}
        onCancel={() => {
          resetUploadState()
          setIsUploadModalOpen(false)
        }}
        footer={null}
        width={700}
        destroyOnClose
      >
        <div style={{ marginTop: 16 }}>
          {/* 文件选择 */}
          {!videoSrc ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed rgba(168, 85, 247, 0.3)',
                borderRadius: 12,
                padding: 60,
                textAlign: 'center',
                cursor: 'pointer',
                background: 'rgba(168, 85, 247, 0.05)',
              }}
            >
              <VideoCameraOutlined style={{ fontSize: 48, color: '#a855f7', marginBottom: 16 }} />
              <div>
                <Text style={{ fontSize: 16 }}>点击选择视频文件</Text>
              </div>
              <Text type="secondary">支持 MP4、MOV、WebM 格式，最大 100MB</Text>
            </div>
          ) : (
            <div>
              {/* 视频预览 */}
              <div style={{ marginBottom: 16 }}>
                <video
                  ref={videoRef}
                  src={videoSrc}
                  onLoadedMetadata={handleVideoLoaded}
                  style={{
                    width: '100%',
                    maxHeight: 300,
                    borderRadius: 8,
                    background: '#000',
                  }}
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </div>

              {/* 时间裁剪滑块 */}
              {videoDuration > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text>截取时间范围（固定 5 秒）</Text>
                    <Text type="secondary">
                      {trimRange[0].toFixed(1)}s - {trimRange[1].toFixed(1)}s
                    </Text>
                  </div>
                  <Slider
                    range
                    min={0}
                    max={videoDuration}
                    step={0.1}
                    value={trimRange}
                    onChange={(value) => {
                      // 固定 5 秒间隔
                      const [start] = value as number[]
                      const end = Math.min(start + 5, videoDuration)
                      handleSliderChange([start, end])
                    }}
                  />
                  <Button
                    type="link"
                    icon={<PlayCircleOutlined />}
                    onClick={handlePlayPreview}
                    style={{ padding: 0 }}
                  >
                    预览片段
                  </Button>
                </div>
              )}

              {/* 方向选择 */}
              <div style={{ marginBottom: 16 }}>
                <Text style={{ display: 'block', marginBottom: 8 }}>视频方向</Text>
                <Radio.Group
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value)}
                >
                  <Radio value="portrait">
                    竖屏 (2:3 中心裁剪)
                  </Radio>
                  <Radio value="landscape">
                    横屏 (保持原比例)
                  </Radio>
                </Radio.Group>
              </div>

              {/* 标题和描述 */}
              <div style={{ marginBottom: 16 }}>
                <Text style={{ display: 'block', marginBottom: 8 }}>标题（可选）</Text>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="输入视频标题"
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <Text style={{ display: 'block', marginBottom: 8 }}>描述（可选）</Text>
                <TextArea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="输入视频描述"
                  rows={2}
                />
              </div>

              {/* 上传进度 */}
              {uploadProgress > 0 && (
                <Progress percent={uploadProgress} style={{ marginBottom: 16 }} />
              )}

              {/* 操作按钮 */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button onClick={resetUploadState}>
                  重新选择
                </Button>
                <Space>
                  <Button onClick={() => setIsUploadModalOpen(false)}>
                    取消
                  </Button>
                  <Button
                    type="primary"
                    loading={isSubmitting}
                    onClick={handleUpload}
                  >
                    上传视频
                  </Button>
                </Space>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
      </Modal>

      {/* 编辑视频弹窗 */}
      <Modal
        title="编辑视频信息"
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleEdit}
          style={{ marginTop: 16 }}
        >
          <Form.Item label="标题" name="title">
            <Input placeholder="输入视频标题" />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <TextArea placeholder="输入视频描述" rows={3} />
          </Form.Item>

          <Form.Item label="启用状态" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsEditModalOpen(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={isSubmitting}>
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </AdminLayout>
  )
}