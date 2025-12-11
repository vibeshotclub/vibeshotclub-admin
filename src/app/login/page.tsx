'use client'

import { useState } from 'react'
import { Form, Input, Button, Card, Typography, App } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { useAuth } from '@/hooks/useAuth'

const { Title, Text } = Typography

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const { message } = App.useApp()
  const { login } = useAuth()

  const onFinish = async (values: { password: string }) => {
    setLoading(true)
    const result = await login(values.password)

    if (!result.success) {
      message.error(result.error || '登录失败')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #12121a 50%, #1a0a1a 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background Glow Effects */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '10%',
        width: 300,
        height: 300,
        background: 'radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(60px)',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '20%',
        right: '10%',
        width: 400,
        height: 400,
        background: 'radial-gradient(circle, rgba(236, 72, 153, 0.1) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(80px)',
      }} />

      <Card
        style={{
          width: 400,
          background: 'rgba(20, 20, 30, 0.8)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(168, 85, 247, 0.2)',
          borderRadius: 16,
          boxShadow: '0 0 40px rgba(168, 85, 247, 0.1)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 72,
            height: 72,
            background: 'linear-gradient(135deg, #a855f7, #ec4899)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 0 30px rgba(168, 85, 247, 0.4)',
          }}>
            <LockOutlined style={{ fontSize: 32, color: '#fff' }} />
          </div>
          <Title
            level={3}
            style={{
              margin: 0,
              background: 'linear-gradient(135deg, #a855f7, #ec4899)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Vibe Shot Club
          </Title>
          <Text style={{ color: 'rgba(255, 255, 255, 0.45)' }}>管理后台</Text>
        </div>

        <Form
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          layout="vertical"
        >
          <Form.Item
            label={<span style={{ color: 'rgba(255, 255, 255, 0.65)' }}>管理员密码</span>}
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              size="large"
              placeholder="请输入密码"
              prefix={<LockOutlined style={{ color: 'rgba(168, 85, 247, 0.6)' }} />}
              style={{
                background: 'rgba(20, 20, 30, 0.6)',
                borderColor: 'rgba(168, 85, 247, 0.3)',
              }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
              style={{
                height: 48,
                fontSize: 16,
                fontWeight: 500,
              }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
