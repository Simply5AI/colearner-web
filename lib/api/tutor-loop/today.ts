import { z } from 'zod'
import { tutorLoopGet, type TutorRequestOptions } from '@/lib/api/tutor-loop/client'
import {
  dismissTutorNudge,
  formatReasonCodes,
  getTutorNudges,
  reasonCodeLabels,
  setTutorNudgeMute,
  type TutorActionTarget,
  type TutorNudgeItem,
  type TutorNudgeKind,
  type TutorNudgeListResponse,
  type TutorNudgeMuteResponse,
} from '@/lib/api/tutor-loop/co'

export {
  dismissTutorNudge,
  formatReasonCodes,
  getTutorNudges,
  reasonCodeLabels,
  setTutorNudgeMute,
  type TutorActionTarget,
  type TutorNudgeItem,
  type TutorNudgeKind,
  type TutorNudgeListResponse,
  type TutorNudgeMuteResponse,
}

export const tutorCountdownStates = ['UPCOMING', 'TODAY', 'PASSED'] as const
export type TutorCountdownState = (typeof tutorCountdownStates)[number]

export const tutorEvidenceStates = ['NONE', 'INSUFFICIENT', 'ENOUGH'] as const
export type TutorEvidenceState = (typeof tutorEvidenceStates)[number]

export const tutorTopicStates = [
  'NOT_STARTED',
  'LEARNING',
  'PRACTICING',
  'SECURE',
  'MASTERED',
] as const
export type TutorTopicState = (typeof tutorTopicStates)[number]

export const tutorScheduleItemKinds = [
  'TEACHER_DUE',
  'REVIEW',
  'LESSON',
  'PRACTICE',
  'TEACH_BACK',
  'MOCK',
] as const
export type TutorScheduleItemKind = (typeof tutorScheduleItemKinds)[number] | (string & {})

export const tutorScheduleStatuses = ['PLANNED', 'DONE', 'SKIPPED'] as const
export type TutorScheduleStatus = (typeof tutorScheduleStatuses)[number]

export const tutorSchedulePlacements = ['AUTO', 'MANUAL', 'FIXED'] as const
export type TutorSchedulePlacement = (typeof tutorSchedulePlacements)[number]

export const tutorActivityKinds = [
  'MATERIAL',
  'LESSON',
  'PRACTICE',
  'TEACH_BACK',
  'HOMEWORK',
] as const
export type TutorActivityKind = (typeof tutorActivityKinds)[number]

export interface TutorTodayGoal {
  id: string
  title: string
}

export interface TutorTodayCountdown {
  examId: string
  date: string
  daysLeft: number
  state: TutorCountdownState
}

export interface TutorReadinessSummary {
  examId: string
  blueprintRevision: string
  percent: number | null
  topicsCovered: number
  topicsTotal: number
  evidence: TutorEvidenceState
  asOf: string
}

export interface TutorBriefingAction {
  kind: string
  targetId: string | null
  label: string
  minutes: number
  reasonCodes: string[]
}

export interface TutorBriefing {
  action: TutorBriefingAction
  alternative: TutorBriefingAction | null
  wording: string | null
}

export interface TutorScheduleItem {
  id: string
  goalId: string | null
  topicId: string | null
  kind: TutorScheduleItemKind
  sourceRef: string
  originDate: string
  date: string
  estimatedMinutes: number
  status: TutorScheduleStatus
  placement: TutorSchedulePlacement
  title: string
  completedAt?: string | null
}

export interface TutorWeakConcept {
  conceptId: string
  topicId: string
  label: string
  state: TutorTopicState
  qualifyingAttempts: number
  rate: number
}

export interface TutorTodayResponse {
  date: string
  timeZone: string
  goal: TutorTodayGoal | null
  countdown: TutorTodayCountdown | null
  readiness: TutorReadinessSummary | null
  streakDays: number
  weeklyMinutes: number
  weeklyTargetMinutes: number
  briefing: TutorBriefing
  later: TutorScheduleItem[]
  /** Fixed teacher work due today; always listed, even when it does not fit the time available. */
  fixedWork: TutorScheduleItem[]
  weakConcepts: TutorWeakConcept[]
}

export interface TutorNextStepResponse {
  activityKind: string
  activityId: string
  measured: {
    itemsDone?: number
    minutesStudied?: number
    readinessDelta?: number | null
  }
  briefing: TutorBriefing
}

export interface GetTutorTodayParams {
  goalId?: string | null
  availableMinutes?: number | null
}

/* ---------- Zod Schemas ---------- */

