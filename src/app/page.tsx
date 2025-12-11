'use client'

import Link from 'next/link'
import { Row, Col, Card, Statistic, List, Avatar, Typography, Button, Space, Empty } from 'antd'
import {
  FileImageOutlined,
  StarOutlined,
  TagsOutlined,
  EyeOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { usePrompts } from '@/hooks/usePrompts'
import { useTags } from '@/hooks/useTags'

const { Title, Text } = Typography

export default function DashboardPage() {
  const { prompts, isLoading: promptsLoading } = usePrompts({ limit: 100 })
  const { tags, isLoading: tagsLoading } = useTags()

  const isLoading = promptsLoading || tagsLoading

  const stats = [
    {
      title: '提示词总数',
      value: prompts.length,
      icon: <FileImageOutlined style={{ fontSize: 24 }} />,
      color: '#1890ff',
    },
    {
      title: '精选作品',
      value: prompts.filter((p) => p.is_featured).length,
      icon: <StarOutlined style={{ fontSize: 24 }} />,
      color: '#faad14',
    },
    {
      title: '标签数量',
      value: tags.length,
      icon: <TagsOutlined style={{ fontSize: 24 }} />,
      color: '#52c41a',
    },
    {
      title: '总浏览量',
      value: prompts.reduce((acc, p) => acc + p.view_count, 0),
      icon: <EyeOutlined style={{ fontSize: 24 }} />,
      color: '#722ed1',
    },
  ]

  const recentPrompts = prompts.slice(0, 5)

  return (
    <AdminLayout>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>Dashboard</Title>
        <Text type="secondary">欢迎回来，管理员</Text>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {stats.map((stat) => (
          <Col xs={24} sm={12} lg={6} key={stat.title}>
            <Card hoverable>
              <Statistic
                title={stat.title}
                value={isLoading ? '-' : stat.value}
                prefix={
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 8,
                    background: `${stat.color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: stat.color,
                    marginRight: 12,
                  }}>
                    {stat.icon}
                  </div>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        {/* Recent Prompts */}
        <Col xs={24} lg={16}>
          <Card
            title="最近添加"
            extra={<Link href="/prompts">查看全部</Link>}
          >
            {promptsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Text type="secondary">加载中...</Text>
              </div>
            ) : recentPrompts.length === 0 ? (
              <Empty
                description="暂无数据"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Link href="/prompts/new">
                  <Button type="primary" icon={<PlusOutlined />}>
                    添加第一个提示词
                  </Button>
                </Link>
              </Empty>
            ) : (
              <List
                itemLayout="horizontal"
                dataSource={recentPrompts}
                renderItem={(prompt) => (
                  <List.Item
                    actions={[
                      <Space key="stats">
                        {prompt.is_featured && (
                          <StarOutlined style={{ color: '#faad14' }} />
                        )}
                        <Text type="secondary">
                          <EyeOutlined /> {prompt.view_count}
                        </Text>
                      </Space>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          shape="square"
                          size={48}
                          src={prompt.thumbnail_url}
                          icon={<FileImageOutlined />}
                        />
                      }
                      title={
                        <Link href={`/prompts/${prompt.id}/edit`}>
                          {prompt.title}
                        </Link>
                      }
                      description={
                        <Text type="secondary" ellipsis style={{ maxWidth: 400 }}>
                          {prompt.prompt_text}
                        </Text>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        {/* Quick Actions */}
        <Col xs={24} lg={8}>
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Card
              hoverable
              style={{ background: '#1890ff', border: 'none' }}
            >
              <Link href="/prompts/new" style={{ color: '#fff', display: 'block' }}>
                <Space>
                  <PlusOutlined style={{ fontSize: 24 }} />
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>添加新提示词</div>
                    <div style={{ opacity: 0.8, fontSize: 12 }}>上传图片并添加提示词到库中</div>
                  </div>
                </Space>
              </Link>
            </Card>

            <Card hoverable>
              <Link href="/tags" style={{ display: 'block' }}>
                <Space>
                  <TagsOutlined style={{ fontSize: 24, color: '#52c41a' }} />
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>管理标签</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>添加、编辑或删除分类标签</Text>
                  </div>
                </Space>
              </Link>
            </Card>
          </Space>
        </Col>
      </Row>
    </AdminLayout>
  )
}
