import { newClientId } from '@/lib/api/co'
import type { TeachTurn, TeachTurnBody } from '@/lib/api/teach-back'
import { isUnconfirmedTeach } from './teach-model'

/** One explanation owns one clientTurnId, reused until the server accepts or refuses it. */
export interface TeachPending { clientTurnId: string; text: string }
export interface TeachStorage {
  get(key: string): TeachPending | null
  set(key: string, value: TeachPending): void
  remove(key: string): void
}
export type TeachSendOutcome =
  | { status: 'accepted'; turn: TeachTurn; body: TeachTurnBody }
  | { status: 'refused'; error: unknown }
  | { status: 'unconfirmed'; error: unknown; pending: TeachPending }
  | { status: 'busy' }

const isPending = (value: unknown): value is TeachPending => {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.clientTurnId === 'string' && typeof record.text === 'string'
}

export function browserTeachStorage(): TeachStorage | undefined {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return undefined
    const store = window.sessionStorage
    return {
      get: key => { try { const raw = store.getItem(key); const parsed: unknown = raw ? JSON.parse(raw) : null; return isPending(parsed) ? parsed : null } catch { return null } },
      set: (key, value) => { try { store.setItem(key, JSON.stringify(value)) } catch { /* in-memory copy still covers this page */ } },
      remove: key => { try { store.removeItem(key) } catch { /* nothing to clean */ } },
    }
  } catch { return undefined }
}

export class TeachSender {
  private current: TeachPending | null = null
  private inFlight = false
  constructor(private readonly sendTurn: (body: TeachTurnBody) => Promise<TeachTurn>, private readonly options: { key: string; storage?: TeachStorage; newId?: () => string }) {}

  restore(): TeachPending | null {
    if (this.current) return this.current
    const stored = this.options.storage?.get(this.options.key) ?? null
    if (stored) this.current = stored
    return stored
  }
  get unconfirmed(): TeachPending | null { return this.current }

  async send(text: string): Promise<TeachSendOutcome> {
    if (this.inFlight) return { status: 'busy' }
    const clean = text.trim()
    if (!this.current) {
      if (!clean) return { status: 'refused', error: new Error('Write your explanation first.') }
      this.current = { clientTurnId: (this.options.newId ?? newClientId)(), text: clean }
      this.options.storage?.set(this.options.key, this.current)
    }
    return this.dispatch()
  }

  async resend(): Promise<TeachSendOutcome> {
    if (this.inFlight) return { status: 'busy' }
    if (!this.current) return { status: 'refused', error: new Error('Nothing to send.') }
    return this.dispatch()
  }

  /** A finished failure is a new message. A lost request keeps its id. */
  release() { this.current = null; this.options.storage?.remove(this.options.key) }

  private async dispatch(): Promise<TeachSendOutcome> {
    const pending = this.current!
    const body: TeachTurnBody = { clientTurnId: pending.clientTurnId, text: pending.text }
    this.inFlight = true
    try {
      const turn = await this.sendTurn(body)
      this.release()
      return { status: 'accepted', turn, body }
    } catch (error) {
      if (isUnconfirmedTeach(error)) return { status: 'unconfirmed', error, pending }
      this.release()
      return { status: 'refused', error }
    } finally { this.inFlight = false }
  }
}
