'use client'

import useSWR from 'swr'
import type { DailyReport, DailyReportFormData, DailyReportWithContent } from '@/types/database'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useReports(page = 1, limit = 20) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/reports?page=${page}&limit=${limit}`,
    fetcher
  )

  const createReport = async (formData: DailyReportFormData) => {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || '创建失败')
    }
    mutate()
    return (await res.json()).report
  }

  const updateReport = async (id: string, formData: DailyReportFormData) => {
    const res = await fetch(`/api/reports/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || '更新失败')
    }
    mutate()
    return (await res.json()).report
  }

  const deleteReport = async (id: string) => {
    const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || '删除失败')
    }
    mutate()
  }

  const togglePublish = async (id: string, is_published: boolean) => {
    const res = await fetch(`/api/reports/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || '操作失败')
    }
    mutate()
  }

  return {
    reports: (data?.reports as DailyReport[]) ?? [],
    pagination: data?.pagination as {
      page: number
      limit: number
      total: number
      totalPages: number
    } | undefined,
    isLoading,
    isError: error,
    mutate,
    createReport,
    updateReport,
    deleteReport,
    togglePublish,
  }
}

export function useReport(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? `/api/reports/${id}` : null,
    fetcher
  )

  return {
    report: data?.report as DailyReportWithContent | undefined,
    isLoading,
    isError: error,
    mutate,
  }
}
