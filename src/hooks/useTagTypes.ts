'use client'

import useSWR from 'swr'
import type { TagType, TagTypeFormData } from '@/types/database'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useTagTypes() {
  const { data, error, isLoading, mutate } = useSWR<{ tagTypes: TagType[] }>(
    '/api/tag-types',
    fetcher
  )

  const createTagType = async (formData: TagTypeFormData) => {
    const res = await fetch('/api/tag-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error)

    mutate()
    return data.tagType
  }

  const updateTagType = async (id: string, formData: TagTypeFormData) => {
    const res = await fetch(`/api/tag-types/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error)

    mutate()
    return data.tagType
  }

  const deleteTagType = async (id: string) => {
    const res = await fetch(`/api/tag-types/${id}`, {
      method: 'DELETE',
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error)

    mutate()
  }

  return {
    tagTypes: data?.tagTypes || [],
    isLoading,
    isError: error,
    createTagType,
    updateTagType,
    deleteTagType,
    mutate,
  }
}
