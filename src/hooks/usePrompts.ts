'use client'

import useSWR from 'swr'
import type { PromptWithTags, PromptFormData } from '@/types/database'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface UsePromptsOptions {
  page?: number
  limit?: number
  search?: string
  tag?: string
  featured?: boolean
  published?: boolean
}

export function usePrompts(options: UsePromptsOptions = {}) {
  const { page = 1, limit = 20, search, tag, featured, published } = options

  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(limit))
  if (search) params.set('search', search)
  if (tag) params.set('tag', tag)
  if (featured) params.set('featured', 'true')
  if (published !== undefined) params.set('published', String(published))

  const { data, error, isLoading, mutate } = useSWR(
    `/api/prompts?${params.toString()}`,
    fetcher
  )

  const createPrompt = async (formData: PromptFormData) => {
    const res = await fetch('/api/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || '创建失败')
    }

    mutate()
    return data.prompt
  }

  const updatePrompt = async (id: string, formData: PromptFormData) => {
    const res = await fetch(`/api/prompts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || '更新失败')
    }

    mutate()
    return data.prompt
  }

  const deletePrompt = async (id: string) => {
    const res = await fetch(`/api/prompts/${id}`, {
      method: 'DELETE',
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || '删除失败')
    }

    mutate()
  }

  const reorderPrompts = async (ids: string[]) => {
    const res = await fetch('/api/prompts/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || '排序失败')
    }

    mutate()
  }

  return {
    prompts: (data?.prompts as PromptWithTags[]) ?? [],
    pagination: data?.pagination,
    isLoading,
    isError: error,
    mutate,
    createPrompt,
    updatePrompt,
    deletePrompt,
    reorderPrompts,
  }
}

export function usePrompt(id: string) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? `/api/prompts/${id}` : null,
    fetcher
  )

  return {
    prompt: data?.prompt as PromptWithTags | undefined,
    isLoading,
    isError: error,
    mutate,
  }
}
