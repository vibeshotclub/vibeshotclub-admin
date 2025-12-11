'use client'

import { useRouter } from 'next/navigation'
import { Form, Input, Select, Switch, Button, Space, Row, Col, Card, Tag, message, Divider } from 'antd'
import { SaveOutlined, CloseOutlined, StarOutlined, EyeOutlined } from '@ant-design/icons'
import { ImageUploader } from './ImageUploader'
import { useTags } from '@/hooks/useTags'
import type { PromptWithTags, PromptFormData, ImageData } from '@/types/database'

const { TextArea } = Input

interface PromptFormProps {
  prompt?: PromptWithTags
  onSubmit: (data: PromptFormData) => Promise<void>
  isSubmitting?: boolean
}

const sourceOptions = [
  { value: 'manual', label: '手动录入' },
  { value: 'wechat', label: '微信社群' },
  { value: 'twitter', label: 'X/Twitter' },
]

export function PromptForm({ prompt, onSubmit, isSubmitting }: PromptFormProps) {
  const router = useRouter()
  const { tagsByType } = useTags()
  const [form] = Form.useForm()

  // 构建初始图片数组
  const initialImages: ImageData[] = prompt?.images?.map(img => ({
    image_url: img.image_url,
    thumbnail_url: img.thumbnail_url || undefined,
  })) || (prompt?.image_url ? [{
    image_url: prompt.image_url,
    thumbnail_url: prompt.thumbnail_url || undefined,
  }] : [])

  const initialValues = {
    title: prompt?.title || '',
    description: prompt?.description || '',
    prompt_text: prompt?.prompt_text || '',
    negative_prompt: prompt?.negative_prompt || '',
    images: initialImages,
    author_name: prompt?.author_name || '',
    author_wechat: prompt?.author_wechat || '',
    source: prompt?.source || 'manual',
    model: prompt?.model || '',
    is_featured: prompt?.is_featured || false,
    is_published: prompt?.is_published ?? true,
    tag_ids: prompt?.tags?.map((t) => t.id) || [],
  }

  const handleFinish = async (values: any) => {
    const images = values.images as ImageData[]

    if (!images || images.length === 0) {
      message.error('请上传至少一张图片')
      return
    }

    // 第一张图片作为封面
    const formData: PromptFormData = {
      ...values,
      image_url: images[0].image_url,
      thumbnail_url: images[0].thumbnail_url,
      images: images,
    }

    try {
      await onSubmit(formData)
    } catch (error) {
      message.error((error as Error).message)
    }
  }

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onFinish={handleFinish}
      autoComplete="off"
    >
      <Row gutter={24}>
        <Col xs={24} lg={16}>
          {/* Image Upload */}
          <Card title="作品图片" style={{ marginBottom: 24 }}>
            <Form.Item
              name="images"
              rules={[{
                validator: (_, value) => {
                  if (!value || value.length === 0) {
                    return Promise.reject('请上传至少一张图片')
                  }
                  return Promise.resolve()
                }
              }]}
            >
              <ImageUploader maxCount={9} />
            </Form.Item>
          </Card>

          {/* Prompt Text */}
          <Card title="提示词内容" style={{ marginBottom: 24 }}>
            <Form.Item
              label="提示词"
              name="prompt_text"
              rules={[{ required: true, message: '请输入提示词' }]}
            >
              <TextArea
                rows={4}
                placeholder="输入完整的提示词..."
                showCount
              />
            </Form.Item>

            <Form.Item
              label="负面提示词"
              name="negative_prompt"
            >
              <TextArea
                rows={2}
                placeholder="输入负面提示词（可选）..."
              />
            </Form.Item>

            <Form.Item
              label="描述"
              name="description"
            >
              <TextArea
                rows={2}
                placeholder="作品描述（可选）..."
              />
            </Form.Item>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          {/* Basic Info */}
          <Card title="基本信息" style={{ marginBottom: 24 }}>
            <Form.Item
              label="标题"
              name="title"
              rules={[{ required: true, message: '请输入标题' }]}
            >
              <Input placeholder="作品标题" />
            </Form.Item>

            <Form.Item
              label="来源"
              name="source"
            >
              <Select options={sourceOptions} />
            </Form.Item>

            <Form.Item
              label="作者"
              name="author_name"
            >
              <Input placeholder="作者名称" />
            </Form.Item>

            <Form.Item
              label="作者微信（内部）"
              name="author_wechat"
            >
              <Input placeholder="微信号" />
            </Form.Item>

            <Form.Item
              label="生成模型"
              name="model"
            >
              <Input placeholder="如 Midjourney v6" />
            </Form.Item>
          </Card>

          {/* Tags */}
          <Card title="标签" style={{ marginBottom: 24 }}>
            <Form.Item name="tag_ids" noStyle>
              <TagSelector tagsByType={tagsByType} />
            </Form.Item>
          </Card>

          {/* Options */}
          <Card title="发布设置" style={{ marginBottom: 24 }}>
            <Form.Item
              name="is_featured"
              valuePropName="checked"
              style={{ marginBottom: 12 }}
            >
              <Switch
                checkedChildren={<><StarOutlined /> 精选</>}
                unCheckedChildren="非精选"
              />
            </Form.Item>
            <Form.Item
              name="is_published"
              valuePropName="checked"
              style={{ marginBottom: 0 }}
            >
              <Switch
                checkedChildren={<><EyeOutlined /> 已发布</>}
                unCheckedChildren="未发布"
              />
            </Form.Item>
          </Card>
        </Col>
      </Row>

      {/* Actions */}
      <Divider />
      <Space>
        <Button
          type="primary"
          htmlType="submit"
          icon={<SaveOutlined />}
          loading={isSubmitting}
          size="large"
        >
          {prompt ? '保存修改' : '创建提示词'}
        </Button>
        <Button
          icon={<CloseOutlined />}
          onClick={() => router.back()}
          size="large"
        >
          取消
        </Button>
      </Space>
    </Form>
  )
}

// Tag Selector Component
interface TagSelectorProps {
  value?: string[]
  onChange?: (value: string[]) => void
  tagsByType?: Record<string, { id: string; name: string; color: string }[]>
}

function TagSelector({ value = [], onChange, tagsByType }: TagSelectorProps) {
  const handleToggle = (tagId: string) => {
    const newValue = value.includes(tagId)
      ? value.filter((id) => id !== tagId)
      : [...value, tagId]
    onChange?.(newValue)
  }

  if (!tagsByType || Object.keys(tagsByType).length === 0) {
    return <div style={{ color: '#666' }}>暂无标签</div>
  }

  return (
    <div>
      {Object.entries(tagsByType).map(([type, typeTags]) => (
        <div key={type} style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 12,
            color: '#666',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}>
            {type}
          </div>
          <Space wrap>
            {typeTags.map((tag) => (
              <Tag
                key={tag.id}
                color={value.includes(tag.id) ? tag.color : undefined}
                onClick={() => handleToggle(tag.id)}
                style={{
                  cursor: 'pointer',
                  opacity: value.includes(tag.id) ? 1 : 0.6,
                  borderColor: tag.color,
                }}
              >
                {tag.name}
              </Tag>
            ))}
          </Space>
        </div>
      ))}
    </div>
  )
}
