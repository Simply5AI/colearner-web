'use client'

import { useCallback, useRef, useState } from 'react'
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useLearnIdentity } from '@/components/learn/learn-common'
import { homeworkApi, pollDelay } from '@/lib/api/co'

export const homeworkKeys = {
  session: (actor: string, sessionId: string) => ['learn', actor, 'homework-session', sessionId] as const,
  history: (actor: string) => ['learn', actor, 'homework-history'] as const,
}
const fresh = { retry: false, staleTime: 0, gcTime: 0, refetchOnMount: 'always' } as const

export interface PollTiming { delay?: (attempt: number) => number }

/**
 * The homework session from the server. A refresh resumes from it. While a turn is queued or running it is read again with
 * the contract backoff (800 ms, 1.2 s, 1.6 s, 2 s ... capped at 4 s); the count starts again for every new turn.
 */
export function useHomeworkSession(sessionId: string, timing: PollTiming = {}) {
  const { actor } = useLearnIdentity()
  const polls = useRef<{ id: string | null; n: number }>({ id: null, n: 0 })
  const delay = timing.delay ?? pollDelay
  return useQuery({
    queryKey: homeworkKeys.session(actor, sessionId), queryFn: () => homeworkApi.session(sessionId), enabled: !!actor && !!sessionId,
    ...fresh, refetchOnWindowFocus: true,
    refetchInterval: query => {
      const pending = query.state.data?.pending
      if (!pending || (pending.status !== 'QUEUED' && pending.status !== 'RUNNING')) { polls.current = { id: null, n: 0 }; return false }
      if (polls.current.id !== pending.id) polls.current = { id: pending.id, n: 0 }
      return delay(polls.current.n++)
    },
  })
}

/** The learner's earlier homework sessions (cursor pages from `GET homework/sessions`). */
export function useHomeworkHistory() {
  const { actor } = useLearnIdentity()
  return useInfiniteQuery({
    queryKey: homeworkKeys.history(actor), enabled: !!actor, ...fresh, refetchOnWindowFocus: false,
    queryFn: ({ pageParam }) => homeworkApi.list(pageParam, 20),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.nextCursor,
    placeholderData: keepPreviousData,
  })
}

export type ActionKind = 'restatement' | 'step' | 'hint' | 'final-phase' | 'final' | 'problem' | 'finish' | 'retry'
export interface ActionState { pending: boolean; kind: ActionKind | null; error: Error | null; errorKind: ActionKind | null }
const idle: ActionState = { pending: false, kind: null, error: null, errorKind: null }
/**
 * Runs one server action at a time. A second press while one is running is ignored (a ref, because state lands after both
 * clicks). After the action, success or failure, the session is read again so the page always shows what the server holds.
 */
export function useAction(sync: () => Promise<unknown>) {
  const busy = useRef(false)
  const [state, setState] = useState<ActionState>(idle)
  const run = useCallback(async (kind: ActionKind, job: () => Promise<unknown>): Promise<boolean> => {
    if (busy.current) return false
    busy.current = true
    setState({ pending: true, kind, error: null, errorKind: null })
    try {
      await job()
      await sync().catch(() => undefined)
      setState(idle)
      return true
    } catch (error) {
      await sync().catch(() => undefined)
      setState({ pending: false, kind: null, error: error instanceof Error ? error : new Error('Something went wrong. Please try again.'), errorKind: kind })
      return false
    } finally { busy.current = false }
  }, [sync])
  const clear = useCallback(() => setState(previous => previous.error ? { ...previous, error: null, errorKind: null } : previous), [])
  return { ...state, run, clear }
}
