import { z } from 'zod'
import { bandFromApi, linkSchema, type Actionable, type ApiBand, type Link, type LearnBand } from './learn'
import { learnRequest } from './learn-request'

/*
 * B08 lesson contract (platform <-> web), 19 October 2026 (agent-contracts B08, "Lesson domain API").
 * The platform lesson module was built in parallel, so these local interfaces mirror the contract and every
 * Zod schema below must `satisfies` them until @colearner/api-client ships `lesson.ts`.
 * A null field means "hide the widget": the UI never invents a value.
 */
export type LessonStatus = 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED' | 'CANCELLED'
export type LessonStepKind = 'INTRO' | 'EXPLAIN' | 'CHECK' | 'EXAMPLE' | 'RECAP'
export const lessonStepKinds = ['INTRO', 'EXPLAIN', 'CHECK', 'EXAMPLE', 'RECAP'] as const satisfies readonly LessonStepKind[]

export interface LessonSummary {
  id: string; materialId: string; title: string | null; status: LessonStatus; version: number
  band: ApiBand; createdAt: string; readyAt: string | null
  failure: { code: string; retryable: boolean } | null
}
export type LessonBlock =
  | { type: 'TEXT'; text: string }
  | { type: 'LIST'; items: string[] }
  | { type: 'TABLE'; headers: string[]; rows: string[][] }
  | { type: 'KEY_TERMS'; terms: { term: string; definition: string }[] }
/** A citation as the learner sees it: a label derived from the anchor, never a raw reference to guess at. */
export interface LessonSource { label: string; anchorRef: string; quote: string }
/** The learner payload: NEVER correctOptionId or per-option feedback. The check endpoint reveals correctness. */
export interface LessonCheckView { question: string; options: { id: string; text: string }[]; hint: string | null }
export interface LessonStepView {
  kind: LessonStepKind; title: string; coLine: string; blocks: LessonBlock[]
  index: number; sources: LessonSource[]; check: LessonCheckView | null
}
export interface LessonContentView {
  title: string; objectives: string[]; steps: LessonStepView[]
  keyTerms: { term: string; definition: string }[]; unknowns: string[]
}
export interface LessonProgress { currentStep: number; completedSteps: number[]; completedAt: string | null; revision: number }
export interface LessonNote { id: string; stepIndex: number; text: string; createdAt: string }
export interface LessonDetail {
  lesson: LessonSummary
  /** Only when READY and access is still current. */
  content: LessonContentView | null
  progress: LessonProgress
  notes: LessonNote[]
  readAloud: { mode: 'DEVICE'; note: string }
  /** B10 owns Ask Co. B08 only shows the truthful state. */
  askCo: { status: 'UNAVAILABLE' | 'AVAILABLE'; reason?: string }
  completion: { practice: Actionable; home: Link }
  source: { materialLink: Link }
  generatedBy: { kind: 'AI'; packVersion: string; promptRelease: string }
}
export interface LessonCheckResult { correct: boolean; feedback: string; correctOptionId: string | null; attempt: number }
export interface CreateLessonBody { materialId: string; planItemId?: string }
export interface ProgressBody { currentStep: number; completedStep?: number; revision: number }
export interface NoteBody { stepIndex: number; text?: string; termIndex?: number }

const id = z.string().min(1).max(256)
const short = z.string().max(1000)
const long = z.string().max(6000)
const iso = z.string().min(1)
const count = z.number().int().nonnegative()
const step = z.number().int().min(0).max(4)
const apiBand = z.enum(['6-9', '10-13', '14-17'])
/** B09: shared with learn.ts so a PRACTICE link keeps its `scope`. */
const link: z.ZodType<Link> = linkSchema
const actionable = z.object({ link: link.nullable(), enabled: z.boolean(), disabledReason: short.nullable() }) satisfies z.ZodType<Actionable>