export const tutorTodayGoalSchema: z.ZodType<TutorTodayGoal> = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
})

export const tutorTodayCountdownSchema: z.ZodType<TutorTodayCountdown> = z.object({
  examId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  daysLeft: z.number().int(),
  state: z.enum(tutorCountdownStates),
})

export const tutorReadinessSummarySchema: z.ZodType<TutorReadinessSummary> = z.object({
  examId: z.string().min(1),
  blueprintRevision: z.string().min(1),
  percent: z.number().int().min(0).max(100).nullable(),
  topicsCovered: z.number().int().min(0),
  topicsTotal: z.number().int().min(0),
  evidence: z.enum(tutorEvidenceStates),
  asOf: z.string(),
})

export const tutorBriefingActionSchema: z.ZodType<TutorBriefingAction> = z.object({
  kind: z.string().min(1),
  targetId: z.string().nullable().default(null),
  label: z.string().min(1),
  minutes: z.number().int().min(0).default(0),
  reasonCodes: z.array(z.string()).default([]),
})

export const tutorBriefingSchema: z.ZodType<TutorBriefing> = z.object({
  action: tutorBriefingActionSchema,
  alternative: tutorBriefingActionSchema.nullable().default(null),
  wording: z.string().nullable().default(null),
})

export const tutorScheduleItemSchema: z.ZodType<TutorScheduleItem> = z.object({
  id: z.string().min(1),
  goalId: z.string().nullable().default(null),
  topicId: z.string().nullable().default(null),
  kind: z.string().min(1),
  sourceRef: z.string().min(1),
  originDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  estimatedMinutes: z.number().int().min(0),
  status: z.enum(tutorScheduleStatuses),
  placement: z.enum(tutorSchedulePlacements),
  title: z.string().min(1),
  completedAt: z.string().nullable().optional(),
})

export const tutorWeakConceptSchema: z.ZodType<TutorWeakConcept> = z.object({
  conceptId: z.string().min(1),
  topicId: z.string().min(1),
  label: z.string().min(1),
  state: z.enum(tutorTopicStates),
  qualifyingAttempts: z.number().int().min(0),
  rate: z.number().min(0).max(1),
})

export const tutorTodayResponseSchema: z.ZodType<TutorTodayResponse> = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeZone: z.string().min(1),
  goal: tutorTodayGoalSchema.nullable().default(null),
  countdown: tutorTodayCountdownSchema.nullable().default(null),
  readiness: tutorReadinessSummarySchema.nullable().default(null),
  streakDays: z.number().int().min(0).default(0),
  weeklyMinutes: z.number().int().min(0).default(0),
  weeklyTargetMinutes: z.number().int().min(0).default(0),
  briefing: tutorBriefingSchema,
  later: z.array(tutorScheduleItemSchema).default([]),
  fixedWork: z.array(tutorScheduleItemSchema).default([]),
  weakConcepts: z.array(tutorWeakConceptSchema).max(6).default([]),
})

export const tutorNextStepResponseSchema: z.ZodType<TutorNextStepResponse> = z.object({
  activityKind: z.string().min(1),
  activityId: z.string().min(1),
  measured: z
    .object({
      itemsDone: z.number().int().min(0).optional(),
      minutesStudied: z.number().int().min(0).optional(),
      readinessDelta: z.number().nullable().optional(),
    })
    .default({}),
  briefing: tutorBriefingSchema,
})

/* ---------- Deterministic Formatting & Navigation Helpers ---------- */

export const DETERMINISTIC_REASON_LABELS: Record<string, string> = {
  // Closed reason codes returned by the platform (today selector).
  TEACHER_DEADLINE: 'Due from your teacher',
  OVERDUE: 'Overdue, so worth doing first',
  DUE_REVIEW: 'Due for review today',
  EXAM_SOON: 'Your exam is coming up',
  EXAM_WEEK: 'Exam week: practice comes first',
  SCHEDULED_TODAY: 'Planned for today',
  NEXT_IN_PLAN: 'Next in your plan',
  CATCH_UP: 'Helps you catch up',
  SHORT_ON_TIME: 'Fits the time you have',
  NO_MATERIAL: 'Add something to learn from',
  DONE_FOR_TODAY: 'You have done what was planned',
  // Contract-era codes, kept so older responses still read well.
  TEACHER_DUE: 'Due from your teacher',
  RECENT_MISTAKE: 'Missed in recent practice',
  EXAM_NEAR: 'Your exam is coming up',
  ON_SCHEDULE: 'Next in your plan',
  LOW_TIME: 'Fits the time you have',
}

