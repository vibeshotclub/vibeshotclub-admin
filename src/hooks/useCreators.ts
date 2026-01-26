'use client'

import useSWR from 'swr'
import type { TwitterCreator, TwitterCreatorFormData } from '@/types/database'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useCreators(sortBy: 'created_at' | 'sort_order' = 'created_at') {
  const url = `/api/creators?sort_by=${sortBy}`
  const { data, error, isLoading, mutate } = useSWR(url, fetcher)

  const createCreator = async (formData: TwitterCreatorFormData) => {
    const res = await fetch('/api/creators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || '创建失败')
    }
    mutate()
    return (await res.json()).creator
  }

  const updateCreator = async (id: string, formData: TwitterCreatorFormData) => {
    const res = await fetch(`/api/creators/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || '更新失败')
    }
    mutate()
    return (await res.json()).creator
  }

  const deleteCreator = async (id: string) => {
    const res = await fetch(`/api/creators/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || '删除失败')
    }
    mutate()
  }

  return {
    creators: (data?.creators as TwitterCreator[]) ?? [],
    isLoading,
    isError: error,
    mutate,
    createCreator,
    updateCreator,
    deleteCreator,
  }
}