/** Key names that would turn a learner payload into an answer key. Matched case-insensitively at any depth. */
const answerKeyNames = new Set(['correctoptionid', 'answerkey', 'correctanswer', 'iscorrect', 'correctoption'])
export function leaksAnswerKey(value: unknown, depth = 0): boolean {
  if (depth > 12 || value === null || typeof value !== 'object') return false
  if (Array.isArray(value)) return value.some(item => leaksAnswerKey(item, depth + 1))
  return Object.entries(value).some(([key, item]) => answerKeyNames.has(key.toLowerCase()) || leaksAnswerKey(item, depth + 1))
}
const hasOptionFeedback = (value: unknown) => {
  if (value === null || typeof value !== 'object' || !('options' in value) || !Array.isArray(value.options)) return false
  return value.options.some(option => option !== null && typeof option === 'object' && 'feedback' in option)
}
/** Defence in depth: a payload that carries the answer is refused whole, so the answer is never held in memory. */
const checkView = z.preprocess((value, context) => {
  if (leaksAnswerKey(value) || hasOptionFeedback(value)) { context.addIssue({ code: 'custom', message: 'The learner payload must not contain the answer key.' }); return z.NEVER }
  return value
}, z.object({
  question: long,
  options: z.array(z.object({ id, text: short })).min(2).max(4),
  hint: short.nullable(),
})) satisfies z.ZodType<LessonCheckView, unknown>

const block = z.discriminatedUnion('type', [
  z.object({ type: z.literal('TEXT'), text: long }),
  z.object({ type: z.literal('LIST'), items: z.array(short).min(1).max(8) }),
  z.object({ type: z.literal('TABLE'), headers: z.array(short).min(1).max(6), rows: z.array(z.array(short).max(6)).max(8) }),
  z.object({ type: z.literal('KEY_TERMS'), terms: z.array(z.object({ term: short, definition: long })).min(1).max(6) }),
]) satisfies z.ZodType<LessonBlock>
const source = z.object({ label: short, anchorRef: id, quote: z.string().max(2000) }) satisfies z.ZodType<LessonSource>
const stepView = z.object({
  kind: z.enum(lessonStepKinds), title: short, coLine: short,
  blocks: z.array(block).min(1).max(8), index: step,
  sources: z.array(source).max(6), check: checkView.nullable(),
}).superRefine((value, context) => {
  if ((value.kind === 'CHECK') !== (value.check !== null)) context.addIssue({ code: 'custom', message: 'A check question belongs to the CHECK step only.', path: ['check'] })
}) satisfies z.ZodType<LessonStepView, unknown>
const contentView = z.object({
  title: short, objectives: z.array(short).max(4),
  steps: z.array(stepView).length(5), keyTerms: z.array(z.object({ term: short, definition: long })).max(8),
  unknowns: z.array(short).max(5),
}).superRefine((value, context) => {
  value.steps.forEach((item, index) => {
    if (item.kind !== lessonStepKinds[index] || item.index !== index) context.addIssue({ code: 'custom', message: 'The five lesson steps must arrive in order.', path: ['steps', index] })
  })
}) satisfies z.ZodType<LessonContentView, unknown>

const summary = z.object({
  id, materialId: id, title: short.nullable(), status: z.enum(['QUEUED', 'RUNNING', 'READY', 'FAILED', 'CANCELLED']),
  version: count, band: apiBand, createdAt: iso, readyAt: iso.nullable(),
  failure: z.object({ code: z.string().min(1).max(64), retryable: z.boolean() }).nullable(),
}) satisfies z.ZodType<LessonSummary>
export const lessonSummarySchema = summary
export const progressSchema = z.object({
  currentStep: step, completedSteps: z.array(step).max(5), completedAt: iso.nullable(), revision: count,
}) satisfies z.ZodType<LessonProgress>
const note = z.object({ id, stepIndex: step, text: z.string().max(2000), createdAt: iso }) satisfies z.ZodType<LessonNote>

