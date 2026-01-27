'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Layout, Menu, Spin, Button } from 'antd'
import {
  DashboardOutlined,
  FileImageOutlined,
  TagsOutlined,
  RobotOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  XOutlined,
  TeamOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import { useAuth } from '@/hooks/useAuth'

const { Sider, Content } = Layout

interface AdminLayoutProps {
  children: React.ReactNode
  bottomBar?: React.ReactNode
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
  {
    key: '/models',
    icon: <RobotOutlined />,
    label: <Link href="/models">模型管理</Link>,
  },
  {
    key: '/reports',
    icon: <FileTextOutlined />,
    label: <Link href="/reports">日报管理</Link>,
  },
  {
    key: '/creators',
    icon: <XOutlined />,
    label: <Link href="/creators">Twitter 创作者</Link>,
  },
  {
    key: '/creators-showcase',
    icon: <TeamOutlined />,
    label: <Link href="/creators-showcase">创作者展示</Link>,
  },
  {
    key: '/homepage-videos',
    icon: <VideoCameraOutlined />,
    label: <Link href="/homepage-videos">首页视频</Link>,
  },
]

export function AdminLayout({ children, bottomBar }: AdminLayoutProps) {
  const { isAuthenticated, isLoading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

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
        background: 'linear-gradient(135deg, #0a0a0f 0%, #12121a 100%)',
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
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        width={220}
        collapsedWidth={72}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          background: 'linear-gradient(180deg, rgba(10, 10, 15, 0.98) 0%, rgba(18, 18, 26, 0.98) 100%)',
          borderRight: '1px solid rgba(168, 85, 247, 0.15)',
          backdropFilter: 'blur(10px)',
        }}
      >
        {/* Logo */}
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid rgba(168, 85, 247, 0.15)',
          padding: '0 16px',
        }}>
          <h1 style={{
            margin: 0,
            fontSize: collapsed ? 16 : 20,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            background: 'linear-gradient(135deg, #a855f7, #ec4899)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 30px rgba(168, 85, 247, 0.5)',
          }}>
            {collapsed ? '✦' : '✦ Vibe Shot'}
          </h1>
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          style={{
            borderRight: 0,
            marginTop: 8,
          }}
        />

        {/* Collapse Toggle */}
        <div style={{
          position: 'absolute',
          bottom: 100,
          left: 0,
          right: 0,
          padding: '0 16px',
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              width: '100%',
              justifyContent: collapsed ? 'center' : 'flex-start',
              color: 'rgba(255, 255, 255, 0.45)',
            }}
          >
            {!collapsed && '收起菜单'}
          </Button>
        </div>

        {/* Logout */}
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
            style={{
              width: '100%',
              justifyContent: collapsed ? 'center' : 'flex-start',
              color: 'rgba(255, 255, 255, 0.65)',
            }}
          >
            {!collapsed && '退出登录'}
          </Button>
        </div>
      </Sider>

      <Layout style={{
        marginLeft: collapsed ? 72 : 220,
        transition: 'margin-left 0.2s',
        background: 'transparent',
      }}>
        <Content style={{
          margin: 24,
          marginBottom: bottomBar ? 80 : 24,
          padding: 24,
          minHeight: 280,
          background: 'rgba(20, 20, 30, 0.6)',
          backdropFilter: 'blur(10px)',
          borderRadius: 12,
          border: '1px solid rgba(168, 85, 247, 0.1)',
        }}>
          {children}
        </Content>

        {bottomBar && (
          <div style={{
            position: 'fixed',
            bottom: 0,
            left: collapsed ? 72 : 220,
            right: 0,
            padding: '16px 48px',
            background: 'rgba(20, 20, 30, 0.95)',
            backdropFilter: 'blur(10px)',
            borderTop: '1px solid rgba(168, 85, 247, 0.2)',
            zIndex: 100,
            transition: 'left 0.2s',
          }}>
            {bottomBar}
          </div>
        )}
      </Layout>
    </Layout>
  )
}