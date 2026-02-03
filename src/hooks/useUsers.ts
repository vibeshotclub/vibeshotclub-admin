'use client'

import useSWR from 'swr'
import type { User, UserFormData } from '@/types/database'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useUsers() {
  const { data, error, isLoading, mutate } = useSWR('/api/users', fetcher)

  const updateUser = async (id: string, formData: UserFormData) => {
    const res = await fetch(`/api/users/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || '更新失败')
    }
    mutate()
    return (await res.json()).user
  }

  const deleteUser = async (id: string) => {
    const res = await fetch(`/api/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || '删除失败')
    }
    mutate()
  }

  return {
    users: (data?.users as User[]) ?? [],
    isLoading,
    isError: error,
    mutate,
    updateUser,
    deleteUser,
  }
}