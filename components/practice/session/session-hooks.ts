'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLearnIdentity } from '@/components/learn/learn-common'
import { practiceSessionApi } from './session-api'
import { browserSubmissionStorage, submissionKey, SubmissionController, type Submission } from './submission'
import type { AnswerBody, AnswerReceipt, PracticeAnswer } from './practice-types'

export const practiceKeys = {
  session: (actor: string, sessionId: string) => ['learn', actor, 'practice-session', sessionId] as const,
  question: (actor: string, sessionId: string, index: number) => ['learn', actor, 'practice-session', sessionId, 'question', index] as const,
}

/** The session as the server sees it (progress and remaining time). Always fresh; never refetched behind the learner's back. */
export function useSessionState(sessionId: string) {
  const { actor } = useLearnIdentity()
  return useQuery({
    queryKey: practiceKeys.session(actor, sessionId),
    queryFn: () => practiceSessionApi.session(sessionId),
    enabled: !!actor && !!sessionId,
    retry: false, staleTime: 0, gcTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: false,
  })
}

/** One item's learner view. Fetched when the learner reaches it (never ahead), so attemptNo and the option order are current. */
export function useQuestion(sessionId: string, index: number) {
  const { actor } = useLearnIdentity()
  return useQuery({
    queryKey: practiceKeys.question(actor, sessionId, index),
    queryFn: () => practiceSessionApi.question(sessionId, index),
    enabled: !!actor && !!sessionId && index >= 0,
    retry: false, staleTime: 0, gcTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: false,
  })
}

/**
 * Seconds left, counted down locally from the SERVER's `remainingSec`. The local count only drives the display: every
 * new server value (`syncKey` changes) replaces it, and the server alone decides when time is up.
 */
export function useCountdown(remainingSec: number | null, syncKey: number): number | null {
  const [left, setLeft] = useState<number | null>(remainingSec)
  useEffect(() => {
    if (remainingSec === null) { setLeft(null); return }
    const startedAt = performance.now()
    setLeft(remainingSec)
    const timer = setInterval(() => setLeft(Math.max(0, Math.ceil(remainingSec - (performance.now() - startedAt) / 1000))), 1000)
    return () => clearInterval(timer)
  }, [remainingSec, syncKey])
  return left
}

export type SubmitStatus = 'idle' | 'sending' | 'unconfirmed'
export interface AnswerSubmission {
  status: SubmitStatus
  error: unknown
  receipt: AnswerReceipt | null
  /** The exact body that produced the receipt; a poll re-sends it unchanged. */
  body: AnswerBody | null
  /** A submission found in sessionStorage (the page was refreshed while an answer was in flight), restored locked. */
  restored: Submission | null
  submit: (answer: PracticeAnswer, timeSpentMs: number) => void
  resend: () => void
  /** Drops the receipt so the learner can try again (a new attempt gets a new clientAttemptId). */
  clearReceipt: () => void
  setReceipt: (receipt: AnswerReceipt) => void
}

/**
 * Wires the framework-free SubmissionController to React. Presses are guarded twice: a ref in the controller (the
 * second press in the same tick is `busy`) and the `sending` status that disables the button.
 */
export function useAnswerSubmission({ sessionId, index, attemptNo, onReceipt, onRefused }: {
  sessionId: string; index: number; attemptNo: number
  onReceipt?: (receipt: AnswerReceipt) => void
  onRefused?: (error: unknown) => void
}): AnswerSubmission {
  const controllerKey = `${sessionId}:${index}:${attemptNo}`
  const holder = useRef<{ key: string; controller: SubmissionController } | null>(null)
  if (!holder.current || holder.current.key !== controllerKey) {
    holder.current = {
      key: controllerKey,
      controller: new SubmissionController(body => practiceSessionApi.answer(sessionId, index, body), { key: submissionKey(sessionId, index), attemptNo, storage: browserSubmissionStorage() }),
    }
  }
  const controller = holder.current.controller
  const [restored] = useState(() => controller.restore())
  const [status, setStatus] = useState<SubmitStatus>(restored ? 'unconfirmed' : 'idle')
  const [error, setError] = useState<unknown>(null)
  const [receipt, setReceiptState] = useState<AnswerReceipt | null>(null)
  const [body, setBody] = useState<AnswerBody | null>(null)
  const callbacks = useRef({ onReceipt, onRefused })
  callbacks.current = { onReceipt, onRefused }
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const settle = useCallback((outcome: Awaited<ReturnType<SubmissionController['submit']>>) => {
    if (!alive.current || outcome.status === 'busy') return
    if (outcome.status === 'receipt') { setError(null); setBody(outcome.body); setReceiptState(outcome.receipt); setStatus('idle'); callbacks.current.onReceipt?.(outcome.receipt) }
    else if (outcome.status === 'unconfirmed') { setError(outcome.error); setStatus('unconfirmed') }
    else { setError(outcome.error); setStatus('idle'); callbacks.current.onRefused?.(outcome.error) }
  }, [])
  const submit = useCallback((answer: PracticeAnswer, timeSpentMs: number) => {
    if (controller.busy) return
    setStatus('sending'); setError(null)
    void controller.submit(answer, timeSpentMs).then(settle)
  }, [controller, settle])
  const resend = useCallback(() => {
    if (controller.busy) return
    setStatus('sending'); setError(null)
    void controller.resend().then(settle)
  }, [controller, settle])
  const clearReceipt = useCallback(() => { setReceiptState(null); setBody(null); setError(null) }, [])

  // A submission restored after a refresh is sent again once, unchanged: the server replays it if it already took it.
  const resent = useRef(false)
  useEffect(() => {
    if (!restored || resent.current) return
    resent.current = true
    resend()
  }, [restored, resend])

  return useMemo(() => ({ status, error, receipt, body, restored, submit, resend, clearReceipt, setReceipt: setReceiptState }), [status, error, receipt, body, restored, submit, resend, clearReceipt])
}

export interface PollTiming { baseMs?: number; capMs?: number; giveUpMs?: number }
/**
 * While the answer is PENDING_FEEDBACK ("Co is checking…"), asks again with growing gaps by re-sending the same
 * submission (same clientAttemptId), which the server answers with the stored attempt's current state. Stops when the
 * state settles, when the item is left, or after `giveUpMs`, when the learner can check again by hand.
 */
export function usePendingPoll({ active, poll, onReceipt, timing }: { active: boolean; poll: () => Promise<AnswerReceipt>; onReceipt: (receipt: AnswerReceipt) => void; timing?: PollTiming }) {
  const [gaveUp, setGaveUp] = useState(false)
  const [round, setRound] = useState(0)
  const latest = useRef({ poll, onReceipt })
  latest.current = { poll, onReceipt }
  const { baseMs = 1500, capMs = 8000, giveUpMs = 90000 } = timing ?? {}
  useEffect(() => {
    if (!active) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const startedAt = Date.now()
    setGaveUp(false)
    const step = (attempt: number) => {
      timer = setTimeout(async () => {
        if (cancelled) return
        try {
          const receipt = await latest.current.poll()
          if (cancelled) return
          if (receipt.attempt.status !== 'PENDING_FEEDBACK') { latest.current.onReceipt(receipt); return }
        } catch { /* a blip: ask again until the time is up */ }
        if (cancelled) return
        if (Date.now() - startedAt >= giveUpMs) { setGaveUp(true); return }
        step(attempt + 1)
      }, Math.min(capMs, Math.round(baseMs * 1.6 ** attempt)))
    }
    step(0)
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [active, baseMs, capMs, giveUpMs, round])
  return { gaveUp, checkAgain: useCallback(() => setRound(value => value + 1), []) }
}
