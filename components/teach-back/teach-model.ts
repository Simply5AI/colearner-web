import type { LearnBand } from '@/lib/api/learn'
import type { TeachReply, TeachResult, TeachTurn } from '@/lib/api/teach-back'
import { isTerminalTeachTurn } from '@/lib/api/teach-back'
import { LearnApiError, LearnSessionError } from '@/lib/api/learn-request'

/** A safety outcome is code-owned guidance, never a coverage checklist. */
export function isTeachSafety(reply: TeachReply | null | undefined): boolean {
  return !!reply && (reply.disposition === 'SAFE_REDIRECT' || reply.disposition === 'TRUSTED_ADULT' || reply.safety.redirected)
}

export function latestReady(turns: readonly TeachTurn[]): TeachTurn | null {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index]
    if (turn && turn.status === 'READY' && turn.reply) return turn
  }
  return null
}

export function followUpQuestion(turns: readonly TeachTurn[]): string | null {
  const explain = [...turns].reverse().find(turn => turn.kind === 'EXPLAIN' && turn.status === 'READY' && turn.reply && !isTeachSafety(turn.reply))
  return explain?.reply?.followUp ?? null
}

/** Picture ticks: the covered points only, check plus label, never a miss count. */
export function coveredTicks(result: TeachResult | TeachReply): { label: string }[] {
  return result.covered.map(label => ({ label }))
}

/** One gentle next point for kids. No number and no cross. */
export function kidNextPoint(missing: readonly string[]): string | null {
  const point = missing.find(item => item.trim())
  return point ? `One more: ${point}` : null
}

export const VOICE_TITLE = 'Voice isn’t available yet'
export const TAUGHT_IT_LABEL = 'Taught it!'

export function teachPendingLabel(band: LearnBand): string {
  return band === 'kids' ? 'Co is thinking' : 'Co is checking what you taught'
}

export function isUnconfirmedTeach(error: unknown): boolean {
  if (error instanceof LearnSessionError) return false
  if (error instanceof LearnApiError) return error.status >= 500 || error.status === 408
  return true
}

export function mergeTeachTurns(current: readonly TeachTurn[], incoming: readonly TeachTurn[]): TeachTurn[] {
  const byId = new Map(current.map(turn => [turn.id, turn]))
  for (const turn of incoming) {
    const previous = byId.get(turn.id)
    // A late snapshot cannot put a completed turn back into the polling queue.
    if (previous && isTerminalTeachTurn(previous) && !isTerminalTeachTurn(turn)) continue
    byId.set(turn.id, turn)
  }
  return [...byId.values()].sort((a, b) => a.ordinal - b.ordinal || a.createdAt.localeCompare(b.createdAt))
}

export const hasPendingTeach = (turns: readonly TeachTurn[]) => turns.some(turn => !isTerminalTeachTurn(turn))
