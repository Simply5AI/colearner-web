import { z } from 'zod'
import { kidsMetricIssue } from './kids-metrics'
import { linkSchema, type ApiBand, type Link } from './learn'
import { LearnApiError, learnErrorMessage, learnRequest } from './learn-request'

/*
 * B11 learner progress contract (platform <-> web), 21 October 2026.
 * Kids payloads omit readiness, rate, attempt counts and weak-spot lists: the schema rejects those fields.
 * Readiness is rendered only for 14-17 with ENOUGH evidence; only that band can export.
 * Focus-next is a separate object and is never folded into mastery.
 * The adult dashboard mastery client stays in `progress.ts` and is not this module.
 */

export type ProgressBand = ApiBand
export type MasteryState = 'NOT_STARTED' | 'LEARNING' | 'PRACTICING' | 'SECURE' | 'MASTERED'
export const masteryStates = ['NOT_STARTED', 'LEARNING', 'PRACTICING', 'SECURE', 'MASTERED'] as const satisfies readonly MasteryState[]
export type EvidenceState = 'NONE' | 'INSUFFICIENT' | 'ENOUGH'
export const evidenceStates = ['NONE', 'INSUFFICIENT', 'ENOUGH'] as const satisfies readonly EvidenceState[]

export interface ProgressConcept {
  conceptRef: string
  label: string
  mastery: MasteryState
  evidence: EvidenceState
  practice: Link | null
  rate?: number
  attempts?: number
}
export interface ProgressSubject {
  subjectId: string
  name: string
  mastery: MasteryState
  evidence: EvidenceState
  /** Present for tweens and teens. Omitted for kids, and rejected if a kids payload includes it. */
  readiness?: number | null
  concepts: ProgressConcept[]
  weakSpots?: { label: string; rate: number }[]
}
export interface ProgressWeekDay { date: string; completedSessions: number }
export interface FocusSuggestion { candidateRef: string; label: string; reason: string }
export type FocusNext =
  | { kind: 'AI'; suggestions: FocusSuggestion[] }
  | { kind: 'UNAVAILABLE'; reason: string }
  | { kind: 'NONE' }
export interface ProgressExport { available: boolean; reason: string | null }
export interface LearnProgress {
  band: ProgressBand
  subjects: ProgressSubject[]
  week: ProgressWeekDay[]
  focusNext: FocusNext
  export: ProgressExport
}

const id = z.string().min(1).max(256)
const lines = (max: number) => z.string().max(max)
const mastery = z.enum(masteryStates)
const evidence = z.enum(evidenceStates)

const conceptSchema = z.strictObject({
  conceptRef: id,
  label: lines(160),
  mastery,
  evidence,
  practice: linkSchema.nullable().optional().transform(value => value ?? null),
}) satisfies z.ZodType<ProgressConcept>

const subjectShared = {
  subjectId: id,
  name: lines(160),
  mastery,
  evidence,
  concepts: z.array(conceptSchema).max(80),
}
const kidsSubjectSchema = z.strictObject(subjectShared)
const teenConceptSchema = conceptSchema.extend({ rate: z.number().min(0).max(1).optional(), attempts: z.number().int().nonnegative().optional() })
const olderSubjectSchema = z.strictObject({
  ...subjectShared,
  readiness: z.number().int().min(0).max(100).nullable().optional(),
  concepts: z.array(teenConceptSchema).max(80),
  weakSpots: z.array(z.strictObject({ label: lines(160), rate: z.number().min(0).max(1) })).max(6).optional(),
})

const weekSchema = z.strictObject({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  completedSessions: z.number().int().nonnegative().max(100),
}) satisfies z.ZodType<ProgressWeekDay>

const suggestionSchema = z.strictObject({
  candidateRef: id,
  label: lines(160),
  reason: lines(400),
}) satisfies z.ZodType<FocusSuggestion>

const focusSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('AI'), suggestions: z.array(suggestionSchema).max(3) }),
  z.strictObject({ kind: z.literal('UNAVAILABLE'), reason: lines(400) }),
  z.strictObject({ kind: z.literal('NONE') }),
]) satisfies z.ZodType<FocusNext>

const exportSchema = z.strictObject({
  available: z.boolean(),
  reason: lines(400).nullable(),
}) satisfies z.ZodType<ProgressExport>

const kidsProgressSchema = z.strictObject({
  band: z.literal('6-9'),
  subjects: z.array(kidsSubjectSchema).max(12),
  week: z.array(weekSchema).max(7),
  focusNext: focusSchema,
  export: exportSchema,
}).superRefine((value, context) => {
  const issue = kidsMetricIssue(value)
  if (issue) context.addIssue({ code: 'custom', message: issue })
  if (value.export.available) context.addIssue({ code: 'custom', message: 'Kids cannot export a progress sheet.', path: ['export', 'available'] })
})

const olderProgressSchema = z.strictObject({
  band: z.enum(['10-13', '14-17']),
  subjects: z.array(olderSubjectSchema).max(12),
  week: z.array(weekSchema).max(7),
  focusNext: focusSchema,
  export: exportSchema,
}).superRefine((value, context) => {
  if (value.band === '10-13' && value.export.available) context.addIssue({ code: 'custom', message: 'Only teens may export progress.' })
  for (const subject of value.subjects) {
    if (typeof subject.readiness === 'number' && subject.evidence !== 'ENOUGH') context.addIssue({ code: 'custom', message: 'Readiness needs enough scored evidence.' })
  }
})

export const progressSchema = z.union([kidsProgressSchema, olderProgressSchema]) satisfies z.ZodType<LearnProgress>

export const PROGRESS_CSV_HEADER = 'subject,concept,mastery,evidence,attempts,successRate'

/** True when the body is the documented progress sheet and nothing else is prefixed. */
export function isProgressCsv(body: string): boolean {
  const header = body.split(/\r?\n/, 1)[0]?.replace(/^\uFEFF/, '').trim()
  return header === PROGRESS_CSV_HEADER
}

export const progressApi = {
  get: () => learnRequest('/progress', progressSchema),
  /** Raw CSV. The JSON envelope is not used: the platform returns the sheet itself. */
  exportCsv: async (): Promise<Blob> => {
    let response: Response
    try {
      response = await fetch('/api/learn/progress/export.csv', { method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(30000) })
    } catch {
      throw new LearnApiError(503, 'Learning services are unavailable right now. Please try again.')
    }
    if (!response.ok) {
      const failure: unknown = await response.json().catch(() => null)
      const code = failure && typeof failure === 'object' && typeof (failure as { code?: unknown }).code === 'string' ? (failure as { code: string }).code : undefined
      throw new LearnApiError(response.status, learnErrorMessage(response.status, code, failure), code)
    }
    const text = await response.text()
    if (!isProgressCsv(text)) throw new LearnApiError(502, 'Learning services returned something unexpected. Please refresh or try again later.')
    return new Blob([text], { type: 'text/csv' })
  },
}

export const progressRoutes = { home: '/learn/progress', library: '/learn/library' }
