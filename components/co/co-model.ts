import type { CoState } from '@/components/design-system'
import type { LearnBand } from '@/lib/api/learn'
import { LearnApiError, LearnSessionError } from '@/lib/api/learn-request'
import { sourceChipText } from '@/components/lesson/lesson-model'
import type { CoContextRef, CoReply, CoSource, CoTurnView } from './co-types'

/* ---------- limits and plain copy ---------- */

/** Longest message by band (CD1). The server enforces the same limits; the field only stops the learner earlier. */
export const messageLimit: Record<LearnBand, number> = { kids: 300, tweens: 500, teens: 1000 }
export const MAX_SUGGESTIONS = 3
export const minTargetPx: Record<LearnBand, number> = { kids: 64, tweens: 48, teens: 44 }
export const speechRateFor = (band: LearnBand) => band === 'kids' ? 0.85 : 1

export const GROUNDING_FOOTER = 'Co answers from your material and labels anything beyond it.'
export const SAFETY_LABEL = 'Safety check'
export const AI_HELPER_LABEL = 'Co is an AI helper'
export const VOICE_NOTE_TITLE = 'Voice isn’t available yet'

/** Who can read these chats. FULL is the transcript; SUMMARY is a summary and safety alerts only (decision D08). */
export function parentVisibilityNote(band: LearnBand, mode: 'FULL' | 'SUMMARY'): string {
  if (mode === 'SUMMARY') return band === 'kids' ? 'Your grown-up can see a summary of your chats with Co and any safety alerts.' : 'Your parent can see a summary of your chats with Co and any safety alerts.'
  return band === 'kids' ? 'Your grown-up can see your chats with Co.' : 'Your parent can see your chats with Co.'
}

export const pendingLabel = (band: LearnBand) => band === 'kids' ? 'Co is thinking' : 'Co is checking your material'
export const sendLabel = (band: LearnBand) => band === 'kids' ? 'Ask' : 'Send'
export const inputLabel = (band: LearnBand) => band === 'kids' ? 'Ask Co in your own words' : 'Ask Co a question'
export const emptyLine = (band: LearnBand, title: string | null) => band === 'kids'
  ? 'What do you want to know?'
  : title ? `Ask me anything about “${title}”.` : 'Ask me anything about your material.'

/* ---------- reply rules ---------- */

export interface ReplyView {
  /** A safety redirect shows only the code-owned guidance; every other reply shows the answer. */
  kind: 'answer' | 'safety'
  text: string
  /** True only when the server said so. */
  beyond: boolean
  beyondNote: string | null
  sources: CoSource[]
  suggestions: string[]
  keyPoints: string[]
  origin: 'AI' | 'CODE'
}

const isRedirect = (reply: CoReply) => reply.safety.redirected || reply.disposition === 'SAFE_REDIRECT' || reply.disposition === 'TRUSTED_ADULT'

/**
 * What a ready reply may show. The rules are deliberately small and total:
 * - "Beyond your material" only when `beyondMaterial` is true, with the note only then;
 * - a safety redirect shows the code-owned guidance VERBATIM (or the code-owned text when no separate guidance came) and
 *   nothing else: no sources, key points, suggestions or beyond tag, and no model text;
 * - at most three suggestions, at most four key points, and one chip per distinct source.
 */
export function replyView(reply: CoReply): ReplyView {
  const origin = reply.generatedBy.kind === 'CODE' ? 'CODE' : 'AI'
  if (isRedirect(reply)) {
    return { kind: 'safety', text: reply.safety.guidance ?? reply.text, beyond: false, beyondNote: null, sources: [], suggestions: [], keyPoints: [], origin }
  }
  const beyond = reply.beyondMaterial === true
  const seen = new Set<string>()
  const suggestions = reply.suggestions.map(item => item.trim()).filter(item => item && !seen.has(item.toLowerCase()) && !!seen.add(item.toLowerCase())).slice(0, MAX_SUGGESTIONS)
  return {
    kind: 'answer', text: reply.text, beyond, beyondNote: beyond ? reply.beyondNote : null,
    sources: uniqueSources(reply.sources), suggestions,
    keyPoints: (reply.keyPoints ?? []).filter(point => point.trim()).slice(0, 4), origin,
  }
}
export { sourceChipText }

/** One chip per distinct anchor and label. */
export function uniqueSources(sources: readonly CoSource[]): CoSource[] {
  const seen = new Set<string>()
  return sources.filter(source => { const key = `${source.anchorRef}\u0000${source.label}`; if (seen.has(key)) return false; seen.add(key); return true })
}

/* ---------- Co's pose ---------- */

export type PanelPhase = 'idle' | 'sending' | 'pending' | 'answered' | 'redirected' | 'failed'
/** Never `listening`: there is no microphone. Pending is the real thinking state. */
export function coPoseFor(phase: PanelPhase): CoState {
  switch (phase) {
    case 'idle': return 'waving'
    case 'sending': case 'pending': return 'thinking'
    case 'answered': return 'explaining'
    case 'redirected': case 'failed': return 'encouraging'
  }
}
export function phaseOf(turns: readonly CoTurnView[], sending: boolean): PanelPhase {
  if (sending) return 'sending'
  const last = turns[turns.length - 1]
  if (!last) return 'idle'
  if (last.status === 'QUEUED' || last.status === 'RUNNING') return 'pending'
  if (last.status === 'FAILED' || last.status === 'CANCELLED') return 'failed'
  return last.reply && replyView(last.reply).kind === 'safety' ? 'redirected' : 'answered'
}
export const coSizeFor = (band: LearnBand, empty: boolean) => band === 'kids' ? (empty ? 190 : 110) : band === 'tweens' ? (empty ? 130 : 84) : 56

