'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  cancelTutorTurn,
  createTutorSession,
  getTutorSession,
  getTutorTurn,
  retryTutorTurn,
  submitTutorTurn,
  type TutorCheckResponseInput,
  type TutorSessionSummaryItem,
  type TutorTurn,
  type TutorTurnResult,
} from '@/lib/api/tutor-loop/co'
import type { TutorContextDescriptor, TutorMode } from '@/lib/tutor-loop/open-tutor'
import { newClientRequestId } from './tutor-types'

/** Polling cadence for a queued turn. Final answers only; there is no token streaming (contract section 7). */
export const tutorPolling = { firstMs: 700, nextMs: 1200, maxMs: 45_000, maxConsecutiveErrors: 3 }

export type ExchangeStatus = 'sending' | 'queued' | 'ready' | 'failed' | 'cancelled'

export interface SendInput {
  text: string
  mode?: TutorMode
  checkResponse?: TutorCheckResponseInput
  /** Used only when this send has to create the session. */
  context?: TutorContextDescriptor
}

export interface Exchange {
  key: string
  clientRequestId: string
  learnerText: string | null
  mode: TutorMode | null
  turnId: string | null
  status: ExchangeStatus
  result: TutorTurnResult | null
  reasonCode: string | null
  retryable: boolean
  errorMessage: string | null
  retryAfterSeconds?: number
  input: SendInput | null
}

const RETRYABLE_CODES = new Set(['TUTOR_RESTING', 'AI_UNAVAILABLE', 'ATTEMPT_RATE_LIMIT'])

function errorParts(error: unknown): {
  code: string | null
  message: string
  retryAfterSeconds?: number
  retryable: boolean
} {
  const e = error as { code?: string; message?: string; status?: number; retryAfterSeconds?: number } | null
  const code = e?.code ?? null
  return {
    code,
    message: e?.message || 'Your tutor is resting. Try again soon.',
    retryAfterSeconds: e?.retryAfterSeconds,
    retryable: code ? RETRYABLE_CODES.has(code) : e?.status === undefined || e.status >= 500,
  }
}

