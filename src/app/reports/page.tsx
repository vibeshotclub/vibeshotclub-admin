'use client'

import { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  DatePicker,
  Switch,
  Space,
  Tag,
  Typography,
  Card,
  Popconfirm,
  App,
  Spin,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { useReports, useReport } from '@/hooks/useReports'
import type { DailyReport, DailyReportFormData, ReportSource } from '@/types/database'

const { Text, Paragraph } = Typography
const { TextArea } = Input

export default function ReportsPage() {
  const { message } = App.useApp()
  const [page, setPage] = useState(1)
  const { reports, pagination, isLoading, createReport, updateReport, deleteReport, togglePublish } = useReports(page)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form] = Form.useForm()

  // 获取单个日报内容（用于编辑）
  const { report: editingReport, isLoading: isLoadingReport } = useReport(editingId)
  const { report: previewReport, isLoading: isLoadingPreview } = useReport(previewId)

  // 当 editingReport 加载完成时，填充表单
  useEffect(() => {
    if (editingReport && editingId) {
      form.setFieldsValue({
        date: dayjs(editingReport.date),
        title: editingReport.title,
        summary: editingReport.summary || '',
        content: editingReport.content || '',
        is_published: editingReport.is_published,
      })
    }
  }, [editingReport, editingId, form])

  const openCreateModal = () => {
    setEditingId(null)
    form.setFieldsValue({
      date: dayjs(),
      title: '',
      summary: '',
      content: '',
      is_published: false,
    })
    setIsModalOpen(true)
  }

  const openEditModal = (report: DailyReport) => {
    setEditingId(report.id)
    setIsModalOpen(true)
  }

  const openPreviewModal = (report: DailyReport) => {
    setPreviewId(report.id)
    setIsPreviewOpen(true)
  }

  const handleSubmit = async (values: {
    date: dayjs.Dayjs
    title: string
    summary?: string
    content: string
    is_published: boolean
  }) => {
    setIsSubmitting(true)
    try {
      const formData: DailyReportFormData = {
        date: values.date.format('YYYY-MM-DD'),
        title: values.title,
        summary: values.summary,
        content: values.content,
        is_published: values.is_published,
      }

      if (editingId) {
        await updateReport(editingId, formData)
        message.success('日报更新成功')
      } else {
        await createReport(formData)
        message.success('日报创建成功')
      }
      setIsModalOpen(false)
      setEditingId(null)
    } catch (error) {
      message.error((error as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteReport(id)
      message.success('日报删除成功')
    } catch (error) {
      message.error((error as Error).message)
    }
  }

  const handleTogglePublish = async (report: DailyReport) => {
    try {
      await togglePublish(report.id, !report.is_published)
      message.success(report.is_published ? '已取消发布' : '已发布')
    } catch (error) {
      message.error((error as Error).message)
    }
  }

  const columns: ColumnsType<DailyReport> = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (date) => (
        <Text strong>{dayjs(date).format('YYYY-MM-DD')}</Text>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (title, record) => (
        <a onClick={() => openEditModal(record)}>{title}</a>
      ),
    },
    {
      title: '摘要',
      dataIndex: 'summary',
      key: 'summary',
      width: 200,
      ellipsis: true,
      render: (summary) => summary || <Text type="secondary">-</Text>,
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 80,
      render: (source: ReportSource) => (
        <Tag color={source === 'bot' ? 'blue' : 'green'}>
          {source === 'bot' ? 'Bot' : '手动'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_published',
      key: 'is_published',
      width: 80,
      render: (is_published, record) => (
        <Switch
          checked={is_published}
          onChange={() => handleTogglePublish(record)}
          size="small"
        />
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 160,
      render: (date) => dayjs(date).format('MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => openPreviewModal(record)}
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          />
          <Popconfirm
            title="确认删除"
            description="确定要删除这篇日报吗？"
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
            <FileTextOutlined />
            <span>日报管理</span>
            <Text type="secondary" style={{ fontSize: 14, fontWeight: 400 }}>
              共 {pagination?.total || 0} 篇日报
            </Text>
          </Space>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            添加日报
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={reports}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: page,
            pageSize: pagination?.limit || 20,
            total: pagination?.total || 0,
            onChange: (p) => setPage(p),
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 条`,
          }}
          size="middle"
        />
      </Card>

      {/* 编辑/创建 Modal */}
      <Modal
        title={editingId ? '编辑日报' : '添加日报'}
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false)
          setEditingId(null)
        }}
        footer={null}
        forceRender
        width={800}
      >
        {editingId && isLoadingReport ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              date: dayjs(),
              title: '',
              summary: '',
              content: '',
              is_published: false,
            }}
          >
            <Space style={{ width: '100%' }} size="large">
              <Form.Item
                label="日期"
                name="date"
                rules={[{ required: true, message: '请选择日期' }]}
              >
                <DatePicker style={{ width: 150 }} />
              </Form.Item>

              <Form.Item
                label="发布"
                name="is_published"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Space>

            <Form.Item
              label="标题"
              name="title"
              rules={[{ required: true, message: '请输入标题' }]}
            >
              <Input placeholder="如：VSC 日报 — 2025年12月13日" />
            </Form.Item>

            <Form.Item
              label="摘要"
              name="summary"
            >
              <TextArea
                rows={2}
                placeholder="简短描述本期日报的主要内容（可选）"
              />
            </Form.Item>

            <Form.Item
              label="内容 (Markdown)"
              name="content"
              rules={[{ required: true, message: '请输入内容' }]}
            >
              <TextArea
                rows={16}
                placeholder="输入 Markdown 格式的日报内容..."
                style={{ fontFamily: 'monospace' }}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => {
                  setIsModalOpen(false)
                  setEditingId(null)
                }}>
                  取消
                </Button>
                <Button type="primary" htmlType="submit" loading={isSubmitting}>
                  {editingId ? '保存' : '创建'}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* 预览 Modal */}
      <Modal
        title={previewReport?.title || '日报预览'}
        open={isPreviewOpen}
        onCancel={() => {
          setIsPreviewOpen(false)
          setPreviewId(null)
        }}
        footer={null}
        width={800}
      >
        {isLoadingPreview ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : (
          <div style={{ maxHeight: 600, overflow: 'auto' }}>
            <Paragraph>
              <Text type="secondary">日期：</Text>
              {previewReport?.date && dayjs(previewReport.date).format('YYYY年MM月DD日')}
            </Paragraph>
            {previewReport?.summary && (
              <Paragraph>
                <Text type="secondary">摘要：</Text>
                {previewReport.summary}
              </Paragraph>
            )}
            <div
              style={{
                marginTop: 16,
                padding: 16,
                background: 'rgba(0,0,0,0.2)',
                borderRadius: 8,
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {previewReport?.content || '暂无内容'}
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  )
}