/* ---------- announcements ---------- */

/** One polite sentence for the live region when a turn changes. Never partial text: only a finished reply is read out. */
export function announcementFor(turn: CoTurnView | undefined, band: LearnBand): string {
  if (!turn) return ''
  if (turn.status === 'QUEUED' || turn.status === 'RUNNING') return pendingLabel(band)
  if (turn.status === 'FAILED') return 'Co could not answer that. You can try again.'
  if (turn.status === 'CANCELLED') return 'That question was stopped.'
  if (!turn.reply) return ''
  const view = replyView(turn.reply)
  return view.kind === 'safety' ? `${SAFETY_LABEL}. ${view.text}` : `Co answered. ${view.text}`
}

/* ---------- failures and states ---------- */

const codeMessages: Record<string, string> = {
  CO_UNAVAILABLE: 'Ask Co is not switched on for you yet.',
  CO_DISABLED_BY_POLICY: 'Your school or family settings do not allow Ask Co right now.',
  CONTEXT_NOT_READY: 'This material is still being read. Ask Co can answer when it is ready.',
  CONTEXT_NOT_FOUND: 'We could not find that material. It may have been removed.',
  TURN_PENDING: 'Co is still answering your last question. One moment.',
  TURN_LIMIT_REACHED: 'You have asked Co a lot today. Come back tomorrow.',
  MESSAGE_INVALID: 'That message could not be sent. Check it and try again.',
  TURN_CONFLICT: 'That question changed on the way. Please ask it again.',
  CONVERSATION_NOT_FOUND: 'We could not find that chat. Please open Ask Co again.',
  POLICY_BLOCKED: 'Your school or family settings do not allow this right now.',
}
export const errorCodeOf = (error: unknown): string | undefined => {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : undefined
}
/** A learner-safe sentence for a failed call. The server's own text appears only for POLICY_BLOCKED (already mapped by the client). */
export function coErrorMessage(error: unknown, fallback = 'Ask Co is unavailable right now. Please try again.'): string {
  const code = errorCodeOf(error)
  if (code === 'POLICY_BLOCKED' && error instanceof Error && error.message) return error.message
  if (code && codeMessages[code]) return codeMessages[code]!
  if (error instanceof LearnSessionError) return error.message
  return error instanceof Error && error.message ? error.message : fallback
}

export type ProblemKind = 'unavailable' | 'policy' | 'not-ready' | 'not-found' | 'denied' | 'ended' | 'limit' | 'error'
export interface Problem { kind: ProblemKind; title: string; message: string; retryable: boolean }
/** Which calm state a failed load or start maps to. A session that ended never signs an adult out. */
export function problemFor(error: unknown): Problem {
  const message = coErrorMessage(error)
  if (error instanceof LearnSessionError) return { kind: 'ended', title: 'Your learning session ended', message, retryable: false }
  const code = errorCodeOf(error)
  if (code === 'CO_DISABLED_BY_POLICY' || code === 'POLICY_BLOCKED') return { kind: 'policy', title: 'Not right now', message, retryable: false }
  if (code === 'CO_UNAVAILABLE') return { kind: 'unavailable', title: 'Ask Co is not ready yet', message, retryable: false }
  if (code === 'CONTEXT_NOT_READY') return { kind: 'not-ready', title: 'Your material is not ready yet', message, retryable: true }
  if (code === 'TURN_LIMIT_REACHED') return { kind: 'limit', title: 'That is enough for today', message, retryable: false }
  const status = (error as { status?: number } | null)?.status
  if (code === 'CONTEXT_NOT_FOUND' || status === 403 || status === 404) return { kind: 'denied', title: 'You cannot open this', message: code ? message : 'This is unavailable, or you no longer have access to it.', retryable: false }
  return { kind: 'error', title: 'Ask Co could not load', message, retryable: true }
}

const failureText: Record<string, string> = {
  insufficient_source: 'There is not enough in your material to answer that.',
  unsafe_content: 'Co could not answer that one.',
  authorization_changed: 'Access to this material changed, so Co could not finish.',
  // The platform's other closed failure codes (co-contracts.ts NON_RETRYABLE_FAILURES) that a learner can meet.
  context_unavailable: 'This material is not available any more, so Co could not finish.',
  age_band_unsupported: 'Co cannot help with this one for your age group.',
  LESSON_ACCESS_CHANGED: 'Access to this material changed, so Co could not finish.',
  cancelled: 'That question was stopped.',
}
/** Reason text for a failed turn. Raw codes are never shown. */
export const failureMessage = (failure: { code: string } | null) => (failure && failureText[failure.code]) ?? 'Co could not finish that answer.'

/** True when the server may or may not have taken the request, so the SAME submission must be sent again (never a new one). */
export function isUnconfirmed(error: unknown): boolean {
  if (error instanceof LearnSessionError || (error instanceof Error && error.name === 'ZodError')) return false
  if (error instanceof LearnApiError) return error.status >= 500 || error.status === 408
  return true
}

/* ---------- context identity ---------- */

export const contextKey = (context: CoContextRef) => context.kind === 'LESSON' ? `lesson:${context.lessonId}` : `material:${context.materialId}`

/** Merges turns by id, keeping the newest copy of each, ordered by ordinal. */
export function mergeTurns(current: readonly CoTurnView[], incoming: readonly CoTurnView[]): CoTurnView[] {
  const byId = new Map(current.map(turn => [turn.id, turn]))
  for (const turn of incoming) byId.set(turn.id, turn)
  return [...byId.values()].sort((a, b) => a.ordinal - b.ordinal)
}
