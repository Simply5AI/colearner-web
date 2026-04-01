'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { getCaptureStats } from '@/lib/api/capture'
import { queryKeys } from '@/lib/api/query-keys'

export function useCaptureStats() {
  const { data: session } = useSession()

  return useQuery({
    queryKey: queryKeys.capture.stats(),
    queryFn: () => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return getCaptureStats({ Authorization: `Bearer ${session.accessToken}` })
    },
    enabled: !!session?.accessToken,
  })
}

export function useInvalidateCaptureStats() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.capture.stats() })
}
