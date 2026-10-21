import { newClientId } from './co-client'
import { isUnconfirmed } from './co-model'
import type { CoStyle, CoTurnBody, CoTurnView } from './co-types'

/*
 * Idempotent sending of one Ask Co message (the B10 "never double-send" rule).
 * One logical message owns one `clientTurnId`. The id is created when the learner presses Send and is REUSED, with the
 * identical text, for every re-send of that message, so the server (unique on conversation + clientTurnId) answers with
 * the turn it already holds and never creates a second one. A new id exists only for a new message: after the server took
 * the message, or after it definitely refused it. The framework-free class is unit-tested directly; the hook wires it to state.
 */
export interface PendingSend { clientTurnId: string; text: string; style: CoStyle | null; stepIndex: number | null }

export interface SendStorage {
  get(key: string): PendingSend | null
  set(key: string, value: PendingSend): void
  remove(key: string): void
}

const isPendingSend = (value: unknown): value is PendingSend => {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.clientTurnId === 'string' && typeof record.text === 'string'
    && (record.style === null || record.style === 'SIMPLE' || record.style === 'EXAM') && (record.stepIndex === null || typeof record.stepIndex === 'number')
}

/** sessionStorage, where it exists. Every access is guarded: private windows and blocked storage must never break asking. */
export function browserSendStorage(): SendStorage | undefined {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return undefined
    const store = window.sessionStorage
    return {
      get: key => { try { const raw = store.getItem(key); const parsed: unknown = raw ? JSON.parse(raw) : null; return isPendingSend(parsed) ? parsed : null } catch { return null } },
      set: (key, value) => { try { store.setItem(key, JSON.stringify(value)) } catch { /* the in-memory copy still protects this page */ } },
      remove: key => { try { store.removeItem(key) } catch { /* nothing to clean */ } },
    }
  } catch { return undefined }
}
export const sendStorageKey = (contextKey: string) => `colearner:co:turn:${contextKey}`

export interface SenderPorts {
  /** Idempotent get-or-create of the conversation; resolves its id. */
  conversationId: () => Promise<string>
  send: (conversationId: string, body: CoTurnBody) => Promise<CoTurnView>
}

export type SendOutcome =
  /** The server took the message (or replayed the turn it already held). */
  | { status: 'accepted'; turn: CoTurnView; conversationId: string; body: CoTurnBody }
  /** The server definitely refused it; the next press is a new message with a new id. */
  | { status: 'refused'; error: unknown }
  /** We do not know whether it arrived; the SAME message is sent again. */
  | { status: 'unconfirmed'; error: unknown; pending: PendingSend }
  /** A request is already in flight; nothing was sent. */
  | { status: 'busy' }

export class TurnSender {
  private current: PendingSend | null = null
  private inFlight = false
  constructor(private readonly ports: SenderPorts, private readonly options: { key: string; storage?: SendStorage; newId?: () => string }) {}

  /** A message stored by an earlier page (refreshed mid-send), or null. Sending it again is always safe: the server takes it once or replays it. */
  restore(): PendingSend | null {
    if (this.current) return this.current
    const stored = this.options.storage?.get(this.options.key) ?? null
    if (stored) this.current = stored
    return stored
  }
  /** The message whose outcome is not known yet, if any. While it exists the composer is locked to it. */
  get unconfirmed(): PendingSend | null { return this.current }
  get busy(): boolean { return this.inFlight }

  /** Starts a message, or re-sends the unconfirmed one (a changed text is ignored: the id must keep meaning one message). */
  async send(text: string, style: CoStyle | null, stepIndex: number | null): Promise<SendOutcome> {
    if (this.inFlight) return { status: 'busy' }
    const clean = text.trim()
    if (!this.current) {
      if (!clean) return { status: 'refused', error: new Error('Write something to ask Co first.') }
      this.current = { clientTurnId: (this.options.newId ?? newClientId)(), text: clean, style, stepIndex }
      this.options.storage?.set(this.options.key, this.current)
    }
    return this.dispatch()
  }
  /** Sends the unconfirmed message again, unchanged. */
  async resend(): Promise<SendOutcome> {
    if (this.inFlight) return { status: 'busy' }
    if (!this.current) return { status: 'refused', error: new Error('Nothing to send.') }
    return this.dispatch()
  }

  private async dispatch(): Promise<SendOutcome> {
    const pending = this.current!
    const body: CoTurnBody = { clientTurnId: pending.clientTurnId, text: pending.text, ...(pending.style ? { style: pending.style } : {}), ...(pending.stepIndex !== null ? { stepIndex: pending.stepIndex } : {}) }
    this.inFlight = true
    try {
      const conversationId = await this.ports.conversationId()
      const turn = await this.ports.send(conversationId, body)
      this.clear()
      return { status: 'accepted', turn, conversationId, body }
    } catch (error) {
      if (isUnconfirmed(error)) return { status: 'unconfirmed', error, pending }
      this.clear()
      return { status: 'refused', error }
    } finally { this.inFlight = false }
  }
  clear() { this.current = null; this.options.storage?.remove(this.options.key) }
}
