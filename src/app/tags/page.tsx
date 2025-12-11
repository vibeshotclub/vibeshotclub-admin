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
  Divider,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FolderOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { Color } from 'antd/es/color-picker'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { useTags } from '@/hooks/useTags'
import { useTagTypes } from '@/hooks/useTagTypes'
import type { Tag as TagItem, TagType } from '@/types/database'

const { Text } = Typography

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
  const { tagTypes, isLoading: tagTypesLoading, createTagType, updateTagType, deleteTagType } = useTagTypes()

  // Tag Modal
  const [isTagModalOpen, setIsTagModalOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<TagItem | null>(null)
  const [isTagSubmitting, setIsTagSubmitting] = useState(false)
  const [tagForm] = Form.useForm()

  // TagType Modal
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false)
  const [editingType, setEditingType] = useState<TagType | null>(null)
  const [isTypeSubmitting, setIsTypeSubmitting] = useState(false)
  const [typeForm] = Form.useForm()

  // Tag handlers
  const openCreateTagModal = () => {
    setEditingTag(null)
    tagForm.setFieldsValue({ name: '', type_id: tagTypes[0]?.id, color: '#3b82f6' })
    setIsTagModalOpen(true)
  }

  const openEditTagModal = (tag: TagItem) => {
    setEditingTag(tag)
    tagForm.setFieldsValue({ name: tag.name, type_id: tag.type_id, color: tag.color })
    setIsTagModalOpen(true)
  }

  const handleTagSubmit = async (values: { name: string; type_id: string; color: string | Color }) => {
    setIsTagSubmitting(true)
    try {
      const color = typeof values.color === 'string'
        ? values.color
        : values.color.toHexString()

      const formData = { name: values.name, type_id: values.type_id, color }

      if (editingTag) {
        await updateTag(editingTag.id, formData)
        message.success('标签更新成功')
      } else {
        await createTag(formData)
        message.success('标签创建成功')
      }
      setIsTagModalOpen(false)
    } catch (error) {
      message.error((error as Error).message)
    } finally {
      setIsTagSubmitting(false)
    }
  }

  const handleTagDelete = async (id: string) => {
    try {
      await deleteTag(id)
      message.success('标签删除成功')
    } catch (error) {
      message.error((error as Error).message)
    }
  }

  // TagType handlers
  const openCreateTypeModal = () => {
    setEditingType(null)
    typeForm.setFieldsValue({ name: '', slug: '', color: '#3b82f6' })
    setIsTypeModalOpen(true)
  }

  const openEditTypeModal = (type: TagType) => {
    setEditingType(type)
    typeForm.setFieldsValue({ name: type.name, slug: type.slug, color: type.color })
    setIsTypeModalOpen(true)
  }

  const handleTypeSubmit = async (values: { name: string; slug: string; color: string | Color }) => {
    setIsTypeSubmitting(true)
    try {
      const color = typeof values.color === 'string'
        ? values.color
        : values.color.toHexString()

      const formData = { name: values.name, slug: values.slug, color }

      if (editingType) {
        await updateTagType(editingType.id, formData)
        message.success('标签组更新成功')
      } else {
        await createTagType(formData)
        message.success('标签组创建成功')
      }
      setIsTypeModalOpen(false)
    } catch (error) {
      message.error((error as Error).message)
    } finally {
      setIsTypeSubmitting(false)
    }
  }

  const handleTypeDelete = async (id: string) => {
    try {
      await deleteTagType(id)
      message.success('标签组删除成功')
    } catch (error) {
      message.error((error as Error).message)
    }
  }

  // Tag columns
  const tagColumns: ColumnsType<TagItem> = [
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
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditTagModal(record)}
          />
          <Popconfirm
            title="确认删除"
            description="确定要删除这个标签吗？关联此标签的提示词将不再显示该标签。"
            onConfirm={() => handleTagDelete(record.id)}
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

  // TagType columns
  const typeColumns: ColumnsType<TagType> = [
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
    },
    {
      title: '标识符',
      dataIndex: 'slug',
      key: 'slug',
      render: (slug) => <Text type="secondary" code>{slug}</Text>,
    },
    {
      title: '标签数',
      key: 'count',
      width: 80,
      render: (_, record) => tagsByType?.[record.slug]?.length || 0,
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
            onClick={() => openEditTypeModal(record)}
          />
          <Popconfirm
            title="确认删除"
            description="确定要删除这个标签组吗？需要先清空该组下的所有标签。"
            onConfirm={() => handleTypeDelete(record.id)}
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

  // Tab items for tags by type
  const tagTabItems = tagTypes.map((type) => ({
    key: type.slug,
    label: `${type.name} (${tagsByType?.[type.slug]?.length || 0})`,
    children: (
      <Table
        columns={tagColumns}
        dataSource={tagsByType?.[type.slug] || []}
        rowKey="id"
        loading={isLoading}
        pagination={false}
        size="middle"
      />
    ),
  }))

  return (
    <AdminLayout>
      {/* Tag Types Management */}
      <Card
        title={
          <Space>
            <FolderOutlined />
            <span>标签组管理</span>
            <Text type="secondary" style={{ fontSize: 14, fontWeight: 400 }}>
              共 {tagTypes.length} 个分组
            </Text>
          </Space>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateTypeModal}>
            添加标签组
          </Button>
        }
        style={{ marginBottom: 24 }}
      >
        <Table
          columns={typeColumns}
          dataSource={tagTypes}
          rowKey="id"
          loading={tagTypesLoading}
          pagination={false}
          size="middle"
        />
      </Card>

      {/* Tags Management */}
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
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateTagModal}>
            添加标签
          </Button>
        }
      >
        {tags.length === 0 && !isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Text type="secondary">暂无标签，点击上方按钮添加</Text>
          </div>
        ) : (
          <Tabs items={tagTabItems} />
        )}
      </Card>

      {/* Tag Modal */}
      <Modal
        title={editingTag ? '编辑标签' : '添加标签'}
        open={isTagModalOpen}
        onCancel={() => setIsTagModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form
          form={tagForm}
          layout="vertical"
          onFinish={handleTagSubmit}
          initialValues={{ name: '', type_id: '', color: '#3b82f6' }}
        >
          <Form.Item
            label="标签名称"
            name="name"
            rules={[{ required: true, message: '请输入标签名称' }]}
          >
            <Input placeholder="输入标签名称" />
          </Form.Item>

          <Form.Item
            label="所属分组"
            name="type_id"
            rules={[{ required: true, message: '请选择所属分组' }]}
          >
            <Select
              options={tagTypes.map(t => ({ value: t.id, label: t.name }))}
              placeholder="选择标签分组"
            />
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
              <Button onClick={() => setIsTagModalOpen(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={isTagSubmitting}>
                {editingTag ? '保存' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* TagType Modal */}
      <Modal
        title={editingType ? '编辑标签组' : '添加标签组'}
        open={isTypeModalOpen}
        onCancel={() => setIsTypeModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form
          form={typeForm}
          layout="vertical"
          onFinish={handleTypeSubmit}
          initialValues={{ name: '', slug: '', color: '#3b82f6' }}
        >
          <Form.Item
            label="分组名称"
            name="name"
            rules={[{ required: true, message: '请输入分组名称' }]}
          >
            <Input placeholder="如：风格、主题" />
          </Form.Item>

          <Form.Item
            label="标识符 (slug)"
            name="slug"
            rules={[
              { required: true, message: '请输入标识符' },
              { pattern: /^[a-z0-9-]+$/, message: '只能包含小写字母、数字和横线' }
            ]}
          >
            <Input placeholder="如：style、topic (只能小写字母)" />
          </Form.Item>

          <Form.Item
            label="分组颜色"
            name="color"
          >
            <ColorPicker
              presets={[{ label: '预设颜色', colors: defaultColors }]}
              showText
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsTypeModalOpen(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={isTypeSubmitting}>
                {editingType ? '保存' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </AdminLayout>
  )
}
