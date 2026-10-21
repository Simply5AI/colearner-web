'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { coApi, coPollDelay } from './co-client'
import { coErrorMessage, contextKey, errorCodeOf, mergeTurns, problemFor, type Problem } from './co-model'
import { isTerminalTurn, type CoContextRef, type CoContextView, type CoStyle, type CoTurnView } from './co-types'
import { browserSendStorage, sendStorageKey, TurnSender, type PendingSend, type SendOutcome, type SendStorage } from './turn-sender'

export const coKeys = {
  context: (actor: string, ref: CoContextRef) => ['learn', actor, 'co-context', contextKey(ref), ref.kind === 'LESSON' ? ref.stepIndex : null] as const,
  history: (actor: string, conversationId: string) => ['learn', actor, 'co-conversation', conversationId] as const,
}

/** The context for a lesson step or a material: availability and its reason, source, code-owned suggestions, open conversation. */
export function useCoContext(actor: string, ref: CoContextRef, enabled = true) {
  return useQuery({
    queryKey: coKeys.context(actor, ref),
    queryFn: () => coApi.context(ref),
    enabled: !!actor && enabled,
    retry: false, staleTime: 0, gcTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: false,
  })
}

export interface UseCoChatOptions {
  actor: string
  context: CoContextRef
  view: CoContextView
  /** Polling base in milliseconds (800 in production; tests shorten it). */
  pollBaseMs?: number
  /** After this long a pending turn offers "stop waiting". */
  slowAfterMs?: number
  /** `undefined` uses sessionStorage; `null` disables storage. */
  storage?: SendStorage | null
}

export interface CoChat {
  turns: CoTurnView[]
  /** The turn Co is working on (QUEUED or RUNNING), if any. At most one per conversation. */
  pending: CoTurnView | null
  sending: boolean
  sendingText: string | null
  /** A message whose outcome is unknown: the same message (and id) is sent again by `resend`. */
  unconfirmed: PendingSend | null
  error: string | null
  clearError: () => void
  historyLoading: boolean
  historyProblem: Problem | null
  reloadHistory: () => void
  pollProblem: Problem | null
  resumePolling: () => void
  slow: boolean
  /** True when the message was taken (the caller may clear its draft). */
  send: (text: string, style: CoStyle | null) => Promise<boolean>
  resend: () => Promise<boolean>
  retryTurn: (turn: CoTurnView) => Promise<void>
  stopTurn: (turn: CoTurnView) => Promise<void>
  /** True for a turn that was sent, or seen working, in this visit; only those are announced, never the history. */
  isFresh: (turnId: string) => boolean
  /** Always the same instance while the panel is mounted; exposed so tests can prove id reuse. */
  sender: TurnSender
}

/**
 * One Ask Co conversation for one context. The conversation is created lazily on the first message (idempotent get-or-create),
 * messages are sent through {@link TurnSender} (one id per message, reused on retry), and a pending turn is polled with the
 * fast backoff until it is READY, FAILED or CANCELLED. Only finished replies are ever shown: there is no partial text.
 */
