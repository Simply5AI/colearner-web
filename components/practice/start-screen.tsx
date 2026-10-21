'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LearnSkeleton, useLearnIdentity } from '@/components/learn/learn-common'
import type { LearnBand } from '@/lib/api/learn'
import { pollDelay } from '@/lib/api/lesson'
import {
  isPracticeId, isStartScope, modeForScope, newClientId, practiceApi, practiceRoutes, sessionScopeFor,
  type PracticeSetSummary, type StartScope,
} from '@/lib/api/practice'
import { practiceKeys } from './hub-hooks'
import { PracticeGenerating, PracticeNoTarget, PracticeSetCancelled, PracticeSetFailed, PracticeStartError } from './states'

const STORE_PREFIX = 'colearner.practice-start'
const STORE_TTL_MS = 30 * 60 * 1000
const needsSet = (scope: StartScope) => scope === 'MATERIAL' || scope === 'LESSON' || scope === 'SET'

/**
 * A stable client session id for this exact start request. It survives a refresh (sessionStorage), so the idempotent
 * "create session" request returns the same session instead of making a second one. It is cleared once the learner
 * has moved on to the session, so "Play again" later starts a new one. Storage may be blocked: then the id lives in memory.
 */
export function stableClientSessionId(key: string, now = Date.now(), storage: Pick<Storage, 'getItem' | 'setItem'> | null = browserStorage()): string {
  try {
    const raw = storage?.getItem(key)
    if (raw) {
      const saved = JSON.parse(raw) as { id?: unknown; at?: unknown }
      if (typeof saved.id === 'string' && typeof saved.at === 'number' && now - saved.at < STORE_TTL_MS && saved.id.length >= 8) return saved.id
    }
  } catch { /* unreadable storage is treated as empty */ }
  const id = newClientId('s')
  try { storage?.setItem(key, JSON.stringify({ id, at: now })) } catch { /* the id then lives in memory only */ }
  return id
}
export function forgetClientSessionId(key: string, storage: Pick<Storage, 'removeItem'> | null = browserStorage()) {
  try { storage?.removeItem(key) } catch { /* nothing to forget */ }
}
function browserStorage(): Storage | null {
  try { return typeof window === 'undefined' ? null : window.sessionStorage } catch { return null }
}

export interface StartScreenProps {
  scope: string | null; id?: string | null; planId?: string | null
  /** Replaces the default move to the session player (the dev harness stays on its own page). */
  onStarted?: (sessionId: string) => void
  pollBaseMs?: number
}

/**
 * /learn/practice/start: gets or creates the question set when the target needs one (polling with backoff while Co makes
 * it), then creates the session with a stable client id and moves to the player. Every request is idempotent, so a refresh
 * or a double press never makes a second set or session.
 */
