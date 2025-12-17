'use client'

import useSWR from 'swr'
import type { AIModel, AIModelFormData } from '@/types/database'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useModels(activeOnly = false) {
  const url = activeOnly ? '/api/models?active_only=true' : '/api/models'
  const { data, error, isLoading, mutate } = useSWR(url, fetcher)

  const createModel = async (formData: AIModelFormData) => {
    const res = await fetch('/api/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || '创建失败')
    }
    mutate()
    return (await res.json()).model
  }

  const updateModel = async (id: string, formData: AIModelFormData) => {
    const res = await fetch(`/api/models/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || '更新失败')
    }
    mutate()
    return (await res.json()).model
  }

  const deleteModel = async (id: string) => {
    const res = await fetch(`/api/models/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || '删除失败')
    }
    mutate()
  }

  return {
    models: (data?.models as AIModel[]) ?? [],
    grouped: data?.grouped as { closed: AIModel[]; open: AIModel[] } | undefined,
    isLoading,
    isError: error,
    mutate,
    createModel,
    updateModel,
    deleteModel,
  }
}
