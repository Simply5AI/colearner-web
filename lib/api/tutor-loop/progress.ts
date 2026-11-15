import { z } from 'zod'
import { tutorLoopGet, type TutorRequestOptions } from '@/lib/api/tutor-loop/client'
import {
  tutorReadinessSummarySchema,
  tutorTopicStates,
  tutorWeakConceptSchema,
  type TutorReadinessSummary,
  type TutorTopicState,
  type TutorWeakConcept,
} from '@/lib/api/tutor-loop/today'
import { downloadTutorFile } from '@/lib/api/tutor-loop/schedule'

export interface TutorProgressDay {
  date: string
  minutes: number
  completedActivities: number
}

export interface TutorProgressTrendPoint {
  date: string
  blueprintRevision: string
  percent: number | null
  topicsCovered: number
  topicsTotal: number
}

export interface TutorProgressTopic {
  id: string
  title: string
  state: TutorTopicState
  subjectTitle: string | null
  archived: boolean
}

export interface TutorProgressResponse {
  week: TutorProgressDay[]
  weeklyTargetMinutes: number
  streakDays: number
  readiness: TutorReadinessSummary | null
  trend: TutorProgressTrendPoint[]
  topics: TutorProgressTopic[]
  weakConcepts: TutorWeakConcept[]
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const tutorProgressResponseSchema: z.ZodType<TutorProgressResponse> = z.object({
  week: z
    .array(
      z.object({
        date: isoDate,
        minutes: z.number().int().min(0),
        completedActivities: z.number().int().min(0).default(0),
      }),
    )
    .default([]),
  weeklyTargetMinutes: z.number().int().min(0).default(0),
  streakDays: z.number().int().min(0).default(0),
  readiness: tutorReadinessSummarySchema.nullable().default(null),
  trend: z
    .array(
      z.object({
        date: isoDate,
        blueprintRevision: z.string(),
        percent: z.number().int().min(0).max(100).nullable(),
        topicsCovered: z.number().int().min(0),
        topicsTotal: z.number().int().min(0),
      }),
    )
    .default([]),
  topics: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string(),
        state: z.enum(tutorTopicStates),
        subjectTitle: z.string().nullable().default(null),
        archived: z.boolean().default(false),
      }),
    )
    .default([]),
  weakConcepts: z.array(tutorWeakConceptSchema).max(6).default([]),
})

type Options = Omit<TutorRequestOptions, 'method' | 'body' | 'query'>

export function getTutorProgress(
  params: { goalId?: string | null; examId?: string | null } = {},
  options?: Options,
): Promise<TutorProgressResponse> {
  return tutorLoopGet(
    '/progress',
    tutorProgressResponseSchema,
    { goalId: params.goalId ?? undefined, examId: params.examId ?? undefined },
    options,
  )
}

export function downloadProgressCsv(params: { goalId?: string | null; examId?: string | null } = {}) {
  return downloadTutorFile('/progress/export.csv', { goalId: params.goalId, examId: params.examId }, 'progress.csv')
}

/** The PDF summary is for verified adults; the API refuses it for everyone else. */
export function downloadProgressPdf(params: { goalId?: string | null; examId?: string | null } = {}) {
  return downloadTutorFile('/progress/export.pdf', { goalId: params.goalId, examId: params.examId }, 'progress.pdf')
}

/* ---------- Pure helpers ---------- */

export const TOPIC_STATE_ORDER: readonly TutorTopicState[] = [
  'NOT_STARTED',
  'LEARNING',
  'PRACTICING',
  'SECURE',
  'MASTERED',
]

export const TOPIC_STATE_LABEL: Record<TutorTopicState, string> = {
  NOT_STARTED: 'Not started',
  LEARNING: 'Learning',
  PRACTICING: 'Practising',
  SECURE: 'Secure',
  MASTERED: 'Mastered',
}

export function countTopicsByState(topics: readonly TutorProgressTopic[]): Record<TutorTopicState, number> {
  const counts = Object.fromEntries(TOPIC_STATE_ORDER.map((s) => [s, 0])) as Record<TutorTopicState, number>
  for (const topic of topics) if (!topic.archived) counts[topic.state] += 1
  return counts
}

/** Seven ISO-week days (Monday to Sunday) with minutes from the API; missing days are `null` (not yet planned or recorded). */
export function buildWeekBars(
  weekDates: readonly string[],
  days: readonly TutorProgressDay[],
  today: string,
): { date: string; minutes: number | null; future: boolean }[] {
  const byDate = new Map(days.map((d) => [d.date, d.minutes]))
  return weekDates.map((date) => ({
    date,
    future: date > today,
    minutes: date > today ? null : (byDate.get(date) ?? 0),
  }))
}

/** Splits the readiness trend where the exam blueprint changed, so points are never joined across a discontinuity. */
export function splitTrendByBlueprint(trend: readonly TutorProgressTrendPoint[]): TutorProgressTrendPoint[][] {
  const runs: TutorProgressTrendPoint[][] = []
  for (const point of trend) {
    const run = runs[runs.length - 1]
    if (run && run[0]!.blueprintRevision === point.blueprintRevision) run.push(point)
    else runs.push([point])
  }
  return runs
}

export const tutorProgressApi = {
  getProgress: getTutorProgress,
  downloadCsv: downloadProgressCsv,
  downloadPdf: downloadProgressPdf,
}
