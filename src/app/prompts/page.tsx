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

const { Text } = Typography

export default function PromptsPage() {
  const { message } = App.useApp()
  const [search, setSearch] = useState('')
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [page, setPage] = useState(1)

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
      width: 120,
      render: (_, record) => (
        <Space>
          <Link href={`/prompts/${record.id}/edit`}>
            <Button type="text" icon={<EditOutlined />} />
          </Link>
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
    </AdminLayout>
  )
}
