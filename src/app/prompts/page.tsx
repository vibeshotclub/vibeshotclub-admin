'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Table,
  Button,
  Input,
  Space,
  Tag,
  Avatar,
  Typography,
  Popconfirm,
  App,
  Card,
  Modal,
  Image,
  Divider,
} from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  StarFilled,
  EyeOutlined,
  CopyOutlined,
} from '@ant-design/icons'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { usePrompts } from '@/hooks/usePrompts'
import { useTags } from '@/hooks/useTags'
import type { PromptWithTags } from '@/types/database'

const { Text, Title, Paragraph } = Typography

export default function PromptsPage() {
  const { message } = App.useApp()
  const [search, setSearch] = useState('')
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [page, setPage] = useState(1)
  const [previewPrompt, setPreviewPrompt] = useState<PromptWithTags | null>(null)

  const { prompts, pagination, isLoading, deletePrompt } = usePrompts({
    page,
    limit: 20,
    search: search || undefined,
    tag: selectedTag || undefined,
  })
  const { tags } = useTags()

  const handleDelete = async (id: string) => {
    try {
      await deletePrompt(id)
      message.success('删除成功')
    } catch (error) {
      message.error((error as Error).message)
    }
  }

  const handleTableChange = (paginationConfig: TablePaginationConfig) => {
    setPage(paginationConfig.current || 1)
  }

  const columns: ColumnsType<PromptWithTags> = [
    {
      title: '图片',
      dataIndex: 'thumbnail_url',
      key: 'thumbnail',
      width: 80,
      render: (url, record) => (
        <Avatar
          shape="square"
          size={64}
          src={url}
          style={{ background: '#1f1f1f' }}
        />
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      render: (title, record) => (
        <Space>
          <Link href={`/prompts/${record.id}/edit`}>
            <Text strong>{title}</Text>
          </Link>
          {record.is_featured && (
            <StarFilled style={{ color: '#faad14' }} />
          )}
          {!record.is_published && (
            <Tag>未发布</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '提示词',
      dataIndex: 'prompt_text',
      key: 'prompt_text',
      width: 300,
      render: (text) => (
        <Space>
          <Text type="secondary" ellipsis style={{ maxWidth: 220 }}>
            {text?.length > 50 ? `${text.slice(0, 50)}...` : text}
          </Text>
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => {
              navigator.clipboard.writeText(text || '')
              message.success('已复制提示词')
            }}
          />
        </Space>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 200,
      render: (tags) => (
        <Space wrap size={[8, 8]}>
          {tags?.slice(0, 3).map((tag: { id: string; name: string; color: string }) => (
            <Tag key={tag.id} color={tag.color}>
              {tag.name}
            </Tag>
          ))}
          {tags?.length > 3 && (
            <Tag>+{tags.length - 3}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '浏览',
      dataIndex: 'view_count',
      key: 'view_count',
      width: 80,
      render: (count) => (
        <Space>
          <EyeOutlined />
          {count}
        </Space>
      ),
    },
    {
      title: '作者',
      dataIndex: 'author_name',
      key: 'author_name',
      width: 100,
      render: (name) => name ? <Text type="secondary">@{name}</Text> : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Link href={`/prompts/${record.id}/edit`}>
            <Button type="text" icon={<EditOutlined />} />
          </Link>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => setPreviewPrompt(record)}
          />
          <Popconfirm
            title="确认删除"
            description="确定要删除这个提示词吗？此操作无法撤销。"
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
            <span>提示词管理</span>
            <Text type="secondary" style={{ fontSize: 14, fontWeight: 400 }}>
              共 {pagination?.total || 0} 条
            </Text>
          </Space>
        }
        extra={
          <Link href="/prompts/new">
            <Button type="primary" icon={<PlusOutlined />}>
              添加提示词
            </Button>
          </Link>
        }
      >
        {/* Filters */}
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="搜索标题、提示词或作者..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            style={{ width: 300 }}
            allowClear
          />
          <Space wrap>
            <Tag.CheckableTag
              checked={!selectedTag}
              onChange={() => {
                setSelectedTag('')
                setPage(1)
              }}
            >
              全部
            </Tag.CheckableTag>
            {tags.slice(0, 8).map((tag) => (
              <Tag.CheckableTag
                key={tag.id}
                checked={selectedTag === tag.id}
                onChange={() => {
                  setSelectedTag(selectedTag === tag.id ? '' : tag.id)
                  setPage(1)
                }}
                style={{
                  borderColor: tag.color,
                  color: selectedTag === tag.id ? '#fff' : tag.color,
                  backgroundColor: selectedTag === tag.id ? tag.color : 'transparent',
                }}
              >
                {tag.name}
              </Tag.CheckableTag>
            ))}
          </Space>
        </Space>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={prompts}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 900 }}
          pagination={{
            current: page,
            pageSize: 20,
            total: pagination?.total || 0,
            showSizeChanger: false,
            showTotal: (total, range) => `${range[0]}-${range[1]} / ${total}`,
          }}
          onChange={handleTableChange}
        />
      </Card>

      {/* Preview Modal */}
      <Modal
        title={previewPrompt?.title}
        open={!!previewPrompt}
        onCancel={() => setPreviewPrompt(null)}
        footer={
          <Space>
            <Button key="copy" icon={<CopyOutlined />} onClick={() => {
              navigator.clipboard.writeText(previewPrompt?.prompt_text || '')
              message.success('已复制提示词')
            }}>
              复制提示词
            </Button>
            <Link key="edit" href={`/prompts/${previewPrompt?.id}/edit`}>
              <Button type="primary" icon={<EditOutlined />}>
                编辑
              </Button>
            </Link>
          </Space>
        }
        width={800}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        {previewPrompt && (
          <div>
            {/* Images */}
            <div style={{ marginBottom: 24 }}>
              {previewPrompt.images && previewPrompt.images.length > 1 ? (
                <Image.PreviewGroup>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {previewPrompt.images.map((img, index) => (
                      <Image
                        key={index}
                        src={img.thumbnail_url || img.image_url}
                        alt={`${previewPrompt.title} - ${index + 1}`}
                        style={{ borderRadius: 8, aspectRatio: '1', objectFit: 'cover' }}
                        preview={{ src: img.image_url }}
                      />
                    ))}
                  </div>
                </Image.PreviewGroup>
              ) : (
                <Image
                  src={previewPrompt.image_url}
                  alt={previewPrompt.title}
                  style={{ maxWidth: '100%', borderRadius: 8 }}
                  preview={{ src: previewPrompt.image_url }}
                />
              )}
            </div>

            {/* Tags */}
            {previewPrompt.tags && previewPrompt.tags.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <Space wrap size={[8, 8]}>
                  {previewPrompt.tags.map((tag) => (
                    <Tag key={tag.id} color={tag.color}>{tag.name}</Tag>
                  ))}
                </Space>
              </div>
            )}

            {/* Prompt Text */}
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>提示词</Text>
              <Paragraph
                copyable
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  padding: 12,
                  borderRadius: 8,
                  marginTop: 4,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {previewPrompt.prompt_text}
              </Paragraph>
            </div>

            {/* Negative Prompt */}
            {previewPrompt.negative_prompt && (
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>负面提示词</Text>
                <Paragraph
                  copyable
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    padding: 12,
                    borderRadius: 8,
                    marginTop: 4,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {previewPrompt.negative_prompt}
                </Paragraph>
              </div>
            )}

            <Divider style={{ margin: '16px 0' }} />

            {/* Meta Info */}
            <Space separator={<span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>} wrap>
              {previewPrompt.model && (
                <Text type="secondary">模型: {previewPrompt.model}</Text>
              )}
              {previewPrompt.author_name && (
                <Text type="secondary">作者: @{previewPrompt.author_name}</Text>
              )}
              <Text type="secondary">浏览: {previewPrompt.view_count}</Text>
              {previewPrompt.is_featured && (
                <Text style={{ color: '#faad14' }}><StarFilled /> 精选</Text>
              )}
            </Space>
          </div>
        )}
      </Modal>
    </AdminLayout>
  )
}