/**
 * Returns deterministic human-readable explanation for why an action was selected,
 * ensuring Today and What-Next work 100% when AI wording is absent or resting.
 */
export function formatBriefingReason(reasonCodes: readonly string[]): string {
  for (const code of reasonCodes) {
    if (DETERMINISTIC_REASON_LABELS[code]) {
      return DETERMINISTIC_REASON_LABELS[code]!
    }
  }
  return 'Next in your plan'
}

/**
 * Formats readiness status for the Today banner and Progress header.
 * Returns `"Not enough practice yet — X of Y topics"` when evidence is insufficient.
 */
export function formatReadinessBadgeText(readiness: TutorReadinessSummary | null | undefined): string {
  if (!readiness) {
    return 'Not enough practice yet — 0 of 0 topics'
  }
  const { percent, topicsCovered, topicsTotal, evidence } = readiness
  if (evidence !== 'ENOUGH' || percent === null) {
    return `Not enough practice yet — ${topicsCovered} of ${topicsTotal} topics`
  }
  return `${percent}% ready · Measured on ${topicsCovered} of ${topicsTotal} topics`
}

/**
 * Formats minutes as a readable duration (`"10 min"`, `"2 h 10 min"`, `"3 h"`).
 */
export function formatStudyDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes))
  if (safe < 60) return `${safe} min`
  const hours = Math.floor(safe / 60)
  const rem = safe % 60
  return rem === 0 ? `${hours} h` : `${hours} h ${rem} min`
}

/**
 * Resolves a safe internal navigation href for a deterministic briefing or schedule action.
 */
export function resolveTutorActionHref(
  action: Pick<TutorBriefingAction, 'kind' | 'targetId'>,
  goalId?: string | null,
): string {
  const kind = action.kind.toUpperCase()
  const practice = (topicId?: string | null) => {
    const params = new URLSearchParams()
    if (goalId) params.set('goalId', goalId)
    if (topicId) params.set('topicId', topicId)
    const qs = params.toString()
    return `/learn/practice${qs ? `?${qs}` : ''}`
  }
  switch (kind) {
    // The platform's LESSON and PRACTICE targets are topic ids; the topic sheet in Practice starts the right activity.
    case 'LESSON':
    case 'PRACTICE':
    case 'REVIEW':
      return practice(action.targetId)
    case 'TEACH_BACK':
      return action.targetId
        ? `/learn/co?mode=TEACH_BACK&topicId=${encodeURIComponent(action.targetId)}`
        : '/learn/co?mode=TEACH_BACK'
    case 'TEACHER_DUE':
      return `/learn?tab=plan${goalId ? `&goalId=${encodeURIComponent(goalId)}` : ''}`
    case 'ADD_MATERIAL':
      return `/learn?tab=library${goalId ? `&goalId=${encodeURIComponent(goalId)}` : ''}`
    case 'DONE_FOR_TODAY':
    case 'BREAK':
      return '/learn/today'
    default:
      return practice()
  }
}

/* ---------- API Client Functions ---------- */

export const AVAILABLE_MINUTES_OPTIONS = [10, 15, 30] as const
export type AvailableMinutesOption = (typeof AVAILABLE_MINUTES_OPTIONS)[number]

export function getTutorToday(
  params: GetTutorTodayParams = {},
  options?: Omit<TutorRequestOptions, 'method' | 'query'>,
): Promise<TutorTodayResponse> {
  const availableMinutes =
    params.availableMinutes !== undefined && params.availableMinutes !== null
      ? Math.min(240, Math.max(5, Math.trunc(params.availableMinutes)))
      : undefined
  return tutorLoopGet('/today', tutorTodayResponseSchema, { goalId: params.goalId ?? undefined, availableMinutes }, options)
}

export function getTutorActivityNextStep(
  activityKind: TutorActivityKind,
  activityId: string,
): Promise<TutorNextStepResponse> {
  return tutorLoopGet(
    `/activities/${encodeURIComponent(activityKind)}/${encodeURIComponent(activityId)}/next`,
    tutorNextStepResponseSchema,
  )
}

export function getTodayScreenNudges(): Promise<TutorNudgeListResponse> {
  return getTutorNudges('TODAY')
}

export const tutorTodayApi = {
  getToday: getTutorToday,
  getNextStep: getTutorActivityNextStep,
  getNudges: getTodayScreenNudges,
  dismissNudge: dismissTutorNudge,
  setNudgeMute: setTutorNudgeMute,
}