function exchangeFromTurn(turn: TutorTurn): Exchange {
  const status: ExchangeStatus =
    turn.status === 'READY'
      ? 'ready'
      : turn.status === 'FAILED'
        ? 'failed'
        : turn.status === 'CANCELLED'
          ? 'cancelled'
          : 'queued'
  return {
    key: turn.id,
    clientRequestId: newClientRequestId(),
    learnerText: turn.learnerText ?? null,
    mode: turn.mode ?? null,
    turnId: turn.id,
    status,
    result: turn.result,
    reasonCode: turn.reasonCode,
    retryable: turn.retryable,
    errorMessage: null,
    input: null,
  }
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export interface UseTutorChatOptions {
  onSessionCreated?: (session: TutorSessionSummaryItem) => void
}

export function useTutorChat({ onSessionCreated }: UseTutorChatOptions = {}) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [session, setSession] = useState<TutorSessionSummaryItem | null>(null)
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<{ message: string; code: string | null } | null>(null)
  const sessionRef = useRef<string | null>(null)
  const alive = useRef(true)
  const cancelled = useRef<Set<string>>(new Set())
  const generation = useRef(0)
  const onCreated = useRef(onSessionCreated)
  onCreated.current = onSessionCreated

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const patch = useCallback((key: string, change: Partial<Exchange>) => {
    if (!alive.current) return
    setExchanges(rows => rows.map(row => (row.key === key ? { ...row, ...change } : row)))
  }, [])

  const poll = useCallback(
    async (sid: string, turnId: string, key: string, gen: number) => {
      const started = Date.now()
      let errors = 0
      let step = 0
      while (alive.current && gen === generation.current && Date.now() - started < tutorPolling.maxMs) {
        await sleep(step === 0 ? tutorPolling.firstMs : tutorPolling.nextMs)
        step += 1
        if (!alive.current || gen !== generation.current || cancelled.current.has(key)) return
        try {
          const turn = await getTutorTurn(sid, turnId)
          errors = 0
          if (gen !== generation.current) return
          if (turn.status === 'READY' || turn.status === 'FAILED' || turn.status === 'CANCELLED') {
            patch(key, {
              status: turn.status === 'READY' ? 'ready' : turn.status === 'FAILED' ? 'failed' : 'cancelled',
              result: turn.result,
              reasonCode: turn.reasonCode,
              retryable: turn.retryable,
              errorMessage: null,
            })
            return
          }
          patch(key, { status: 'queued' })
        } catch (error) {
          errors += 1
          if (errors >= tutorPolling.maxConsecutiveErrors) {
            const parts = errorParts(error)
            patch(key, {
              status: 'failed',
              reasonCode: parts.code,
              retryable: true,
              errorMessage: parts.message,
            })
            return
          }
        }
      }
      if (alive.current && gen === generation.current && !cancelled.current.has(key)) {
        patch(key, {
          status: 'failed',
          reasonCode: 'TUTOR_RESTING',
          retryable: true,
          errorMessage: 'This is taking longer than usual. Try again.',
        })
      }
    },
    [patch],
  )

  const runSend = useCallback(
    async (key: string, clientRequestId: string, input: SendInput) => {
      const gen = generation.current
      try {
        let sid = sessionRef.current
        if (!sid) {
          const created = await createTutorSession({
            clientRequestId: newClientRequestId(),
            context: input.context ?? { kind: 'GLOBAL' },
            mode: input.mode ?? 'ASK',
          })
          if (!alive.current || gen !== generation.current) return
          sid = created.id
          sessionRef.current = sid
          setSessionId(sid)
          setSession(created)
          onCreated.current?.(created)
        }
        const turn = await submitTutorTurn(sid, {
          clientRequestId,
          text: input.text,
          ...(input.mode ? { mode: input.mode } : {}),
          ...(input.checkResponse ? { checkResponse: input.checkResponse } : {}),
        })
        if (!alive.current || gen !== generation.current) return
        patch(key, {
          turnId: turn.id,
          status: turn.status === 'READY' ? 'ready' : turn.status === 'FAILED' ? 'failed' : 'queued',
          result: turn.result,
          reasonCode: turn.reasonCode,
          retryable: turn.retryable,
          errorMessage: null,
        })
        if (turn.status === 'QUEUED' || turn.status === 'CHECKING') await poll(sid, turn.id, key, gen)
      } catch (error) {
        const parts = errorParts(error)
        patch(key, {
          status: 'failed',
          reasonCode: parts.code,
          retryable: parts.retryable,
          retryAfterSeconds: parts.retryAfterSeconds,
          errorMessage: parts.message,
        })
      }
    },
    [patch, poll],
  )

  const send = useCallback(
    (input: SendInput) => {
      const text = input.text.trim()
      if (!text) return
      const key = newClientRequestId()
      const clientRequestId = newClientRequestId()
      const clean: SendInput = { ...input, text }
      setExchanges(rows => [
        ...rows,
        {
          key,
          clientRequestId,
          learnerText: text,
          mode: input.mode ?? null,
          turnId: null,
          status: 'sending',
          result: null,
          reasonCode: null,
          retryable: false,
          errorMessage: null,
          input: clean,
        },
      ])
      void runSend(key, clientRequestId, clean)
    },
    [runSend],
  )

  const retry = useCallback(
    async (key: string) => {
      const row = exchanges.find(item => item.key === key)
      if (!row) return
      const gen = generation.current
      const sid = sessionRef.current
      patch(key, { status: 'sending', errorMessage: null, reasonCode: null })
      if (sid && row.turnId && row.status === 'failed' && row.reasonCode !== 'TUTOR_RESTING') {
        try {
          const turn = await retryTutorTurn(sid, row.turnId, newClientRequestId())
          if (!alive.current || gen !== generation.current) return
          patch(key, { status: 'queued', turnId: turn.id, result: turn.result })
          await poll(sid, turn.id, key, gen)
          return
        } catch {
          // Fall through to a fresh send with the same request id, which the API treats as idempotent.
        }
      }
      if (row.input) await runSend(key, row.clientRequestId, row.input)
      else patch(key, { status: 'failed', retryable: false })
    },
    [exchanges, patch, poll, runSend],
  )

  const cancel = useCallback(
    async (key: string) => {
      const row = exchanges.find(item => item.key === key)
      const sid = sessionRef.current
      if (!row) return
      cancelled.current.add(key)
      patch(key, { status: 'cancelled', errorMessage: null })
      if (sid && row.turnId) {
        try {
          await cancelTutorTurn(sid, row.turnId, newClientRequestId())
        } catch {
          // The turn may already be finished; the next load shows its real state.
        }
      }
    },
    [exchanges, patch],
  )

  const openSession = useCallback(
    async (id: string) => {
      generation.current += 1
      const gen = generation.current
      sessionRef.current = id
      setSessionId(id)
      setLoading(true)
      setLoadError(null)
      setExchanges([])
      try {
        const detail = await getTutorSession(id)
        if (!alive.current || gen !== generation.current) return
        setSession(detail)
        const rows = detail.turns.map(turn => exchangeFromTurn(turn))
        setExchanges(rows)
        setLoading(false)
        const last = rows[rows.length - 1]
        if (last && last.status === 'queued' && last.turnId) void poll(id, last.turnId, last.key, gen)
      } catch (error) {
        if (!alive.current || gen !== generation.current) return
        const parts = errorParts(error)
        setLoadError({ message: parts.message, code: parts.code })
        setLoading(false)
      }
    },
    [poll],
  )

  const reset = useCallback(() => {
    generation.current += 1
    sessionRef.current = null
    setSessionId(null)
    setSession(null)
    setExchanges([])
    setLoadError(null)
    setLoading(false)
  }, [])

  const pending = exchanges.some(row => row.status === 'sending' || row.status === 'queued')

  return { sessionId, session, exchanges, loading, loadError, pending, send, retry, cancel, openSession, reset }
}
