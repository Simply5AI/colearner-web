import { z } from 'zod'
import {
  getTutorWorkspaceScope,
  tutorLoopGet,
  tutorLoopPost,
  type TutorRequestOptions,
} from '@/lib/api/tutor-loop/client'
import { tutorScheduleItemSchema, type TutorScheduleItem } from '@/lib/api/tutor-loop/today'

/* ---------- Types ---------- */

export const tutorPaceStates = ['ON_TRACK', 'BEHIND', 'UNAVAILABLE'] as const
export type TutorPaceState = (typeof tutorPaceStates)[number]

export interface TutorSchedulePace {
  state: TutorPaceState
  requiredMinutes: number
  availableMinutes: number
  shortfallMinutes: number
}

export interface TutorDayOffSpan {
  id?: string
  startDate: string
  endDate: string
}

export interface TutorScheduleWarning {
  date: string
  reasonCode: string
  minutes: number
}

export interface TutorScheduleResponse {
  from: string
  to: string
  timeZone: string
  revision: number
  items: TutorScheduleItem[]
  daysOff: TutorDayOffSpan[]
  pace: TutorSchedulePace
  unplacedMinutes: number
  warnings: TutorScheduleWarning[]
}

export interface TutorScheduleChange {
  itemId: string
  from: string | null
  to: string | null
  reasonCode: string
}

export interface TutorScheduleConflict {
  itemId: string
  reasonCode: string
}

export interface TutorSchedulePreviewResponse {
  id: string
  baseRevision: number
  expiresAt: string
  canApply: boolean
  changes: TutorScheduleChange[]
  conflicts: TutorScheduleConflict[]
  unplacedMinutes: number
}

export interface TutorScheduleAppliedResponse {
  previewId: string
  revision: number
  appliedAt: string
}

/* ---------- Schemas ---------- */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const tutorSchedulePaceSchema: z.ZodType<TutorSchedulePace> = z.object({
  state: z.enum(tutorPaceStates),
  requiredMinutes: z.number().int().min(0).default(0),
  availableMinutes: z.number().int().min(0).default(0),
  shortfallMinutes: z.number().int().min(0).default(0),
})

export const tutorDayOffSpanSchema: z.ZodType<TutorDayOffSpan> = z.object({
  id: z.string().optional(),
  startDate: isoDate,
  endDate: isoDate,
})

export const tutorScheduleResponseSchema: z.ZodType<TutorScheduleResponse> = z.object({
  from: isoDate,
  to: isoDate,
  timeZone: z.string().min(1),
  revision: z.number().int().min(0),
  items: z.array(tutorScheduleItemSchema).default([]),
  daysOff: z.array(tutorDayOffSpanSchema).default([]),
  pace: tutorSchedulePaceSchema,
  unplacedMinutes: z.number().int().min(0).default(0),
  warnings: z
    .array(z.object({ date: isoDate, reasonCode: z.string(), minutes: z.number().int().min(0) }))
    .default([]),
})

export const tutorSchedulePreviewResponseSchema: z.ZodType<TutorSchedulePreviewResponse> = z.object({
  id: z.string().min(1),
  baseRevision: z.number().int().min(0),
  expiresAt: z.string(),
  canApply: z.boolean(),
  changes: z
    .array(
      z.object({
        itemId: z.string(),
        from: z.string().nullable(),
        to: z.string().nullable(),
        reasonCode: z.string(),
      }),
    )
    .default([]),
  conflicts: z.array(z.object({ itemId: z.string(), reasonCode: z.string() })).default([]),
  unplacedMinutes: z.number().int().min(0).default(0),
})

export const tutorScheduleAppliedSchema: z.ZodType<TutorScheduleAppliedResponse> = z.object({
  previewId: z.string().min(1),
  revision: z.number().int().min(0),
  appliedAt: z.string(),
})

type Options = Omit<TutorRequestOptions, 'method' | 'body' | 'query'>

/* ---------- Client ---------- */

export function getTutorSchedule(
  params: { from: string; to: string; goalId?: string | null },
  options?: Options,
): Promise<TutorScheduleResponse> {
  return tutorLoopGet(
    '/schedule',
    tutorScheduleResponseSchema,
    { from: params.from, to: params.to, goalId: params.goalId ?? undefined },
    options,
  )
}

export function previewScheduleMove(
  body: { itemId: string; date: string; baseRevision: number },
  options?: Options,
): Promise<TutorSchedulePreviewResponse> {
  return tutorLoopPost('/schedule/move-preview', tutorSchedulePreviewResponseSchema, body, options)
}

export function previewScheduleReplan(
  body: { baseRevision: number; reason?: 'BEHIND' | 'TIME_CHANGE'; goalId?: string | null },
  options?: Options,
): Promise<TutorSchedulePreviewResponse> {
  const { goalId, ...rest } = body
  return tutorLoopPost(
    '/schedule/replan-preview',
    tutorSchedulePreviewResponseSchema,
    goalId ? { ...rest, goalId } : rest,
    options,
  )
}

