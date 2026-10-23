'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLearnIdentity } from '@/components/learn/learn-common'
import { coErrorMessage } from '@/components/co/co-model'
import { newClientId } from '@/lib/api/co'
import { teachApi, teachPollDelay, isTerminalTeachTurn, type TeachContextQuery, type TeachTurn } from '@/lib/api/teach-back'
import { hasPendingTeach, mergeTeachTurns } from './teach-model'
import { browserTeachStorage, TeachSender, type TeachPending, type TeachStorage } from './teach-sender'

const fresh = { retry: false, staleTime: 0, gcTime: 0, refetchOnMount: 'always' as const, refetchOnWindowFocus: false }

export function useTeachContext(query: TeachContextQuery) {
  const { actor } = useLearnIdentity()
  return useQuery({
    queryKey: ['learn', actor, 'teach-context', query.practiceSessionId ?? null, query.materialId ?? null],
    queryFn: () => teachApi.context(query),
    enabled: !!actor && !!(query.practiceSessionId || query.materialId),
    ...fresh,
  })
}

export function useTeachSession(sessionId: string, options?: { pollBaseMs?: number; storage?: TeachStorage | null }) {
  const { actor } = useLearnIdentity()
  const cache = useQueryClient()
  const pollBaseMs = options?.pollBaseMs ?? 800
  const key = useMemo(() => ['learn', actor, 'teach-session', sessionId] as const, [actor, sessionId])
  const session = useQuery({ queryKey: key, queryFn: () => teachApi.session(sessionId), enabled: !!actor && !!sessionId, ...fresh })
  const [turns, setTurns] = useState<TeachTurn[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [pollProblem, setPollProblem] = useState<string | null>(null)
  const [pollNonce, setPollNonce] = useState(0)
  const seen = useRef<string | null>(null)

  useEffect(() => {
    if (!session.data) return
    const incoming = session.data.pending ? [...session.data.turns, session.data.pending] : session.data.turns
    setTurns(previous => mergeTeachTurns(previous, incoming))
  }, [session.data])

  const store = useMemo(() => options?.storage === null ? undefined : options?.storage ?? browserTeachStorage(), [options?.storage])
  const sender = useMemo(() => new TeachSender(body => teachApi.sendTurn(sessionId, body), { key: `colearner:teach:turn:${actor}:${sessionId}`, storage: store }), [actor, sessionId, store])
  const [unconfirmed, setUnconfirmed] = useState<TeachPending | null>(null)
  useEffect(() => { setUnconfirmed(sender.restore()) }, [sender])

  const pending = turns.find(turn => !isTerminalTeachTurn(turn)) ?? null
  const pendingId = pending?.id ?? null

  useEffect(() => {
    setPollProblem(null)
    if (!pendingId) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempt = 0
    let failures = 0
    const tick = async () => {
      try {
        const turn = await teachApi.turn(sessionId, pendingId)
        if (stopped) return
        failures = 0
        setTurns(previous => mergeTeachTurns(previous, [turn]))
        if (isTerminalTeachTurn(turn)) { void cache.invalidateQueries({ queryKey: key }); return }
      } catch (caught) {
        if (stopped) return
        failures += 1
        const status = (caught as { status?: number }).status
        if (status === 401 || status === 403 || status === 404 || failures >= 3) { setPollProblem(coErrorMessage(caught)); return }
      }
      attempt += 1
      timer = setTimeout(() => void tick(), teachPollDelay(attempt, pollBaseMs))
    }
    timer = setTimeout(() => void tick(), teachPollDelay(0, pollBaseMs))
    return () => { stopped = true; if (timer) clearTimeout(timer) }
  }, [pendingId, sessionId, pollBaseMs, pollNonce, cache, key])

  const send = useCallback(async (text: string) => {
    if (hasPendingTeach(turns)) return false
    setSending(true)
    setError(null)
    const outcome = unconfirmed ? await sender.resend() : await sender.send(text)
    setSending(false)
    if (outcome.status === 'busy') return false
    if (outcome.status === 'accepted') {
      setUnconfirmed(null)
      setTurns(previous => mergeTeachTurns(previous, [outcome.turn]))
      return true
    }
    if (outcome.status === 'unconfirmed') {
      setUnconfirmed(outcome.pending)
      setError('We could not send that. Your explanation is kept, so try again.')
      return false
    }
    setUnconfirmed(null)
    setError(coErrorMessage(outcome.error))
    return false
  }, [sender, turns, unconfirmed])

  const noted = (turnId: string) => {
    const freshTurn = seen.current !== turnId
    seen.current = turnId
    return freshTurn
  }

  return {
    session, turns, pending, sending, error, setError, pollProblem, resumePolling: () => setPollNonce(value => value + 1),
    unconfirmed, send, noted, clearDraftId: () => { sender.release(); setUnconfirmed(null) },
    newClientSessionId: newClientId,
  }
}