const detailBase = z.object({
  lesson: summary,
  content: contentView.nullable(),
  progress: progressSchema,
  notes: z.array(note).max(200),
  readAloud: z.object({ mode: z.literal('DEVICE'), note: short }),
  askCo: z.object({ status: z.enum(['UNAVAILABLE', 'AVAILABLE']), reason: short.optional() }),
  completion: z.object({ practice: actionable, home: link }),
  source: z.object({ materialLink: link }),
  generatedBy: z.object({ kind: z.literal('AI'), packVersion: z.string().max(64), promptRelease: z.string().max(128) }),
})
export const lessonDetailSchema = z.preprocess((value, context) => {
  if (leaksAnswerKey(value)) { context.addIssue({ code: 'custom', message: 'The learner payload must not contain the answer key.' }); return z.NEVER }
  return value
}, detailBase) satisfies z.ZodType<LessonDetail, unknown>
export const createLessonResponseSchema = z.object({ lesson: summary })
export const checkResultSchema = z.object({
  correct: z.boolean(), feedback: long, correctOptionId: id.nullable(), attempt: count,
}).superRefine((value, context) => {
  // The server reveals the answer only after a correct pick; anything else would be a leak.
  if (!value.correct && value.correctOptionId !== null) context.addIssue({ code: 'custom', message: 'A wrong answer must not reveal the correct option.', path: ['correctOptionId'] })
}) satisfies z.ZodType<LessonCheckResult>
/** The progress write answers with the new progress, or a body that contains it (the detail). */
export const progressResponseSchema = z.union([progressSchema, z.object({ progress: progressSchema })]).transform(value => 'progress' in value ? value.progress : value)

const resourceId = /^[a-zA-Z0-9_-]{1,128}$/
export const isLessonId = (value: string | null | undefined): value is string => !!value && resourceId.test(value)
/** The platform validates `planItemId` as a uuid (strict body), so any other value is never sent. */
export const isPlanItemId = (value: string | null | undefined): value is string => !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const path = (lessonId: string) => `/lessons/${encodeURIComponent(lessonId)}`

export const lessonApi = {
  /** Idempotent get-or-create: repeating the same request returns the same lesson. */
  create: (body: CreateLessonBody) => learnRequest('/lessons', createLessonResponseSchema, 'POST', body),
  detail: (lessonId: string) => learnRequest(path(lessonId), lessonDetailSchema),
  progress: (lessonId: string, body: ProgressBody) => learnRequest(`${path(lessonId)}/progress`, progressResponseSchema, 'PUT', body),
  check: (lessonId: string, body: { stepIndex: number; optionId: string }) => learnRequest(`${path(lessonId)}/check`, checkResultSchema, 'POST', body),
  complete: (lessonId: string) => learnRequest(`${path(lessonId)}/complete`, z.unknown(), 'POST', {}),
  /** A retry of a failed, retryable lesson creates the NEXT VERSION and answers with it (its id may differ). */
  retry: (lessonId: string) => learnRequest(`${path(lessonId)}/retry`, createLessonResponseSchema, 'POST', {}),
  cancel: (lessonId: string) => learnRequest(`${path(lessonId)}/cancel`, z.unknown(), 'POST', {}),
  addNote: (lessonId: string, body: NoteBody) => learnRequest(`${path(lessonId)}/notes`, z.unknown(), 'POST', body),
  deleteNote: (lessonId: string, noteId: string) => learnRequest(`${path(lessonId)}/notes/${encodeURIComponent(noteId)}`, z.unknown(), 'DELETE'),
}

/* ---------- presentation helpers (pure) ---------- */

export const lessonBand = (band: ApiBand): LearnBand => bandFromApi(band)
/** Revision notes are for ages 10-17; 6-9 gets NOTES_NOT_AVAILABLE from the server, so the UI never offers them. */
export const notesAllowed = (band: ApiBand) => band !== '6-9'

