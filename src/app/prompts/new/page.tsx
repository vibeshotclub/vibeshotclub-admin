'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Typography, message } from 'antd'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { PromptForm } from '@/components/admin/PromptForm'
import { usePrompts } from '@/hooks/usePrompts'
import type { PromptFormData } from '@/types/database'

const { Title, Text } = Typography

export default function NewPromptPage() {
  const router = useRouter()
  const { createPrompt } = usePrompts()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (data: PromptFormData) => {
    setIsSubmitting(true)
    try {
      await createPrompt(data)
      message.success('提示词创建成功')
      router.push('/prompts')
    } catch (error) {
      message.error((error as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AdminLayout>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>添加提示词</Title>
        <Text type="secondary">上传图片并添加提示词到库中</Text>
      </div>

      <PromptForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </AdminLayout>
  )
}