export function useCoChat({ actor, context, view, pollBaseMs = 800, slowAfterMs = 20000, storage }: UseCoChatOptions): CoChat {
  const stepIndex = context.kind === 'LESSON' ? context.stepIndex : null
  const openId = view.openConversationId
  const [conversationId, setConversationId] = useState<string | null>(openId)
  const conversationRef = useRef<string | null>(openId)
  const [turns, setTurns] = useState<CoTurnView[]>([])
  const [sending, setSending] = useState(false)
  const [sendingText, setSendingText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pollProblem, setPollProblem] = useState<Problem | null>(null)
  const [pollNonce, setPollNonce] = useState(0)
  const [slow, setSlow] = useState(false)
  const busy = useRef({ send: false, turn: false })
  const contextRef = useRef(context)
  contextRef.current = context
  const fresh = useRef(new Set<string>())

  // The conversation id: whatever the context said is open, else created on the first message.
  const ports = useMemo(() => ({
    conversationId: async () => {
      if (conversationRef.current) return conversationRef.current
      const created = await coApi.conversation(contextRef.current)
      conversationRef.current = created.id
      setConversationId(created.id)
      return created.id
    },
    send: coApi.send,
  }), [])
  const key = sendStorageKey(contextKey(context))
  // One storage object and one sender for the life of the panel: a new sender per render would forget the unconfirmed message.
  const store = useMemo(() => storage === null ? undefined : storage ?? browserSendStorage(), [storage])
  const sender = useMemo(() => new TurnSender(ports, { key, storage: store }), [ports, key, store])
  const [unconfirmed, setUnconfirmed] = useState<PendingSend | null>(() => sender.restore())

  // History of this conversation, loaded once when one is open. A pending turn found there is polled again after a reopen or refresh.
  const history = useQuery({
    queryKey: coKeys.history(actor, openId ?? ''),
    queryFn: () => coApi.history(openId!),
    enabled: !!actor && !!openId,
    retry: false, staleTime: 0, gcTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: false,
  })
  useEffect(() => {
    if (!history.data) return
    const incoming = history.data.pending ? [...history.data.turns, history.data.pending] : history.data.turns
    setTurns(previous => mergeTurns(previous, incoming))
  }, [history.data])
  useEffect(() => {
    // A conversation that no longer exists is replaced by a fresh one on the next message.
    if (history.error && errorCodeOf(history.error) === 'CONVERSATION_NOT_FOUND') { conversationRef.current = null; setConversationId(null) }
  }, [history.error])
  const historyProblem = history.error && errorCodeOf(history.error) !== 'CONVERSATION_NOT_FOUND' ? problemFor(history.error) : null

  const pending = useMemo(() => turns.find(turn => !isTerminalTurn(turn)) ?? null, [turns])
  const pendingId = pending?.id ?? null

  useEffect(() => {
    setPollProblem(null)
    setSlow(false)
    if (!pendingId || !conversationId) return
    fresh.current.add(pendingId)
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempt = 0
    let failures = 0
    const slowTimer = setTimeout(() => { if (!stopped) setSlow(true) }, slowAfterMs)
    const tick = async () => {
      try {
        const turn = await coApi.turn(conversationId, pendingId)
        if (stopped) return
        failures = 0
        setTurns(previous => mergeTurns(previous, [turn]))
        if (isTerminalTurn(turn)) return
      } catch (caught) {
        if (stopped) return
        failures += 1
        const status = (caught as { status?: number } | null)?.status
        if (status === 401 || status === 403 || status === 404 || failures >= 3) { setPollProblem(problemFor(caught)); return }
      }
      attempt += 1
      timer = setTimeout(() => void tick(), coPollDelay(attempt, pollBaseMs))
    }
    timer = setTimeout(() => void tick(), coPollDelay(0, pollBaseMs))
    return () => { stopped = true; if (timer) clearTimeout(timer); clearTimeout(slowTimer) }
  }, [pendingId, conversationId, pollBaseMs, slowAfterMs, pollNonce])

  const handle = useCallback((outcome: SendOutcome): boolean => {
    if (outcome.status === 'busy') return false
    if (outcome.status === 'accepted') {
      setUnconfirmed(null); setError(null)
      fresh.current.add(outcome.turn.id)
      setTurns(previous => mergeTurns(previous, [outcome.turn]))
      conversationRef.current = outcome.conversationId
      setConversationId(outcome.conversationId)
      return true
    }
    if (outcome.status === 'unconfirmed') {
      setUnconfirmed(outcome.pending)
      setError('We could not send that. Your message is kept, so try again.')
      return false
    }
    setUnconfirmed(null)
    const code = errorCodeOf(outcome.error)
    setError(coErrorMessage(outcome.error))
    // Another turn is already being answered (for example from another tab): load it so it is shown and polled.
    if (code === 'TURN_PENDING') void history.refetch()
    if (code === 'CONVERSATION_NOT_FOUND') { conversationRef.current = null; setConversationId(null) }
    return false
  }, [history])

  const run = useCallback(async (text: string, style: CoStyle | null, again: boolean): Promise<boolean> => {
    if (busy.current.send || pendingId) return false
    busy.current.send = true
    setSending(true); setSendingText(again ? sender.unconfirmed?.text ?? text : text.trim()); setError(null)
    try { return handle(again ? await sender.resend() : await sender.send(text, style, stepIndex)) }
    finally { busy.current.send = false; setSending(false); setSendingText(null) }
  }, [handle, pendingId, sender, stepIndex])

  const send = useCallback((text: string, style: CoStyle | null) => run(text, style, false), [run])
  const resend = useCallback(() => run('', null, true), [run])

  const act = useCallback(async (turn: CoTurnView, call: (conversation: string, turnId: string) => Promise<CoTurnView>, replaces: boolean) => {
    if (busy.current.turn || !conversationRef.current) return
    busy.current.turn = true; setError(null)
    try {
      const next = await call(conversationRef.current, turn.id)
      // A retry is a NEW turn that takes the place of the failed one (the platform hides a retried failure from the transcript).
      setTurns(previous => mergeTurns(replaces && next.id !== turn.id ? previous.filter(item => item.id !== turn.id) : previous, [next]))
    }
    catch (caught) { setError(coErrorMessage(caught)) }
    finally { busy.current.turn = false }
  }, [])
  const retryTurn = useCallback((turn: CoTurnView) => act(turn, coApi.retry, true), [act])
  const stopTurn = useCallback((turn: CoTurnView) => act(turn, coApi.cancel, false), [act])

  return {
    turns, pending, sending, sendingText, unconfirmed, error, clearError: () => setError(null),
    historyLoading: !!openId && history.isPending, historyProblem, reloadHistory: () => void history.refetch(),
    pollProblem, resumePolling: () => setPollNonce(value => value + 1), slow,
    send, resend, retryTurn, stopTurn, isFresh: turnId => fresh.current.has(turnId), sender,
  }
}