export function StartScreen({ scope, id = null, planId = null, onStarted, pollBaseMs = 2000 }: StartScreenProps) {
  const router = useRouter()
  const client = useQueryClient()
  const { actor, band: identityBand } = useLearnIdentity()
  const band: LearnBand = identityBand ?? 'teens'
  const target = isStartScope(scope) ? scope : null
  const targetId = isPracticeId(id) ? id : null
  const plan = isPracticeId(planId) ? planId : null
  const valid = target !== null && (target === 'DUE' || targetId !== null) && (target !== 'TOPIC' || plan !== null)
  const setStep = target !== null && needsSet(target)

  /* 1. the question set, when the target needs one: idempotent get-or-create, once */
  const resolve = useQuery({
    queryKey: practiceKeys.setStart(actor, target ?? '', targetId ?? ''),
    queryFn: async (): Promise<PracticeSetSummary> => {
      if (target === 'SET') return (await practiceApi.set(targetId!)).set
      return (await practiceApi.createSet(target === 'MATERIAL' ? { materialId: targetId! } : { lessonId: targetId! })).set
    },
    enabled: !!actor && valid && setStep,
    retry: false, staleTime: 5000, gcTime: 10000, refetchOnWindowFocus: false,
  })
  /* a retry or a "make again" can answer with a newer set; from then on that one is followed */
  const [followed, setFollowed] = useState<string | null>(null)
  const setId = followed ?? resolve.data?.id ?? null
  const poll = useQuery({
    queryKey: practiceKeys.set(actor, setId ?? ''),
    queryFn: async () => (await practiceApi.set(setId!)).set,
    enabled: !!actor && !!setId,
    initialData: followed === null ? resolve.data : undefined, staleTime: Infinity,
    retry: false, gcTime: 10000, refetchOnWindowFocus: false,
    refetchInterval: query => {
      const status = query.state.data?.status
      return status === 'QUEUED' || status === 'RUNNING' ? pollDelay(query.state.dataUpdateCount, pollBaseMs) : false
    },
  })
  const set = setStep ? poll.data ?? null : null
  const refreshSet = () => client.invalidateQueries({ queryKey: practiceKeys.set(actor, setId ?? '') })
  const follow = (next: PracticeSetSummary) => {
    client.setQueryData(practiceKeys.set(actor, next.id), next)
    if (next.id !== setId) setFollowed(next.id); else void refreshSet()
  }
  const retry = useMutation({ mutationFn: () => practiceApi.retrySet(setId!), retry: false, onSuccess: ({ set: next }) => follow(next) })
  const cancel = useMutation({ mutationFn: () => practiceApi.cancelSet(setId!), retry: false, onSuccess: () => void refreshSet() })
  const again = useMutation({
    mutationFn: async () => (await practiceApi.createSet(target === 'MATERIAL' ? { materialId: targetId! } : { lessonId: targetId! })).set,
    retry: false, onSuccess: next => follow(next),
  })
  // A double press sends one request: the guard is a ref because state updates land after both clicks.
  const busy = useRef({ retry: false, cancel: false, again: false })
  const once = (key: 'retry' | 'cancel' | 'again', run: { mutate: (variables: void, options: { onSettled: () => void }) => void }) => () => {
    if (busy.current[key]) return
    busy.current[key] = true
    run.mutate(undefined, { onSettled: () => { busy.current[key] = false } })
  }

  /* 2. the session: a stable client id, one idempotent request, then on to the player */
  const storeKey = `${STORE_PREFIX}:${actor}:${target ?? ''}:${targetId ?? ''}:${plan ?? ''}`
  const [clientSessionId, setClientSessionId] = useState<string | null>(null)
  useEffect(() => { if (valid && actor) setClientSessionId(stableClientSessionId(storeKey)) }, [valid, actor, storeKey])
  const ready = valid && (!setStep || set?.status === 'READY')
  const sessionScope = target ? sessionScopeFor(target, targetId, plan, set?.id ?? null) : null
  const session = useQuery({
    queryKey: practiceKeys.sessionStart(actor, clientSessionId ?? ''),
    queryFn: () => practiceApi.createSession({ clientSessionId: clientSessionId!, mode: modeForScope(target!), scope: sessionScope! }),
    enabled: !!actor && !!clientSessionId && ready && sessionScope !== null,
    retry: false, staleTime: Infinity, gcTime: 10000, refetchOnWindowFocus: false,
  })
  const moved = useRef<string | null>(null)
  const sessionId = session.data?.session.id
  useEffect(() => {
    if (!sessionId || !isPracticeId(sessionId) || moved.current === sessionId) return
    moved.current = sessionId
    forgetClientSessionId(storeKey)
    if (onStarted) onStarted(sessionId); else router.replace(practiceRoutes.session(sessionId))
  }, [sessionId, onStarted, router, storeKey])

  if (!valid) return <PracticeNoTarget band={band} />
  if (setStep) {
    const setError = resolve.error ?? (poll.error && !set ? poll.error : null)
    if (setError && !resolve.isFetching) return <PracticeStartError error={setError} band={band} retry={() => { void resolve.refetch(); if (setId) void poll.refetch() }} />
    if (set) {
      if (set.status === 'QUEUED' || set.status === 'RUNNING') return <PracticeGenerating band={band} status={set.status} onCancel={once('cancel', cancel)} cancelling={cancel.isPending} error={cancel.error} />
      if (set.status === 'FAILED') return <PracticeSetFailed band={band} failure={set.failure} onRetry={once('retry', retry)} retrying={retry.isPending} error={retry.error} />
      if (set.status === 'CANCELLED') return <PracticeSetCancelled band={band} onAgain={target === 'SET' ? undefined : once('again', again)} again={again.isPending} />
    }
  }
  if (session.error && !session.isFetching) return <PracticeStartError error={session.error} band={band} retry={() => void session.refetch()} />
  return <LearnSkeleton band={band} label={target === 'PLAN_EXAM' ? 'Getting your mock test ready' : 'Getting your practice ready'} rows={2} />
}
