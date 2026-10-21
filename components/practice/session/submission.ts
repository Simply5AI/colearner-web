import { answersEqual } from '../questions/answers'
import { isUnconfirmed } from './session-model'
import type { AnswerBody, AnswerReceipt, PracticeAnswer } from './practice-types'

/*
 * Idempotent answer submission (F-L10-08). One logical submission owns one `clientAttemptId`. The id is created when the
 * learner presses Check and is REUSED, with the identical answer, for every re-send of that submission, so the server
 * (unique on itemId + clientAttemptId) replays the stored attempt and never records a second one. A new id exists only
 * for a new attempt (after a receipt, or after the server definitely refused the answer). The framework-free class is
 * unit-tested directly; the React hook only wires it to state.
 */
export interface Submission { clientAttemptId: string; attemptNo: number; answer: PracticeAnswer; timeSpentMs: number }

export interface SubmissionStorage {
  get(key: string): Submission | null
  set(key: string, value: Submission): void
  remove(key: string): void
}

/** A UUID v4. `crypto.randomUUID` needs a secure context, so a plain fallback keeps the id unique on insecure development hosts. */
export function newAttemptId(): string {
  const c = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const bytes = new Uint8Array(16)
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes)
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const isSubmission = (value: unknown): value is Submission => {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.clientAttemptId === 'string' && typeof record.attemptNo === 'number' && typeof record.timeSpentMs === 'number'
    && !!record.answer && typeof (record.answer as Record<string, unknown>).kind === 'string'
}

/** sessionStorage, where it exists. Every access is guarded: private windows and blocked storage must never break answering. */
export function browserSubmissionStorage(): SubmissionStorage | undefined {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return undefined
    const store = window.sessionStorage
    return {
      get: key => { try { const raw = store.getItem(key); const parsed: unknown = raw ? JSON.parse(raw) : null; return isSubmission(parsed) ? parsed : null } catch { return null } },
      set: (key, value) => { try { store.setItem(key, JSON.stringify(value)) } catch { /* the in-memory copy still protects this page */ } },
      remove: key => { try { store.removeItem(key) } catch { /* nothing to clean */ } },
    }
  } catch { return undefined }
}
export const submissionKey = (sessionId: string, index: number) => `colearner:practice:submission:${sessionId}:${index}`

export type SubmitOutcome =
  /** The server took the answer (or replayed the stored one). */
  | { status: 'receipt'; receipt: AnswerReceipt; body: AnswerBody }
  /** The server definitely refused it; the next press is a new submission with a new id. */
  | { status: 'refused'; error: unknown }
  /** We do not know whether it arrived; the SAME submission is sent again. */
  | { status: 'unconfirmed'; error: unknown; body: AnswerBody }
  /** A request is already in flight; nothing was sent. */
  | { status: 'busy' }

export interface ControllerOptions { key: string; attemptNo: number; storage?: SubmissionStorage; newId?: () => string }

export class SubmissionController {
  private current: Submission | null = null
  private inFlight = false
  constructor(private readonly send: (body: AnswerBody) => Promise<AnswerReceipt>, private readonly options: ControllerOptions) {}

  /**
   * A stored submission for this item (the page was refreshed while an answer was in flight), or null. Storage is cleared on
   * every definite outcome, so a stored one is always unconfirmed and sending it again is always safe: the server either
   * takes it for the first time or replays the attempt it already holds.
   */
  restore(): Submission | null {
    if (this.current) return this.current
    const stored = this.options.storage?.get(this.options.key) ?? null
    if (stored) this.current = stored
    return stored
  }
  /** The submission whose outcome is not known yet, if any. While it exists the learner's answer is locked to it. */
  get unconfirmed(): Submission | null { return this.current }
  get busy(): boolean { return this.inFlight }

  /** Starts a submission, or re-sends the existing unconfirmed one (ignoring a changed answer: the id must keep meaning one answer). */
  async submit(answer: PracticeAnswer, timeSpentMs: number): Promise<SubmitOutcome> {
    if (this.inFlight) return { status: 'busy' }
    if (!this.current) {
      this.current = { clientAttemptId: (this.options.newId ?? newAttemptId)(), attemptNo: this.options.attemptNo, answer, timeSpentMs: Math.max(0, Math.round(timeSpentMs)) }
      this.options.storage?.set(this.options.key, this.current)
    }
    return this.dispatch()
  }
  /** Sends the unconfirmed submission again, unchanged. */
  async resend(): Promise<SubmitOutcome> {
    if (this.inFlight) return { status: 'busy' }
    if (!this.current) return { status: 'refused', error: new Error('Nothing to send.') }
    return this.dispatch()
  }

  private async dispatch(): Promise<SubmitOutcome> {
    const submission = this.current!
    const body: AnswerBody = { clientAttemptId: submission.clientAttemptId, answer: submission.answer, timeSpentMs: submission.timeSpentMs }
    this.inFlight = true
    try {
      const receipt = await this.send(body)
      this.clear()
      return { status: 'receipt', receipt, body }
    } catch (error) {
      if (isUnconfirmed(error)) return { status: 'unconfirmed', error, body }
      this.clear()
      return { status: 'refused', error }
    } finally { this.inFlight = false }
  }
  clear() { this.current = null; this.options.storage?.remove(this.options.key) }
  /** True when `answer` is the one this submission already carries. */
  carries(answer: PracticeAnswer): boolean { return !!this.current && answersEqual(this.current.answer, answer) }
}
