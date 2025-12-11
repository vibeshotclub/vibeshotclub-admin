'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Layout, Menu, Spin, Button, theme } from 'antd'
import {
  DashboardOutlined,
  FileImageOutlined,
  TagsOutlined,
  SettingOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import { useAuth } from '@/hooks/useAuth'

const { Sider, Content } = Layout

interface AdminLayoutProps {
  children: React.ReactNode
}

const menuItems = [
  {
    key: '/',
    icon: <DashboardOutlined />,
    label: <Link href="/">Dashboard</Link>,
  },
  {
    key: '/prompts',
    icon: <FileImageOutlined />,
    label: <Link href="/prompts">提示词管理</Link>,
  },
  {
    key: '/tags',
    icon: <TagsOutlined />,
    label: <Link href="/tags">标签管理</Link>,
  },
]

export function AdminLayout({ children }: AdminLayoutProps) {
  const { isAuthenticated, isLoading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const { token } = theme.useToken()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: token.colorBgContainer
      }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  // 计算当前选中的菜单项
  const selectedKey = pathname === '/' ? '/' : `/${pathname.split('/')[1]}`

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}>
          <h1 style={{
            color: token.colorText,
            margin: 0,
            fontSize: collapsed ? 14 : 18,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}>
            {collapsed ? 'VSC' : 'Vibe Shot Club'}
          </h1>
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          style={{ borderRight: 0 }}
        />

        <div style={{
          position: 'absolute',
          bottom: 48,
          left: 0,
          right: 0,
          padding: '0 16px',
        }}>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={logout}
            style={{ width: '100%', justifyContent: 'flex-start' }}
          >
            {!collapsed && '退出登录'}
          </Button>
        </div>
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'margin-left 0.2s' }}>
        <Content style={{
          margin: 24,
          padding: 24,
          minHeight: 280,
          background: token.colorBgContainer,
          borderRadius: token.borderRadiusLG,
        }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}