export function previewScheduleDayOff(
  body: { baseRevision: number; startDate: string; endDate: string; dayOff: boolean },
  options?: Options,
): Promise<TutorSchedulePreviewResponse> {
  return tutorLoopPost('/schedule/day-off-preview', tutorSchedulePreviewResponseSchema, body, options)
}

export function applyScheduleChange(
  previewId: string,
  body: { clientRequestId: string; baseRevision: number },
  options?: Options,
): Promise<TutorScheduleAppliedResponse> {
  return tutorLoopPost(
    `/schedule/previews/${encodeURIComponent(previewId)}/apply`,
    tutorScheduleAppliedSchema,
    body,
    options,
  )
}

/* ---------- Downloads (calendar, CSV, PDF) ---------- */

export interface TutorDownloadResult {
  fileName: string
}

/** Fetches an authenticated attachment through the web BFF and hands it to the browser as a file. */
export async function downloadTutorFile(
  path: string,
  query: Record<string, string | null | undefined>,
  fallbackName: string,
): Promise<TutorDownloadResult> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value)
  const qs = params.toString()
  const headers: Record<string, string> = {}
  if (getTutorWorkspaceScope() === 'personal') headers['X-Tutor-Workspace'] = 'personal'
  let response: Response
  try {
    response = await fetch(`/api/learn/tutor-loop${path}${qs ? `?${qs}` : ''}`, { headers, cache: 'no-store' })
  } catch {
    throw Object.assign(new Error('We could not download that. Check your connection and try again.'), { status: 503 })
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { code?: string } | null
    const message =
      body?.code === 'ADULT_VERIFICATION_REQUIRED'
        ? 'This download is available to verified adult accounts.'
        : 'We could not prepare that download. Try again in a moment.'
    throw Object.assign(new Error(message), { status: response.status, code: body?.code })
  }
  const disposition = response.headers.get('content-disposition') ?? ''
  const named = /filename="?([^";]+)"?/i.exec(disposition)?.[1]
  const fileName = named && /^[\w.-]{1,80}$/.test(named) ? named : fallbackName
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { fileName }
}

export function downloadScheduleCalendar(params: { from: string; to: string; goalId?: string | null }) {
  return downloadTutorFile(
    '/schedule/calendar.ics',
    { from: params.from, to: params.to, goalId: params.goalId },
    'colearner-schedule.ics',
  )
}

/* ---------- Pure helpers ---------- */

export const scheduleConflictCopy: Record<string, string> = {
  DAY_OFF: 'That day is marked as a day off.',
  NOT_STUDY_DAY: 'That is not one of your study days.',
  SCHEDULE_FULL: 'That day is already full.',
  ITEM_FIXED: 'Your teacher set this date, so it cannot move.',
  PREREQUISITE_CYCLE: 'Some topics depend on each other, so the order needs a look.',
  UNPLACED_CAPACITY: 'Some work does not fit before its deadline.',
}

export function scheduleConflictMessage(code: string): string {
  return scheduleConflictCopy[code] ?? 'This change cannot be made right now.'
}

export interface ScheduleDay {
  date: string
  items: TutorScheduleItem[]
  minutes: number
  dayOff: boolean
}

export function isDayOff(date: string, spans: readonly TutorDayOffSpan[]): boolean {
  return spans.some((span) => span.startDate <= date && date <= span.endDate)
}

/** ISO weekday 1 (Monday) to 7 (Sunday) for a calendar date, independent of the browser time zone. */
export function isoWeekday(date: string): number {
  const d = new Date(`${date}T00:00:00Z`)
  const dow = d.getUTCDay()
  return dow === 0 ? 7 : dow
}

/** Groups items by day for the days between `from` and `to`, sorted by status then kind then title. */
export function groupScheduleByDay(
  dates: readonly string[],
  items: readonly TutorScheduleItem[],
  daysOff: readonly TutorDayOffSpan[],
): ScheduleDay[] {
  return dates.map((date) => {
    const list = items
      .filter((item) => item.date === date)
      .sort((a, b) => (a.placement === 'FIXED' ? -1 : 0) - (b.placement === 'FIXED' ? -1 : 0) || (a.id < b.id ? -1 : 1))
    return {
      date,
      items: list,
      minutes: list.filter((i) => i.status !== 'SKIPPED').reduce((sum, i) => sum + i.estimatedMinutes, 0),
      dayOff: isDayOff(date, daysOff),
    }
  })
}

export const tutorScheduleApi = {
  getSchedule: getTutorSchedule,
  previewMove: previewScheduleMove,
  previewReplan: previewScheduleReplan,
  previewDayOff: previewScheduleDayOff,
  apply: applyScheduleChange,
  downloadCalendar: downloadScheduleCalendar,
}
