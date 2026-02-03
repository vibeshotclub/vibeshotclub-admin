'use client'

import { useState } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Radio,
  Space,
  Tag,
  Typography,
  Card,
  Popconfirm,
  App,
  Avatar,
  Tooltip,
  DatePicker,
} from 'antd'
import {
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  CrownOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { useUsers } from '@/hooks/useUsers'
import type { User, UserFormData } from '@/types/database'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

dayjs.locale('zh-cn')

const { Text } = Typography

export default function UsersPage() {
  const { message } = App.useApp()
  const { users, isLoading, updateUser, deleteUser } = useUsers()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form] = Form.useForm()

  // 判断VSC会员是否有效（未过期）
  const isVSCValid = (user: User) => {
    if (!user.is_vsc) return false
    if (!user.membership_expires_at) return true // 永久会员
    return dayjs(user.membership_expires_at).isAfter(dayjs())
  }

  const openEditModal = (user: User) => {
    setEditingUser(user)
    form.setFieldsValue({
      username: user.username || '',
      email: user.email || '',
      member_type: user.is_vsc ? 'vsc_member' : 'user',
      membership_expires_at: user.membership_expires_at ? dayjs(user.membership_expires_at) : null,
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (values: {
    username?: string
    email?: string
    member_type: 'user' | 'vsc_member'
    membership_expires_at?: dayjs.Dayjs | null
  }) => {
    if (!editingUser) return

    setIsSubmitting(true)
    try {
      const is_vsc = values.member_type === 'vsc_member'
      const roles = is_vsc ? ['vsc_member'] : ['user']
      const formData: UserFormData = {
        username: values.username,
        email: values.email,
        roles,
        is_vsc,
        membership_expires_at: is_vsc && values.membership_expires_at
          ? values.membership_expires_at.toISOString()
          : null,
      }
      await updateUser(editingUser.id, formData)
      message.success('用户更新成功')
      setIsModalOpen(false)
    } catch (error) {
      message.error((error as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteUser(id)
      message.success('用户删除成功')
    } catch (error) {
      message.error((error as Error).message)
    }
  }

  // 格式化会员有效期
  const formatMembershipExpiry = (user: User) => {
    if (!user.is_vsc) return '-'
    if (!user.membership_expires_at) return '永久'
    const expiry = dayjs(user.membership_expires_at)
    const now = dayjs()
    if (expiry.isBefore(now)) {
      return <Text type="danger">已过期 ({expiry.format('YYYY-MM-DD')})</Text>
    }
    return expiry.format('YYYY-MM-DD')
  }

  const columns: ColumnsType<User> = [
    {
      title: '头像',
      dataIndex: 'avatar_url',
      key: 'avatar',
      width: 70,
      render: (url) => (
        <Avatar
          src={url}
          icon={<UserOutlined />}
          size={40}
          style={{ backgroundColor: url ? undefined : '#8b5cf6' }}
        />
      ),
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 180,
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text || record.nickname || '-'}</div>
          {record.phone && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.phone}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 220,
      render: (text) => text || <Text type="secondary">-</Text>,
    },
    {
      title: '用户类型',
      key: 'role',
      width: 120,
      render: (_, record) =>
        isVSCValid(record) ? (
          <Tag icon={<CrownOutlined />} color="gold">
            VSC会员
          </Tag>
        ) : (
          <Tag color="default">普通用户</Tag>
        ),
    },
    {
      title: 'VSC有效期',
      key: 'membership_expires_at',
      width: 140,
      render: (_, record) => formatMembershipExpiry(record),
    },
    {
      title: '积分',
      key: 'points',
      width: 100,
      render: (_, record) => (
        <Tooltip title={`累计: ${record.points_total}`}>
          <Text>{record.points_balance}</Text>
        </Tooltip>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          />
          <Popconfirm
            title="确认删除"
            description="确定要删除这个用户吗？此操作不可恢复。"
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

  const vscMemberCount = users.filter(u => isVSCValid(u)).length

  return (
    <AdminLayout>
      <Card
        title={
          <Space>
            <UserOutlined />
            <span>用户管理</span>
            <Text type="secondary" style={{ fontSize: 14, fontWeight: 400 }}>
              共 {users.length} 位用户 · VSC会员 {vscMemberCount} 位
            </Text>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 20 }}
          size="middle"
          scroll={{ x: 1000 }}
        />
      </Card>

      <Modal
        title="编辑用户"
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
        >
          <Form.Item
            label="用户名"
            name="username"
          >
            <Input placeholder="用户名" />
          </Form.Item>

          <Form.Item
            label="Email"
            name="email"
            rules={[
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input placeholder="email@example.com" />
          </Form.Item>

          <Form.Item
            label="用户类型"
            name="roles"
            rules={[{ required: true, message: '请选择用户类型' }]}
          >
            <Radio.Group>
              <Radio value="user">普通用户</Radio>
              <Radio value="vsc_member">VSC会员</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.member_type !== currentValues.member_type}
          >
            {({ getFieldValue }) =>
              getFieldValue('member_type') === 'vsc_member' && (
                <Form.Item
                  label="VSC会员有效期"
                  name="membership_expires_at"
                  extra="留空表示永久会员"
                >
                  <DatePicker
                    style={{ width: '100%' }}
                    placeholder="选择到期日期（留空为永久）"
                    allowClear
                  />
                </Form.Item>
              )
            }
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalOpen(false)}>
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