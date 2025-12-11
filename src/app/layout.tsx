import type { Metadata } from 'next'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import { ConfigProvider, App, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import './globals.css'

export const metadata: Metadata = {
  title: 'Vibe Shot Club Admin',
  description: '提示词库管理后台',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AntdRegistry>
          <ConfigProvider
            locale={zhCN}
            theme={{
              algorithm: theme.darkAlgorithm,
              token: {
                colorPrimary: '#a855f7',
                colorBgBase: '#0a0a0f',
                colorBgContainer: 'rgba(20, 20, 30, 0.8)',
                colorBgElevated: 'rgba(20, 20, 30, 0.95)',
                colorBorder: 'rgba(168, 85, 247, 0.2)',
                colorBorderSecondary: 'rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                colorLink: '#a855f7',
                colorLinkHover: '#ec4899',
                colorText: '#f0f0f0',
                colorTextSecondary: 'rgba(255, 255, 255, 0.65)',
                colorTextTertiary: 'rgba(255, 255, 255, 0.45)',
                colorTextQuaternary: 'rgba(255, 255, 255, 0.25)',
              },
              components: {
                Layout: {
                  siderBg: 'transparent',
                  bodyBg: 'transparent',
                },
                Menu: {
                  darkItemBg: 'transparent',
                  darkItemSelectedBg: 'rgba(168, 85, 247, 0.15)',
                  darkItemHoverBg: 'rgba(168, 85, 247, 0.1)',
                },
                Card: {
                  colorBgContainer: 'rgba(20, 20, 30, 0.8)',
                },
                Table: {
                  colorBgContainer: 'transparent',
                  headerBg: 'rgba(168, 85, 247, 0.1)',
                },
                Button: {
                  primaryShadow: 'none',
                },
              },
            }}
          >
            <App>{children}</App>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  )
}
