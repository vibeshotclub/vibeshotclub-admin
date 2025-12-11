'use client'

import { useState } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  ColorPicker,
  Space,
  Tag,
  Typography,
  Card,
  Popconfirm,
  App,
  Tabs,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { Color } from 'antd/es/color-picker'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { useTags } from '@/hooks/useTags'
import type { Tag as TagType, TagFormData, TagType as TagTypeEnum } from '@/types/database'

const { Text, Title } = Typography

const typeOptions = [
  { value: 'style', label: '风格' },
  { value: 'topic', label: '主题' },
  { value: 'tool', label: '工具' },
  { value: 'quality', label: '质量' },
]

const typeLabels: Record<string, string> = {
  style: '风格',
  topic: '主题',
  tool: '工具',
  quality: '质量',
}

const defaultColors = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // yellow
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
]

export default function TagsPage() {
  const { message } = App.useApp()
  const { tags, tagsByType, isLoading, createTag, updateTag, deleteTag } = useTags()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<TagType | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form] = Form.useForm()

  const openCreateModal = () => {
    setEditingTag(null)
    form.setFieldsValue({ name: '', type: 'style', color: '#3b82f6' })
    setIsModalOpen(true)
  }

  const openEditModal = (tag: TagType) => {
    setEditingTag(tag)
    form.setFieldsValue({ name: tag.name, type: tag.type, color: tag.color })
    setIsModalOpen(true)
  }

  const handleSubmit = async (values: TagFormData) => {
    setIsSubmitting(true)
    try {
      // 处理 ColorPicker 返回的值
      const color = typeof values.color === 'string'
        ? values.color
        : (values.color as Color).toHexString()

      const formData = { ...values, color }

      if (editingTag) {
        await updateTag(editingTag.id, formData)
        message.success('标签更新成功')
      } else {
        await createTag(formData)
        message.success('标签创建成功')
      }
      setIsModalOpen(false)
    } catch (error) {
      message.error((error as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteTag(id)
      message.success('标签删除成功')
    } catch (error) {
      message.error((error as Error).message)
    }
  }

  const columns: ColumnsType<TagType> = [
    {
      title: '颜色',
      dataIndex: 'color',
      key: 'color',
      width: 60,
      render: (color) => (
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            backgroundColor: color,
          }}
        />
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Tag color={record.color}>{name}</Tag>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => typeLabels[type] || type,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          />
          <Popconfirm
            title="确认删除"
            description="确定要删除这个标签吗？关联此标签的提示词将不再显示该标签。"
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

  // 为 Tabs 准备数据
  const tabItems = Object.entries(tagsByType || {}).map(([type, typeTags]) => ({
    key: type,
    label: `${typeLabels[type]} (${typeTags.length})`,
    children: (
      <Table
        columns={columns}
        dataSource={typeTags}
        rowKey="id"
        loading={isLoading}
        pagination={false}
        size="middle"
      />
    ),
  }))

  return (
    <AdminLayout>
      <Card
        title={
          <Space>
            <span>标签管理</span>
            <Text type="secondary" style={{ fontSize: 14, fontWeight: 400 }}>
              共 {tags.length} 个标签
            </Text>
          </Space>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            添加标签
          </Button>
        }
      >
        {tags.length === 0 && !isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Text type="secondary">暂无标签，点击上方按钮添加</Text>
          </div>
        ) : (
          <Tabs items={tabItems} />
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editingTag ? '编辑标签' : '添加标签'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ name: '', type: 'style', color: '#3b82f6' }}
        >
          <Form.Item
            label="标签名称"
            name="name"
            rules={[{ required: true, message: '请输入标签名称' }]}
          >
            <Input placeholder="输入标签名称" />
          </Form.Item>

          <Form.Item
            label="标签类型"
            name="type"
            rules={[{ required: true, message: '请选择标签类型' }]}
          >
            <Select options={typeOptions} />
          </Form.Item>

          <Form.Item
            label="标签颜色"
            name="color"
          >
            <ColorPicker
              presets={[{ label: '预设颜色', colors: defaultColors }]}
              showText
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalOpen(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={isSubmitting}>
                {editingTag ? '保存' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </AdminLayout>
  )
}
