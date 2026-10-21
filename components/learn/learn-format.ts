import type { LearnBand } from '@/lib/api/learn'

const dayMs = 86_400_000
const valid = (iso: string | null | undefined) => iso ? Number.isNaN(Date.parse(iso)) ? null : new Date(iso) : null

export interface DueLabel { text: string; overdue: boolean }
/** Friendly due text from a server date. Within the coming week only the weekday is spoken; kids never see raw dates. */
export function dueLabel(iso: string | null | undefined, band: LearnBand, now = new Date()): DueLabel | null {
  const date = valid(iso)
  if (!date) return null
  const days = Math.floor((date.getTime() - now.getTime()) / dayMs)
  if (date.getTime() < now.getTime()) return { text: band === 'kids' ? 'Waiting for you' : `Was due ${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`, overdue: true }
  if (days < 1) return { text: 'Due today', overdue: false }
  if (days < 7) return { text: `Due ${date.toLocaleDateString(undefined, { weekday: 'long' })}`, overdue: false }
  return { text: `Due ${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`, overdue: false }
}

export function minutesLabel(minutes: number | null | undefined): string | null {
  if (minutes === null || minutes === undefined) return null
  return minutes <= 0 ? 'less than a minute' : minutes === 1 ? '1 minute' : `${minutes} minutes`
}

export function daysLabel(days: number): string {
  return days < 0 ? 'passed' : days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`
}

export function dateLabel(iso: string | null | undefined): string | null {
  const date = valid(iso)
  return date ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null
}

const statusText: Record<string, string> = { queued: 'Waiting to read', processing: 'Reading', ready: 'Ready', failed: 'Could not finish', cancelled: 'Cancelled' }
/** Unknown material states are not guessed at. */
export const materialStatusText = (status: string): string | null => statusText[status.toLowerCase()] ?? null

const sourceText: Record<string, string> = { text: 'Pasted text', pdf: 'PDF', docx: 'Word', pptx: 'PowerPoint', image: 'Photo', audio: 'Audio', youtube: 'YouTube', web: 'Website', paper: 'Paper' }
export const sourceLabel = (type: string) => sourceText[type.toLowerCase()] ?? 'Source'
export const originLabel = { PERSONAL: 'Yours', TEACHER: 'From your teacher', CENTRAL: 'From the CoLearner library' } as const
export const itemStatusLabel = { NOT_STARTED: 'Not started', IN_PROGRESS: 'In progress', DONE: 'Done', SKIPPED: 'Skipped' } as const
