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
  DatePicker,
  Dropdown,
  Spin,
  Popover,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  XOutlined,
  DownOutlined,
  SyncOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { MenuProps } from 'antd'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { useCreators } from '@/hooks/useCreators'
import type { TwitterCreator, TwitterCreatorFormData } from '@/types/database'
import dayjs, { Dayjs } from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const { Text, Link } = Typography
const { TextArea } = Input

export default function CreatorsPage() {
  const { message } = App.useApp()
  const { creators, isLoading, createCreator, updateCreator, deleteCreator, mutate } = useCreators()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCreator, setEditingCreator] = useState<TwitterCreator | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form] = Form.useForm()

  // 手动抓取相关状态
  const [crawlingCreatorId, setCrawlingCreatorId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null)
  const [datePickerOpen, setDatePickerOpen] = useState<string | null>(null)

  // 备注编辑相关状态
  const [editingDescriptionId, setEditingDescriptionId] = useState<string | null>(null)
  const [editingDescriptionValue, setEditingDescriptionValue] = useState<string>('')
  const [savingDescription, setSavingDescription] = useState(false)

  const openCreateModal = () => {
    setEditingCreator(null)
    form.setFieldsValue({
      username: '',
      display_name: '',
      avatar_url: '',
      x_url: '',
      xiaohongshu_url: '',
      description: '',
      is_active: true,
      is_vsc: false,
    })
    setIsModalOpen(true)
  }

  const openEditModal = (creator: TwitterCreator) => {
    setEditingCreator(creator)
    form.setFieldsValue({
      username: creator.username,
      display_name: creator.display_name || '',
      avatar_url: creator.avatar_url || '',
      x_url: creator.x_url || `https://x.com/${creator.username}`,
      xiaohongshu_url: creator.xiaohongshu_url || '',
      description: creator.description || '',
      is_active: creator.is_active,
      is_vsc: creator.is_vsc,
    })
    setIsModalOpen(true)
  }

  // 当用户名变化时自动更新 x_url
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const username = e.target.value.trim().replace(/^@/, '')
    if (username) {
      form.setFieldValue('x_url', `https://x.com/${username}`)
    }
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
        x_url: creator.x_url || undefined,
        description: creator.description || undefined,
        is_active: !creator.is_active,
        is_vsc: creator.is_vsc,
      })
      message.success(creator.is_active ? '已停用' : '已启用')
    } catch (error) {
      message.error((error as Error).message)
    }
  }

  // 保存备注
  const handleSaveDescription = async (creator: TwitterCreator) => {
    setSavingDescription(true)
    try {
      await updateCreator(creator.id, {
        username: creator.username,
        display_name: creator.display_name || undefined,
        x_url: creator.x_url || undefined,
        description: editingDescriptionValue || undefined,
        is_active: creator.is_active,
        is_vsc: creator.is_vsc,
      })
      message.success('备注已保存')
      setEditingDescriptionId(null)
    } catch (error) {
      message.error((error as Error).message)
    } finally {
      setSavingDescription(false)
    }
  }

  // 手动抓取功能
  const handleManualCrawl = async (creator: TwitterCreator, sinceDate: Dayjs) => {
    setCrawlingCreatorId(creator.id)
    setDatePickerOpen(null)
    
    try {
      const response = await fetch('/api/creators/crawl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creator_id: creator.id,
          username: creator.username,
          since_date: sinceDate.format('YYYY-MM-DD'),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '抓取失败')
      }

      message.success(
        `抓取完成: 发现 ${result.tweets_found} 条推文, 入库 ${result.prompts_created} 条` +
        (result.duplicates_skipped > 0 ? `, 跳过重复 ${result.duplicates_skipped} 条` : '') +
        (result.images_failed > 0 ? `, 图片失败 ${result.images_failed} 条` : '')
      )
      
      // 刷新列表
      mutate()
    } catch (error) {
      message.error((error as Error).message)
    } finally {
      setCrawlingCreatorId(null)
      setSelectedDate(null)
    }
  }

  // 日期选择菜单
  const getCrawlMenuItems = (creator: TwitterCreator): MenuProps['items'] => {
    const presets: MenuProps['items'] = [
      {
        key: 'today',
        label: '今天',
        onClick: () => handleManualCrawl(creator, dayjs().startOf('day')),
      },
      {
        key: '3days',
        label: '最近3天',
        onClick: () => handleManualCrawl(creator, dayjs().subtract(3, 'day').startOf('day')),
      },
      {
        key: '7days',
        label: '最近7天',
        onClick: () => handleManualCrawl(creator, dayjs().subtract(7, 'day').startOf('day')),
      },
      {
        key: '30days',
        label: '最近30天',
        onClick: () => handleManualCrawl(creator, dayjs().subtract(30, 'day').startOf('day')),
      },
      {
        type: 'divider',
      },
      {
        key: 'custom',
        label: '自定义日期...',
        onClick: () => setDatePickerOpen(creator.id),
      },
    ]
    return presets
  }

  // 备注编辑弹出框内容
  const renderDescriptionEditor = (creator: TwitterCreator) => (
    <div style={{ width: 300 }}>
      <TextArea
        value={editingDescriptionValue}
        onChange={(e) => setEditingDescriptionValue(e.target.value)}
        rows={6}
        placeholder="输入备注信息..."
        style={{ marginBottom: 8 }}
      />
      <div style={{ textAlign: 'right' }}>
        <Space>
          <Button 
            size="small" 
            onClick={() => setEditingDescriptionId(null)}
          >
            取消
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<SaveOutlined />}
            loading={savingDescription}
            onClick={() => handleSaveDescription(creator)}
          >
            保存
          </Button>
        </Space>
      </div>
    </div>
  )

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
              {record.username ? (
                <Link href={record.x_url || `https://x.com/${record.username}`} target="_blank">
                  @{record.username}
                </Link>
              ) : (
                <Text>{record.display_name || '未知用户'}</Text>
              )}
              {record.is_vsc && (
                <Tag color="purple" style={{ marginLeft: 8, fontSize: 10 }}>VSC</Tag>
              )}
            </div>
            {record.username && record.display_name && (
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            抓取: {record.fetch_count} 次
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            入库: {record.success_count} 条
          </Text>
        </div>
      ),
    },
    {
      title: '最后抓取',
      dataIndex: 'last_fetched_at',
      key: 'last_fetched_at',
      width: 120,
      render: (date) => date ? (
        <Tooltip title={dayjs(date).format('YYYY-MM-DD HH:mm:ss')}>
          <Text type="secondary">{dayjs(date).fromNow()}</Text>
        </Tooltip>
      ) : (
        <Tag>未抓取</Tag>
      ),
    },
    {
      title: '手动抓取',
      key: 'manual_crawl',
      width: 140,
      render: (_, record) => (
        <Space>
          {crawlingCreatorId === record.id ? (
            <Spin size="small" />
          ) : (
            <>
              <Dropdown
                menu={{ items: getCrawlMenuItems(record) }}
                trigger={['click']}
              >
                <Button 
                  size="small" 
                  icon={<SyncOutlined />}
                >
                  抓取 <DownOutlined />
                </Button>
              </Dropdown>
              {datePickerOpen === record.id && (
                <DatePicker
                  open={true}
                  value={selectedDate}
                  onChange={(date) => {
                    if (date) {
                      setSelectedDate(date)
                      handleManualCrawl(record, date)
                    }
                  }}
                  onOpenChange={(open) => {
                    if (!open) {
                      setDatePickerOpen(null)
                      setSelectedDate(null)
                    }
                  }}
                  disabledDate={(current) => current && current > dayjs().endOf('day')}
                  style={{ width: 0, height: 0, padding: 0, border: 'none', position: 'absolute' }}
                />
              )}
            </>
          )}
        </Space>
      ),
    },
    {
      title: '备注',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      render: (text, record) => (
        <Popover
          content={renderDescriptionEditor(record)}
          title="编辑备注"
          trigger="click"
          open={editingDescriptionId === record.id}
          onOpenChange={(open) => {
            if (open) {
              setEditingDescriptionId(record.id)
              setEditingDescriptionValue(record.description || '')
            } else {
              setEditingDescriptionId(null)
            }
          }}
        >
          <div 
            style={{ 
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 4,
              minHeight: 24,
              background: 'rgba(255,255,255,0.04)',
              border: '1px dashed rgba(255,255,255,0.1)',
            }}
          >
            {text ? (
              <Text 
                type="secondary" 
                style={{ fontSize: 12 }}
              >
                {text.length > 20 ? `${text.slice(0, 20)}...` : text}
              </Text>
            ) : (
              <Text type="secondary" style={{ fontSize: 12, opacity: 0.5 }}>
                点击添加备注
              </Text>
            )}
          </div>
        </Popover>
      ),
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
            avatar_url: '',
            x_url: '',
            xiaohongshu_url: '',
            description: '',
            is_active: true,
            is_vsc: false,
          }}
        >
          <Form.Item
            label="Twitter 用户名"
            name="username"
            rules={[
              { message: '请输入用户名' },
              { pattern: /^@?[A-Za-z0-9_]+$/, message: '用户名格式不正确' },
            ]}
            extra="输入用户名，如：@midjourney 或 midjourney"
          >
            <Input 
              placeholder="@midjourney" 
              onChange={handleUsernameChange}
            />
          </Form.Item>

          <Form.Item
            label="显示名称"
            name="display_name"
          >
            <Input placeholder="Midjourney" />
          </Form.Item>

          <Form.Item
            label="头像链接"
            name="avatar_url"
            rules={[{ type: 'url', message: '请输入有效的图片链接' }]}
          >
            <Input placeholder="https://..." />
          </Form.Item>

          <Form.Item
            label="X/Twitter 主页"
            name="x_url"
            rules={[{ type: 'url', message: '请输入有效的链接' }]}
            extra="根据用户名自动生成，也可手动修改"
          >
            <Input placeholder="https://x.com/midjourney" />
          </Form.Item>

          <Form.Item
            label="小红书主页"
            name="xiaohongshu_url"
            rules={[{ type: 'url', message: '请输入有效的链接' }]}
          >
            <Input placeholder="https://www.xiaohongshu.com/user/..." />
          </Form.Item>

          <Form.Item
            label="备注"
            name="description"
          >
            <Input.TextArea placeholder="可选备注信息" rows={2} />
          </Form.Item>

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