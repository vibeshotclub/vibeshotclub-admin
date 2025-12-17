'use client'

import { useState } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  InputNumber,
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
  RobotOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { useModels } from '@/hooks/useModels'
import type { AIModel, AIModelFormData, AIModelCategory } from '@/types/database'

const { Text } = Typography

export default function ModelsPage() {
  const { message } = App.useApp()
  const { models, grouped, isLoading, createModel, updateModel, deleteModel } = useModels()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<AIModel | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form] = Form.useForm()

  const openCreateModal = () => {
    setEditingModel(null)
    form.setFieldsValue({
      id: '',
      name: '',
      vendor: '',
      category: 'closed',
      is_active: true,
      sort_order: 0,
    })
    setIsModalOpen(true)
  }

  const openEditModal = (model: AIModel) => {
    setEditingModel(model)
    form.setFieldsValue({
      id: model.id,
      name: model.name,
      vendor: model.vendor,
      category: model.category,
      is_active: model.is_active,
      sort_order: model.sort_order,
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (values: AIModelFormData) => {
    setIsSubmitting(true)
    try {
      if (editingModel) {
        await updateModel(editingModel.id, values)
        message.success('模型更新成功')
      } else {
        await createModel(values)
        message.success('模型创建成功')
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
      await deleteModel(id)
      message.success('模型删除成功')
    } catch (error) {
      message.error((error as Error).message)
    }
  }

  const handleToggleActive = async (model: AIModel) => {
    try {
      await updateModel(model.id, {
        ...model,
        is_active: !model.is_active,
      })
      message.success(model.is_active ? '已停用' : '已启用')
    } catch (error) {
      message.error((error as Error).message)
    }
  }

  const columns: ColumnsType<AIModel> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 200,
      render: (id) => <Text code copyable={{ text: id }}>{id}</Text>,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
    },
    {
      title: '厂商',
      dataIndex: 'vendor',
      key: 'vendor',
      width: 120,
      render: (vendor) => <Tag>{vendor}</Tag>,
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (category: AIModelCategory) => (
        <Tag color={category === 'closed' ? 'purple' : 'green'}>
          {category === 'closed' ? '闭源' : '开源'}
        </Tag>
      ),
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
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 80,
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
            description="确定要删除这个模型吗？"
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

  const tabItems = [
    {
      key: 'closed',
      label: `闭源模型 (${grouped?.closed?.length || 0})`,
      children: (
        <Table
          columns={columns}
          dataSource={grouped?.closed || []}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          size="middle"
          scroll={{ y: 500 }}
        />
      ),
    },
    {
      key: 'open',
      label: `开源模型 (${grouped?.open?.length || 0})`,
      children: (
        <Table
          columns={columns}
          dataSource={grouped?.open || []}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          size="middle"
          scroll={{ y: 500 }}
        />
      ),
    },
  ]

  return (
    <AdminLayout>
      <Card
        title={
          <Space>
            <RobotOutlined />
            <span>模型管理</span>
            <Text type="secondary" style={{ fontSize: 14, fontWeight: 400 }}>
              共 {models.length} 个模型
            </Text>
          </Space>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            添加模型
          </Button>
        }
      >
        <Tabs items={tabItems} />
      </Card>

      <Modal
        title={editingModel ? '编辑模型' : '添加模型'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        forceRender
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            id: '',
            name: '',
            vendor: '',
            category: 'closed',
            is_active: true,
            sort_order: 0,
          }}
        >
          <Form.Item
            label="模型 ID"
            name="id"
            rules={[
              { required: true, message: '请输入模型 ID' },
              { pattern: /^[a-z0-9-_.]+$/, message: '只能包含小写字母、数字、横线、下划线和点' },
            ]}
            extra="唯一标识符，如：midjourney-v7, flux-1.1-pro"
          >
            <Input placeholder="如：midjourney-v7" disabled={!!editingModel} />
          </Form.Item>

          <Form.Item
            label="模型名称"
            name="name"
            rules={[{ required: true, message: '请输入模型名称' }]}
          >
            <Input placeholder="如：Midjourney V7" />
          </Form.Item>

          <Form.Item
            label="厂商"
            name="vendor"
            rules={[{ required: true, message: '请输入厂商' }]}
          >
            <Input placeholder="如：Midjourney, OpenAI" />
          </Form.Item>

          <Form.Item
            label="类别"
            name="category"
            rules={[{ required: true, message: '请选择类别' }]}
          >
            <Select
              options={[
                { value: 'closed', label: '闭源' },
                { value: 'open', label: '开源' },
              ]}
            />
          </Form.Item>

          <Space style={{ width: '100%' }} size="large">
            <Form.Item
              label="排序"
              name="sort_order"
              style={{ marginBottom: 0 }}
            >
              <InputNumber min={0} style={{ width: 120 }} />
            </Form.Item>

            <Form.Item
              label="启用"
              name="is_active"
              valuePropName="checked"
              style={{ marginBottom: 0 }}
            >
              <Switch />
            </Form.Item>
          </Space>

          <Form.Item style={{ marginBottom: 0, marginTop: 24, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalOpen(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={isSubmitting}>
                {editingModel ? '保存' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </AdminLayout>
  )
}
