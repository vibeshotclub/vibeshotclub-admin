'use client'

import useSWR from 'swr'
import type { Tag, TagFormData } from '@/types/database'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useTags() {
  const { data, error, isLoading, mutate } = useSWR('/api/tags', fetcher)

  const createTag = async (formData: TagFormData) => {
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || '创建失败')
    }

    mutate()
    return data.tag
  }

  const updateTag = async (id: string, formData: TagFormData) => {
    const res = await fetch(`/api/tags/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || '更新失败')
    }

    mutate()
    return data.tag
  }

  const deleteTag = async (id: string) => {
    const res = await fetch(`/api/tags/${id}`, {
      method: 'DELETE',
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || '删除失败')
    }

    mutate()
  }

  // Group tags by type
  const tagsByType = (data?.tags as Tag[] | undefined)?.reduce(
    (acc, tag) => {
      if (!acc[tag.type]) acc[tag.type] = []
      acc[tag.type].push(tag)
      return acc
    },
    {} as Record<string, Tag[]>
  )

  return {
    tags: (data?.tags as Tag[]) ?? [],
    tagsByType,
    isLoading,
    isError: error,
    mutate,
    createTag,
    updateTag,
    deleteTag,
  }
}
