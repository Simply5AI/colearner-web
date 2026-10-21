import type { LearnBand } from '@/lib/api/learn'
import {
  isSafetyReply, type CoReply, type CoTurnView, type FinalVerdict, type HomeworkDetail, type HomeworkStep, type ParentVisibilityMode,
} from '@/lib/api/co'

/* ---------- limits and wording per band (web-owned copy) ---------- */

/** The typed problem by band (platform TEXT_LIMITS: 6-9: 300, 10-13: 600, 14-17: 1000). The server checks the same limits. */
export const problemLimit: Record<LearnBand, number> = { kids: 300, tweens: 600, teens: 1000 }
/** A step answer by band (6-9: 300, 10-13: 500, 14-17: 1000). */
export const responseLimit: Record<LearnBand, number> = { kids: 300, tweens: 500, teens: 1000 }
/** The learner's own final answer. */
export const finalLimit = 200
export const maxFinalTries = 3

export const AI_LABEL = 'Co is an AI helper'

/** The notice the learner sees about who can see their homework help (contract wording for the three bands). */
export const parentNotices = {
  kids: 'Your grown-up can see your homework help.',
  tweens: 'Your parent can see your homework help sessions.',
  teens: 'Your parent can see a summary of your homework help and any safety alerts.',
} as const satisfies Record<LearnBand, string>
/** A full transcript is for under 14s and a summary for 14-17; when the server snapshot says otherwise, the snapshot wins. */
export function parentNotice(band: LearnBand, mode: ParentVisibilityMode | null | undefined): string {
  const effective = mode ?? (band === 'teens' ? 'SUMMARY' : 'FULL')
  if (effective === 'SUMMARY') return parentNotices.teens
  return band === 'teens' ? 'Your parent can see your homework help.' : parentNotices[band]
}

export const hintLabels: Record<LearnBand, readonly [string, string, string]> = {
  kids: ['A little help', 'More help', 'Look at this'],
  tweens: ['A small nudge', 'A bigger hint', 'A similar example'],
  teens: ['Nudge', 'Hint', 'Similar example'],
}
/** The label of the button that asks for the NEXT rung. */
export function hintButtonLabel(band: LearnBand, shown: number): string {
  if (shown <= 0) return 'Need a hint?'
  return hintLabels[band][Math.min(2, shown)] ?? 'Another hint'
}

export const phaseSteps = ['Problem', 'Check', 'Steps', 'Your answer'] as const
/** Which of the four journey stops a phase belongs to (0-based), or -1 when none is current. */
export function journeyIndex(phase: HomeworkDetail['session']['phase']): number {
  switch (phase) {
    case 'CAPTURE': return 0
    case 'RESTATE': return 1
    case 'STEPS': return 2
    case 'FINAL': case 'CHECKED': case 'DONE': return 3
    default: return -1
  }
}

/* ---------- reading a session ---------- */

export const isSafetyTurn = (turn: CoTurnView | null | undefined): turn is CoTurnView & { reply: CoReply } => !!turn && turn.status === 'READY' && isSafetyReply(turn.reply)

/** The words shown for a safety redirect: the code-owned guidance, verbatim; the reply text only when no guidance was sent. */
export function safetyText(reply: CoReply): string {
  return reply.safety.guidance && reply.safety.guidance.trim() ? reply.safety.guidance : reply.text
}

export interface HintShown { level: number; text: string }

export interface HomeworkView {
  /** A turn is queued or running: Co is thinking. */
  pending: CoTurnView | null
  /** The newest turn failed and nothing newer replaced it. A failed hint is not here: it never blocks the step. */
  failed: CoTurnView | null
  /** The newest turn was a hint that failed; the learner can simply ask again. */
  hintFailed: boolean
  /** The newest finished turn was a safety redirect. */
  safety: (CoTurnView & { reply: CoReply }) | null
  step: HomeworkStep | null
  pastSteps: HomeworkStep[]
  /** The hint texts of the current step, level 1 first. */
  hints: HintShown[]
  hintNext: { level: 1 | 2 | 3 } | { level: null; reason: string }
  verdict: FinalVerdict | null
  finalTriesUsed: number
}

const byOrdinal = (a: CoTurnView, b: CoTurnView) => a.ordinal - b.ordinal

/** Turns the server session into what the page needs. */
export function deriveView(detail: HomeworkDetail): HomeworkView {
  const { session } = detail
  const turns = [...detail.turns].sort(byOrdinal)
  const pending = detail.pending && (detail.pending.status === 'QUEUED' || detail.pending.status === 'RUNNING') ? detail.pending : null
  const latest = turns.length > 0 ? turns[turns.length - 1]! : null
  const failedLatest = !pending && latest && latest.status === 'FAILED' ? latest : null
  const hintFailed = failedLatest?.kind === 'HW_HINT'
  const failed = hintFailed ? null : failedLatest
  const latestReady = [...turns].reverse().find(turn => turn.status === 'READY') ?? null
  const safety = !pending && !failed && isSafetyTurn(latestReady) && latest?.id === latestReady.id ? latestReady : null

  const step = detail.steps.find(candidate => candidate.learnerResponse === null && candidate.number === session.stepNumber)
    ?? [...detail.steps].reverse().find(candidate => candidate.learnerResponse === null)
    ?? null
  const pastSteps = detail.steps.filter(candidate => candidate.learnerResponse !== null && (step === null || candidate.number < step.number))

  // The rungs already served come from the session state (`hints`), so a refresh shows them; only those of the current step count.
  const hints: HintShown[] = detail.hints
    .filter(hint => hint.stepNumber === session.stepNumber)
    .sort((x, y) => x.level - y.level)
    .map(hint => ({ level: hint.level, text: hint.text }))
  const cap = Math.min(3, session.hintsMax)
  const hintNext: HomeworkView['hintNext'] = cap <= 0
    ? { level: null, reason: 'Hints are switched off for your homework help.' }
    : session.hintLevel >= cap
      ? { level: null, reason: session.hintLevel >= 3 ? 'You have seen all three hints for this step.' : 'You have used all the hints your school allows for this step.' }
      : { level: (session.hintLevel + 1) as 1 | 2 | 3 }

  return {
    pending, failed, hintFailed, safety, step, pastSteps, hints, hintNext,
    verdict: detail.final?.verdict ?? null,
    finalTriesUsed: session.finalAttempts,
  }
}

/** The text of a finished Co turn of a given kind, newest first (used for the restatement when the field is empty). */
export const replyText = (turn: CoTurnView | null | undefined): string | null => turn?.reply && !isSafetyReply(turn.reply) ? turn.reply.text : null

/** Characters left under a limit; the count is spoken only when the limit is close. */
export function charsLeft(value: string, limit: number): { used: number; left: number; close: boolean } {
  const used = value.length
  const left = limit - used
  return { used, left, close: left <= Math.max(20, Math.floor(limit * 0.1)) }
}

/** A readable date for the list of earlier sessions. */
export function sessionDate(iso: string | null | undefined): string | null {
  if (!iso || Number.isNaN(Date.parse(iso))) return null
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
