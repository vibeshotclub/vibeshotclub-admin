'use client'

import useSWR from 'swr'
import type { HomepageVideo } from '@/types/database'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useHomepageVideos() {
  const { data, error, isLoading, mutate } = useSWR('/api/homepage-videos', fetcher)

  const deleteVideo = async (id: string) => {
    const res = await fetch(`/api/homepage-videos/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || '删除失败')
    }
    mutate()
  }

  const updateVideo = async (id: string, data: Partial<HomepageVideo>) => {
    const res = await fetch(`/api/homepage-videos/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const result = await res.json()
      throw new Error(result.error || '更新失败')
    }
    mutate()
    return (await res.json()).video
  }

  const updateSortOrder = async (updates: Array<{ id: string; sort_order: number }>) => {
    const res = await fetch('/api/homepage-videos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || '更新排序失败')
    }
    mutate()
  }

  return {
    videos: (data?.videos as HomepageVideo[]) ?? [],
    isLoading,
    isError: error,
    mutate,
    deleteVideo,
    updateVideo,
    updateSortOrder,
  }
}