/** Backoff for polling a queued or running lesson: 2s, 3s, 4.5s ... capped at 15s. */
export function pollDelay(attempt: number, baseMs = 2000): number {
  return Math.min(15000, Math.round(baseMs * 1.5 ** Math.max(0, attempt)))
}

const codeMessages: Record<string, string> = {
  MATERIAL_NOT_READY: 'This material is still being read. Come back when its key ideas are ready.',
  CHILD_PROFILE_REQUIRED: 'Your school profile is not linked yet. Ask your school to finish setting it up, then come back.',
  CONSENT_REQUIRED: 'A grown-up needs to say yes before you can learn here. Ask them to check your settings.',
  LESSONS_UNAVAILABLE: 'Lessons are not switched on for you yet.',
  DAILY_LESSON_LIMIT: 'You have made all the lessons you can for today. Try again tomorrow.',
  LESSON_LIMIT_REACHED: 'You have made all the lessons you can for today. Try again tomorrow.',
  CHECK_LIMIT: 'That is a lot of tries. Take a short break, then try again.',
  NOTE_LIMIT_REACHED: 'You have saved as many notes as fit in this lesson. Delete one to add another.',
  LESSON_NOT_READY: 'This lesson is not ready yet.',
  LESSON_INCOMPLETE: 'Finish all five steps first.',
  STEP_ORDER: 'Do the steps in order. Go back and finish the earlier step first.',
  CHECK_REQUIRED: 'Answer the question correctly first.',
  NOT_RETRYABLE: 'This lesson cannot be tried again.',
  NOT_CANCELLABLE: 'This lesson can no longer be stopped.',
  AGE_OUT_OF_SCOPE: 'Lessons are not available for this age yet.',
  LESSON_ACCESS_CHANGED: 'This lesson is hidden because access to its material changed.',
  NOTES_NOT_AVAILABLE: 'Notes are not available for this age.',
  PROGRESS_CONFLICT: 'Your place was updated somewhere else. We are loading it again.',
  POLICY_BLOCKED: 'Your school or family settings do not allow this right now.',
}
/** A learner-safe message for a typed lesson failure; the server's reason is shown only where the contract calls it safe. */
export function lessonErrorMessage(error: unknown, fallback = 'Lessons are unavailable right now. Please try again.'): string {
  const code = (error as { code?: unknown } | null)?.code
  const message = error instanceof Error ? error.message : fallback
  if (typeof code === 'string' && code in codeMessages && code !== 'POLICY_BLOCKED') return codeMessages[code]!
  return message || fallback
}
export const lessonErrorCode = (error: unknown): string | undefined => {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : undefined
}

const failureText: Record<string, string> = {
  insufficient_source: 'There is not enough in this material to make a good lesson. Try adding more.',
  INSUFFICIENT_SOURCE: 'There is not enough in this material to make a good lesson. Try adding more.',
  unsafe_content: 'Co could not make a lesson from this material.',
  UNSAFE_CONTENT: 'Co could not make a lesson from this material.',
  age_band_unsupported: 'Lessons are not available for this age yet.',
  AGE_BAND_UNSUPPORTED: 'Lessons are not available for this age yet.',
  LESSON_ACCESS_CHANGED: codeMessages.LESSON_ACCESS_CHANGED!,
  authorization_changed: 'Access to this material changed, so the lesson could not be finished.',
  cancelled: 'This lesson was stopped.',
}
/** Reason text for a FAILED lesson. Unknown codes get a generic line; raw codes are never shown. */
export const lessonFailureText = (failure: { code: string } | null): string => (failure && failureText[failure.code]) ?? 'Co could not finish this lesson. You can try again.'
/** True for a failed write because consent, policy or the source changed while the lesson was open. */
export const isAccessChangedError = (error: unknown) => lessonErrorCode(error) === 'LESSON_ACCESS_CHANGED'
export const isAccessChanged = (detail: LessonDetail) =>
  detail.lesson.failure?.code === 'LESSON_ACCESS_CHANGED' || (detail.lesson.status === 'READY' && detail.content === null)
