'use client'

import useSWR from 'swr'
import type { AIModel } from '@/lib/data/ai-models'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useModels() {
  const { data, error, isLoading } = useSWR('/api/models', fetcher)

  return {
    models: (data?.models as AIModel[]) ?? [],
    grouped: data?.grouped as { closed: AIModel[]; open: AIModel[] } | undefined,
    isLoading,
    isError: error,
  }
}
