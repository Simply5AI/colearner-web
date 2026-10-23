import type { PlanStatus, TeachingPlanCard } from '@/lib/api/teaching/plans'
import { bandAudience, bandLabel } from '@/lib/api/teaching/lesson-schema'

export const statusLabel: Record<PlanStatus, string> = { DRAFT: 'Draft', PUBLISHED: 'Published', ARCHIVED: 'Archived' }
export const bandText = (band: TeachingPlanCard['scope']['targetBand']) => `${bandLabel[band]} · ${bandAudience[band]}`

/** Dates are shown in the viewer's locale and zone; a missing or unreadable value is shown as "Not set", never invented. */
export function dateText(value: string | null | undefined, withTime = false): string {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not set'
  return new Intl.DateTimeFormat(undefined, withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(date)
}
/** `YYYY-MM-DD` for a date input from an ISO instant, in the viewer's zone. */
export function toDateInput(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
/** End of the chosen day in the viewer's zone, as an ISO UTC instant. */
export function fromDateInput(value: string): string | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d, 23, 59, 0, 0)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
