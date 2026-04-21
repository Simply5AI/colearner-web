'use client'

import { useQuery } from '@tanstack/react-query'
import { getTutorHistory, type TutorHistory } from '@/lib/api/tutor'

export function useTutorHistory(extractionId: string, enabled: boolean) {
  return useQuery<TutorHistory>({
    queryKey: ['tutor', extractionId],
    queryFn: () => getTutorHistory(extractionId),
    enabled: Boolean(extractionId) && enabled,
    staleTime: 30_000,
  })
}
