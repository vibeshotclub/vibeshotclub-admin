'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { Typography, Spin, Result, App } from 'antd'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { PromptForm } from '@/components/admin/PromptForm'
import { usePrompt, usePrompts } from '@/hooks/usePrompts'
import type { PromptFormData } from '@/types/database'

const { Title, Text } = Typography

export default function EditPromptPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { message } = App.useApp()
  const { prompt, isLoading, isError } = usePrompt(id)
  const { updatePrompt } = usePrompts()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (data: PromptFormData) => {
    setIsSubmitting(true)
    try {
      await updatePrompt(id, data)
      message.success('提示词更新成功')
      router.push('/prompts')
    } catch (error) {
      message.error((error as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <AdminLayout>
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" />
        </div>
      </AdminLayout>
    )
  }

  if (isError || !prompt) {
    return (
      <AdminLayout>
        <Result
          status="404"
          title="提示词不存在"
          subTitle="该提示词可能已被删除或不存在"
        />
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>编辑提示词</Title>
        <Text type="secondary">修改提示词信息</Text>
      </div>

      <PromptForm
        prompt={prompt}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </AdminLayout>
  )
}
