import type { LearnBand } from '@/lib/api/learn'
import type { PracticeMode, SessionRow, Stars } from '@/lib/api/practice'

/** How the three modes are named to the learner. The words, not only colour or an icon, tell them apart. */
export const modeInfo: Record<PracticeMode, { label: string; kidsLabel: string; rule: string; kidsRule: string }> = {
  PRACTICE: { label: 'Practice', kidsLabel: 'Play', rule: 'Hints and extra tries are allowed.', kidsRule: 'Hints and extra tries are fine!' },
  REVIEW: { label: 'Review', kidsLabel: 'Remember', rule: 'Quick reminders of things you learned. Hints and extra tries are allowed.', kidsRule: 'Remember what you learned!' },
  EXAM: { label: 'Mock test', kidsLabel: 'Big test', rule: 'Timed. One try for each question, no hints, and answers only at the end.', kidsRule: 'Timed. One try each and no hints.' },
}
export const modeLabel = (mode: PracticeMode, band: LearnBand) => band === 'kids' ? modeInfo[mode].kidsLabel : modeInfo[mode].label
export const modeRule = (mode: PracticeMode, band: LearnBand) => band === 'kids' ? modeInfo[mode].kidsRule : modeInfo[mode].rule

/** "4 min", "45 sec". Null when the server has no duration. */
export function durationLabel(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return null
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} sec`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return rest === 0 || minutes >= 10 ? `${minutes} min` : `${minutes} min ${rest} sec`
}

export const starsLabel = (stars: Stars | number | null | undefined) => stars === null || stars === undefined ? 'Not played yet' : `${stars} of 3 stars`

/** "7 of 8". Null while nothing was scored (a running session, or one with no scored answers). */
export function scoreText(row: Pick<SessionRow, 'correct' | 'itemCount'>): string | null {
  return row.correct === null ? null : `${row.correct} of ${row.itemCount}`
}

export function statusText(row: Pick<SessionRow, 'status'>, band: LearnBand): string | null {
  switch (row.status) {
    case 'IN_PROGRESS': return band === 'kids' ? 'Keep playing' : 'In progress'
    case 'ABANDONED': return band === 'kids' ? 'Stopped early' : 'Stopped'
    case 'EXPIRED': return band === 'kids' ? 'Time ran out' : 'Time ran out'
    default: return null
  }
}

/** A learner-facing estimate for the review card: "about 4 minutes" or null when the server has none. */
export function reviewEstimate(count: number, minutes: number | null): string {
  const things = count === 1 ? '1 card' : `${count} cards`
  return minutes === null ? things : `${things}, about ${minutes <= 1 ? '1 minute' : `${minutes} minutes`}`
}

/** Distinct subjects across the sets, in first-seen order. */
export function setSubjects(sets: readonly { subject: { id: string; name: string } | null }[]): { id: string; name: string }[] {
  const seen = new Map<string, { id: string; name: string }>()
  for (const item of sets) if (item.subject && !seen.has(item.subject.id)) seen.set(item.subject.id, item.subject)
  return [...seen.values()]
}
