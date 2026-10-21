'use client'

import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useLearnIdentity } from '@/components/learn/learn-common'
import { practiceApi, type HubFilters } from '@/lib/api/practice'

export const practiceKeys = {
  hub: (actor: string, filters: HubFilters) => ['learn', actor, 'practice-hub', filters.subjectId ?? null, filters.planId ?? null] as const,
  history: (actor: string) => ['learn', actor, 'practice-history'] as const,
  set: (actor: string, setId: string) => ['learn', actor, 'practice-set', setId] as const,
  setStart: (actor: string, kind: string, id: string) => ['learn', actor, 'practice-set-start', kind, id] as const,
  sessionStart: (actor: string, clientSessionId: string) => ['learn', actor, 'practice-session-start', clientSessionId] as const,
  summary: (actor: string, sessionId: string) => ['learn', actor, 'practice-summary', sessionId] as const,
  sheet: (actor: string, sessionId: string) => ['learn', actor, 'practice-sheet', sessionId] as const,
}
const fresh = { retry: false, staleTime: 0, gcTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: false } as const

export function usePracticeHub(filters: HubFilters = {}) {
  const { actor } = useLearnIdentity()
  return useQuery({ queryKey: practiceKeys.hub(actor, filters), queryFn: () => practiceApi.hub(filters), enabled: !!actor, ...fresh })
}

/** The history tab: cursor pages, loaded only when the tab is open. */
export function usePracticeHistory(enabled: boolean) {
  const { actor } = useLearnIdentity()
  return useInfiniteQuery({
    queryKey: practiceKeys.history(actor), enabled: !!actor && enabled, ...fresh,
    queryFn: ({ pageParam }) => practiceApi.history(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.nextCursor,
    placeholderData: keepPreviousData,
  })
}

export function usePracticeSummary(sessionId: string) {
  const { actor } = useLearnIdentity()
  return useQuery({ queryKey: practiceKeys.summary(actor, sessionId), queryFn: () => practiceApi.summary(sessionId), enabled: !!actor && !!sessionId, ...fresh })
}
export function usePracticeAnswerSheet(sessionId: string) {
  const { actor } = useLearnIdentity()
  return useQuery({ queryKey: practiceKeys.sheet(actor, sessionId), queryFn: () => practiceApi.answerSheet(sessionId), enabled: !!actor && !!sessionId, ...fresh })
}
