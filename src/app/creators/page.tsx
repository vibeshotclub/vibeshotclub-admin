'use client'

import { useState } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Switch,
  Space,
  Tag,
  Typography,
  Card,
  Popconfirm,
  App,
  Avatar,
  Tooltip,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  XOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { useCreators } from '@/hooks/useCreators'
import type { TwitterCreator, TwitterCreatorFormData } from '@/types/database'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const { Text, Link } = Typography

export default function CreatorsPage() {
  const { message } = App.useApp()
  const { creators, isLoading, createCreator, updateCreator, deleteCreator } = useCreators()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCreator, setEditingCreator] = useState<TwitterCreator | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form] = Form.useForm()

  const openCreateModal = () => {
    setEditingCreator(null)
    form.setFieldsValue({
      username: '',
      display_name: '',
      description: '',
      is_active: true,
      is_vsc: false, // [修改] 默认值
    })
    setIsModalOpen(true)
  }

  const openEditModal = (creator: TwitterCreator) => {
    setEditingCreator(creator)
    form.setFieldsValue({
      username: creator.username,
      display_name: creator.display_name || '',
      description: creator.description || '',
      is_active: creator.is_active,
      is_vsc: creator.is_vsc, // [修改] 回填值
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (values: TwitterCreatorFormData) => {
    setIsSubmitting(true)
    try {
      if (editingCreator) {
        await updateCreator(editingCreator.id, values)
        message.success('创作者更新成功')
      } else {
        await createCreator(values)
        message.success('创作者添加成功')
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
      await deleteCreator(id)
      message.success('创作者删除成功')
    } catch (error) {
      message.error((error as Error).message)
    }
  }

  const handleToggleActive = async (creator: TwitterCreator) => {
    try {
      await updateCreator(creator.id, {
        username: creator.username,
        display_name: creator.display_name || undefined,
        description: creator.description || undefined,
        is_active: !creator.is_active,
        is_vsc: creator.is_vsc, // 保持原有的 vsc 状态
      })
      message.success(creator.is_active ? '已停用' : '已启用')
    } catch (error) {
      message.error((error as Error).message)
    }
  }

  const columns: ColumnsType<TwitterCreator> = [
    {
      title: '创作者',
      key: 'creator',
      width: 280,
      render: (_, record) => (
        <Space>
          <Avatar src={record.avatar_url} icon={<XOutlined />} />
          <div>
            <div>
              <Link href={`https://x.com/${record.username}`} target="_blank">
                @{record.username}
              </Link>
              {/* [新增] VSC 标识 */}
              {record.is_vsc && (
                <Tag color="purple" style={{ marginLeft: 8, fontSize: 10 }}>VSC</Tag>
              )}
            </div>
            {record.display_name && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.display_name}
              </Text>
            )}
          </div>
        </Space>
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
      title: '统计',
      key: 'stats',
      width: 150,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            抓取: {record.fetch_count} 次
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            入库: {record.success_count} 条
          </Text>
        </Space>
      ),
    },
    {
      title: '最后抓取',
      dataIndex: 'last_fetched_at',
      key: 'last_fetched_at',
      width: 150,
      render: (date) => date ? (
        <Tooltip title={dayjs(date).format('YYYY-MM-DD HH:mm:ss')}>
          <Text type="secondary">{dayjs(date).fromNow()}</Text>
        </Tooltip>
      ) : (
        <Tag>未抓取</Tag>
      ),
    },
    {
      title: '备注',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true,
      render: (text) => text || '-',
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
            description="确定要删除这个创作者吗？"
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

  const activeCount = creators.filter(c => c.is_active).length

  return (
    <AdminLayout>
      <Card
        title={
          <Space>
            <XOutlined />
            <span>Twitter 创作者</span>
            <Text type="secondary" style={{ fontSize: 14, fontWeight: 400 }}>
              共 {creators.length} 位 · 启用 {activeCount} 位
            </Text>
          </Space>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            添加创作者
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={creators}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 20 }}
          size="middle"
        />
      </Card>

      <Modal
        title={editingCreator ? '编辑创作者' : '添加创作者'}
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
            username: '',
            display_name: '',
            description: '',
            is_active: true,
            is_vsc: false, // [修改] 默认值
          }}
        >
          <Form.Item
            label="Twitter 用户名"
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { pattern: /^@?[A-Za-z0-9_]+$/, message: '用户名格式不正确' },
            ]}
            extra="输入用户名，如：@midjourney 或 midjourney"
          >
            <Input placeholder="@midjourney" disabled={!!editingCreator} />
          </Form.Item>

          <Form.Item
            label="显示名称"
            name="display_name"
          >
            <Input placeholder="Midjourney" />
          </Form.Item>

          <Form.Item
            label="备注"
            name="description"
          >
            <Input.TextArea placeholder="可选备注信息" rows={2} />
          </Form.Item>

          {/* [新增] VSC 成员开关 */}
          <Form.Item
            label="VSC 成员"
            name="is_vsc"
            valuePropName="checked"
            tooltip="开启后标记为 Vibe Shot Club 成员"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            label="启用抓取"
            name="is_active"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalOpen(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={isSubmitting}>
                {editingCreator ? '保存' : '添加'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </AdminLayout>
  )
}