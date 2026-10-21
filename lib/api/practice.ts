import { z } from 'zod'
import { linkSchema, type Actionable, type ApiBand, type Link } from './learn'
import { learnRequest } from './learn-request'

/*
 * B09 practice contract (platform <-> web), 19 October 2026 (agents/contracts/B09-contracts.md).
 * The platform practice module (agents PD1/PD2) is built in parallel, so these local interfaces mirror the contract
 * and every Zod schema below `satisfies` them until @colearner/api-client ships `practice.ts`.
 * A null field means "hide the widget": the UI never invents a value. XP, level and readiness are null in B09 and are
 * shown only if a later release returns a number.
 *
 * NOT defined by the contract text (assumptions made by W2, to be conformed with PD2 at integration; see
 * docs/b09-practice-web.md): `SessionRow`, `PracticeSessionState`, `PracticeSetSummary` (the `GET sets/:id` body),
 * the session history page and `AnswerSheet`.
 */

export type PracticeMode = 'PRACTICE' | 'REVIEW' | 'EXAM'
export const practiceModes = ['PRACTICE', 'REVIEW', 'EXAM'] as const satisfies readonly PracticeMode[]
export type QuestionKind = 'MCQ' | 'MULTI_SELECT' | 'TRUE_FALSE' | 'CLOZE' | 'MATCHING' | 'ORDERING' | 'SHORT_ANSWER'
export const questionKinds = ['MCQ', 'MULTI_SELECT', 'TRUE_FALSE', 'CLOZE', 'MATCHING', 'ORDERING', 'SHORT_ANSWER'] as const satisfies readonly QuestionKind[]
export type Stars = 0 | 1 | 2 | 3
export type SetStatus = 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED' | 'CANCELLED'
export type SessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED' | 'EXPIRED'
export type AttemptStatus = 'GRADED' | 'PENDING_FEEDBACK' | 'FEEDBACK_UNAVAILABLE' | 'RECORDED'

/* ---------- learner question view (never contains a key, accepted answer, rubric, explanation or model answer) ---------- */

export interface ChoiceOption { id: string; text: string }
export type ClozePart = { type: 'text'; text: string } | { type: 'blank'; id: string; options: ChoiceOption[] | null }
interface QuestionBase {
  itemIndex: number; questionId: string; kind: QuestionKind; prompt: string
  hintsAvailable: 0 | 1 | 2 | 3; sourceLink: Link | null; timeLimitSec: number | null
  attemptsAllowed: number; attemptNo: number
}
export type QuestionView = QuestionBase & (
  | { kind: 'MCQ' | 'MULTI_SELECT'; options: ChoiceOption[]; minSelect?: number }
  | { kind: 'TRUE_FALSE' }
  | { kind: 'CLOZE'; parts: ClozePart[] }
  | { kind: 'MATCHING'; left: ChoiceOption[]; right: ChoiceOption[] }
  | { kind: 'ORDERING'; items: ChoiceOption[] }
  | { kind: 'SHORT_ANSWER'; maxChars: number }
)

export type PracticeAnswer =
  | { kind: 'MCQ'; optionId: string }
  | { kind: 'MULTI_SELECT'; optionIds: string[] }
  | { kind: 'TRUE_FALSE'; value: boolean }
  | { kind: 'CLOZE'; blanks: { blankId: string; value: string }[] }
  | { kind: 'MATCHING'; pairs: { leftId: string; rightId: string }[] }
  | { kind: 'ORDERING'; order: string[] }
  | { kind: 'SHORT_ANSWER'; text: string }

export interface AnswerBody { clientAttemptId: string; answer: PracticeAnswer; timeSpentMs: number }
export interface AnswerReceipt {
  attempt: { id: string; attemptNo: number; status: AttemptStatus }
  /** null in an EXAM until the session is completed. */
  result: { correct: boolean | null; partial: boolean; score: number | null; feedback: string | null; explanation: string | null; correctAnswerRevealed: boolean; revealedAnswer: unknown | null; sourceLink: Link | null } | null
  canRetry: boolean; attemptsLeft: number; isLastItem: boolean; replay: boolean
}
export interface HintResult { level: 1 | 2 | 3; text: string }

/* ---------- hub, sets, sessions, summary ---------- */

export interface SessionRow {
  id: string; mode: PracticeMode; status: SessionStatus; title: string
  subject: { id: string; name: string } | null
  startedAt: string; completedAt: string | null; durationSec: number | null
  itemCount: number; answered: number
  /** null while the session is running or when nothing was scored. */
  correct: number | null; stars: Stars | null
}
export interface PracticeSetSummary {
  id: string; title: string | null; sourceKind: 'MATERIAL' | 'LESSON'; materialId: string; lessonId: string | null
  status: SetStatus; version: number; band: ApiBand; questionCount: number
  createdAt: string; readyAt: string | null; failure: { code: string; retryable: boolean } | null
}
export interface HubSet {
  id: string; title: string; subject: { id: string; name: string } | null; materialId: string | null; questionCount: number
  status: 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED'; bestStars: Stars | null; lastPracticedAt: string | null; start: Actionable
}
export interface PracticeHub {
  band: ApiBand
  state: 'DEFAULT' | 'CAUGHT_UP' | 'NO_CONTENT'
  due: { count: number; estimatedMinutes: number | null; start: Actionable } | null
  sets: HubSet[]
  teacherPractice: { planId: string; topicId: string | null; title: string; questionCount: number; practiced: number; assignedBy: string | null; start: Actionable }[]
  exams: { planId: string; title: string; questionCount: number; minutes: number; start: Actionable }[]
  weakSpots: { conceptId: string; name: string }[]
  recent: SessionRow[]
  unavailableKinds: { kind: 'CODE' | 'VOICE'; reason: string }[]
}
export interface SessionHistory { sessions: SessionRow[]; nextCursor: string | null }
export interface PracticeSessionState {
  session: SessionRow
  progress: { answered: number; total: number; currentIndex: number }
  /** Seconds left for a timed session (EXAM), from the server clock. */
  remainingSec: number | null
}
export interface PracticeSummary {
  /** Not in the B09 contract text: the age band the server resolved. When absent the page uses the signed-in child's band, then teens. */
  band?: ApiBand
  session: SessionRow
  score: { correct: number; total: number; firstTryCorrect: number; accuracyPercent: number | null }
  durationSec: number; stars: Stars
  tough: boolean
  missed: { itemIndex: number; prompt: string; explanation: string | null; sourceLink: Link | null }[]
  feedbackUnavailableCount: number
  nextReviewAt: string | null
  reward: { kind: 'SESSION_COMPLETE'; stars: number } | null
  /** Null in B09. Widened to a number so a later release (B11/B17) shows up without a client change; rendered only when non-null. */
  xp: number | null; level: number | null; readiness: number | null
  next: { quickRecap: Actionable; retry: Actionable; teachBack: Actionable; home: Link }
}
/** Completed sessions only. The answer sheet is where the answers and explanations are revealed. */
export interface AnswerSheetItem {
  itemIndex: number; kind: QuestionKind; prompt: string
  yourAnswer: string | null; correctAnswer: string | null
  correct: boolean | null; partial: boolean; score: number | null
  gradingStatus: 'NOT_NEEDED' | 'PENDING' | 'GRADED' | 'FEEDBACK_UNAVAILABLE'
  feedback: string | null; explanation: string | null; sourceLink: Link | null
  attempts: number
  /** The attempt a "check again" request names, present only while feedback is unavailable. */
  attemptId: string | null
}
export interface AnswerSheet { /** As on PracticeSummary: optional, not in the B09 contract text. */ band?: ApiBand; session: SessionRow; items: AnswerSheetItem[] }

export type SessionScopeKind = 'DUE' | 'SET' | 'TOPIC' | 'PLAN_EXAM'
export interface CreateSessionBody {
  /** A stable client-generated id: a refresh or double press returns the same session. */
  clientSessionId: string
  mode: PracticeMode
  scope: { kind: SessionScopeKind; id?: string; planId?: string }
  size?: number
}
export type CreateSetBody = { materialId: string } | { lessonId: string }

/* ---------- schemas ---------- */

const id = z.string().min(1).max(256)
const short = z.string().max(1000)
const long = z.string().max(6000)
const iso = z.string().min(1)
const count = z.number().int().nonnegative()
const band = z.enum(['6-9', '10-13', '14-17'])
const stars = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)])
const actionable = z.object({ link: linkSchema.nullable(), enabled: z.boolean(), disabledReason: short.nullable() }) satisfies z.ZodType<Actionable>
const subject = z.object({ id, name: short })
const mode = z.enum(practiceModes)

/** Names that would turn a learner question into an answer key. Matched case-insensitively, at any depth. */
const questionKeyNames = new Set([
  'correctoptionid', 'correctoptionids', 'correctoption', 'answerkey', 'correctanswer', 'correctanswers', 'iscorrect', 'correct', 'correctpairs', 'correctorder',
  'accepted', 'acceptedanswers', 'rubric', 'explanation', 'modelanswer', 'answer', 'solution', 'hints', 'hint', 'feedback',
])
export function leaksQuestionKey(value: unknown, depth = 0): boolean {
  if (depth > 12 || value === null || typeof value !== 'object') return false
  if (Array.isArray(value)) return value.some(item => leaksQuestionKey(item, depth + 1))
  return Object.entries(value).some(([key, item]) => questionKeyNames.has(key.toLowerCase()) || leaksQuestionKey(item, depth + 1))
}

const choice = z.strictObject({ id, text: short }) satisfies z.ZodType<ChoiceOption>
const uniqueIds = (items: readonly { id: string }[]) => new Set(items.map(item => item.id)).size === items.length
const choices = (min: number, max: number) => z.array(choice).min(min).max(max).refine(uniqueIds, 'Option ids must be unique.')
const base = {
  itemIndex: count, questionId: id, prompt: long,
  hintsAvailable: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  sourceLink: linkSchema.nullable(), timeLimitSec: count.nullable(),
  attemptsAllowed: z.number().int().min(1).max(10), attemptNo: z.number().int().min(1).max(10),
}
const clozePart = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('text'), text: long }),
  z.strictObject({ type: z.literal('blank'), id, options: choices(2, 8).nullish().transform(value => value ?? null) }),
]) satisfies z.ZodType<ClozePart, unknown>
const questionBody = z.discriminatedUnion('kind', [
  z.strictObject({ ...base, kind: z.literal('MCQ'), options: choices(2, 8), minSelect: z.number().int().min(1).max(8).optional() }),
  z.strictObject({ ...base, kind: z.literal('MULTI_SELECT'), options: choices(2, 10), minSelect: z.number().int().min(1).max(10).optional() }),
  z.strictObject({ ...base, kind: z.literal('TRUE_FALSE') }),
  z.strictObject({ ...base, kind: z.literal('CLOZE'), parts: z.array(clozePart).min(1).max(40) }),
  z.strictObject({ ...base, kind: z.literal('MATCHING'), left: choices(2, 8), right: choices(2, 10) }),
  z.strictObject({ ...base, kind: z.literal('ORDERING'), items: choices(2, 10) }),
  z.strictObject({ ...base, kind: z.literal('SHORT_ANSWER'), maxChars: z.number().int().min(1).max(4000) }),
])
/** Defence in depth: a question that carries a key, rubric or explanation is refused whole, so it is never held in memory. */
export const questionViewSchema = z.preprocess((value, context) => {
  if (leaksQuestionKey(value)) { context.addIssue({ code: 'custom', message: 'The learner question must not contain an answer key.' }); return z.NEVER }
  return value
}, questionBody) satisfies z.ZodType<QuestionView, unknown>

export const practiceAnswerSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('MCQ'), optionId: id }),
  z.strictObject({ kind: z.literal('MULTI_SELECT'), optionIds: z.array(id).min(1).max(10) }),
  z.strictObject({ kind: z.literal('TRUE_FALSE'), value: z.boolean() }),
  z.strictObject({ kind: z.literal('CLOZE'), blanks: z.array(z.strictObject({ blankId: id, value: z.string().max(80) })).min(1).max(10) }),
  z.strictObject({ kind: z.literal('MATCHING'), pairs: z.array(z.strictObject({ leftId: id, rightId: id })).min(1).max(10) }),
  z.strictObject({ kind: z.literal('ORDERING'), order: z.array(id).min(2).max(10) }),
  z.strictObject({ kind: z.literal('SHORT_ANSWER'), text: z.string().min(1).max(4000) }),
]) satisfies z.ZodType<PracticeAnswer>
export const answerBodySchema = z.strictObject({
  clientAttemptId: z.string().min(8).max(64), answer: practiceAnswerSchema, timeSpentMs: z.number().int().min(0).max(86_400_000),
}) satisfies z.ZodType<AnswerBody>

const receiptResult = z.object({
  correct: z.boolean().nullable(), partial: z.boolean(), score: z.number().min(0).max(1).nullable(), feedback: long.nullable(), explanation: long.nullable(),
  correctAnswerRevealed: z.boolean(), revealedAnswer: z.unknown().nullable(), sourceLink: linkSchema.nullable(),
}).superRefine((value, context) => {
  // The answer is revealed only after a correct pick or when the tries are used up; an unrevealed answer carries nothing.
  if (!value.correctAnswerRevealed && value.revealedAnswer !== null && value.revealedAnswer !== undefined) context.addIssue({ code: 'custom', message: 'An answer that is not revealed must not be sent.', path: ['revealedAnswer'] })
})
export const answerReceiptSchema = z.object({
  attempt: z.object({ id, attemptNo: z.number().int().min(1), status: z.enum(['GRADED', 'PENDING_FEEDBACK', 'FEEDBACK_UNAVAILABLE', 'RECORDED']) }),
  result: receiptResult.transform(value => ({ ...value, revealedAnswer: value.revealedAnswer ?? null })).nullable(),
  canRetry: z.boolean(), attemptsLeft: count, isLastItem: z.boolean(), replay: z.boolean(),
}) satisfies z.ZodType<AnswerReceipt, unknown>
export const hintResultSchema = z.object({ level: z.union([z.literal(1), z.literal(2), z.literal(3)]), text: long }) satisfies z.ZodType<HintResult>

export const sessionRowSchema = z.object({
  id, mode, status: z.enum(['IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'EXPIRED']), title: short,
  subject: subject.nullable(), startedAt: iso, completedAt: iso.nullable(), durationSec: count.nullable(),
  itemCount: count, answered: count, correct: count.nullable(), stars: stars.nullable(),
}) satisfies z.ZodType<SessionRow>
const hubStatus = z.enum(['QUEUED', 'RUNNING', 'READY', 'FAILED'])
export const practiceHubSchema = z.object({
  band, state: z.enum(['DEFAULT', 'CAUGHT_UP', 'NO_CONTENT']),
  due: z.object({ count, estimatedMinutes: count.nullable(), start: actionable }).nullable(),
  sets: z.array(z.object({ id, title: short, subject: subject.nullable(), materialId: id.nullable(), questionCount: count, status: hubStatus, bestStars: stars.nullable(), lastPracticedAt: iso.nullable(), start: actionable })),
  teacherPractice: z.array(z.object({ planId: id, topicId: id.nullable(), title: short, questionCount: count, practiced: count, assignedBy: short.nullable(), start: actionable })),
  exams: z.array(z.object({ planId: id, title: short, questionCount: count, minutes: count, start: actionable })),
  weakSpots: z.array(z.object({ conceptId: id, name: short })),
  recent: z.array(sessionRowSchema),
  unavailableKinds: z.array(z.object({ kind: z.enum(['CODE', 'VOICE']), reason: short })),
}) satisfies z.ZodType<PracticeHub>

export const practiceSetSchema = z.object({
  id, title: short.nullable(), sourceKind: z.enum(['MATERIAL', 'LESSON']), materialId: id, lessonId: id.nullable().optional().transform(value => value ?? null),
  status: z.enum(['QUEUED', 'RUNNING', 'READY', 'FAILED', 'CANCELLED']), version: count, band,
  // The platform sends null until a set is READY (questions are committed atomically); treat that as 0.
  questionCount: z.preprocess(value => value ?? 0, count),
  createdAt: iso, readyAt: iso.nullable(), failure: z.object({ code: z.string().min(1).max(64), retryable: z.boolean() }).nullable(),
}) satisfies z.ZodType<PracticeSetSummary, unknown>
export const setResponseSchema = z.object({ set: practiceSetSchema })
/** The session history page; `items` is accepted as an alias of `sessions`. */
export const sessionHistorySchema = z.union([
  z.object({ sessions: z.array(sessionRowSchema), nextCursor: z.string().max(1024).nullable() }),
  z.object({ items: z.array(sessionRowSchema), nextCursor: z.string().max(1024).nullable() }),
]).transform((value): SessionHistory => ({ sessions: 'sessions' in value ? value.sessions : value.items, nextCursor: value.nextCursor }))
export const sessionStateSchema = z.object({
  session: sessionRowSchema,
  progress: z.object({ answered: count, total: count, currentIndex: count }),
  remainingSec: count.nullable(),
}) satisfies z.ZodType<PracticeSessionState>
/** Only the id is needed to move to the session player, so the create answer is read leniently. */
export const createSessionResponseSchema = z.object({ session: z.object({ id }) })

const anyNumber = z.preprocess(value => typeof value === 'number' && Number.isFinite(value) ? value : null, z.number().nullable())
export const practiceSummarySchema = z.object({
  band: band.optional(),
  session: sessionRowSchema,
  score: z.object({ correct: count, total: count, firstTryCorrect: count, accuracyPercent: z.number().min(0).max(100).nullable() }),
  durationSec: count, stars,
  tough: z.boolean(),
  missed: z.array(z.object({ itemIndex: count, prompt: long, explanation: long.nullable(), sourceLink: linkSchema.nullable() })).max(200),
  feedbackUnavailableCount: count,
  nextReviewAt: iso.nullable(),
  reward: z.object({ kind: z.literal('SESSION_COMPLETE'), stars: z.number().int().min(0).max(3) }).nullable(),
  xp: anyNumber, level: anyNumber, readiness: anyNumber,
  next: z.object({ quickRecap: actionable, retry: actionable, teachBack: actionable, home: linkSchema }),
}) satisfies z.ZodType<PracticeSummary, unknown>
export const answerSheetSchema = z.object({
  band: band.optional(),
  session: sessionRowSchema,
  items: z.array(z.object({
    itemIndex: count, kind: z.enum(questionKinds), prompt: long, yourAnswer: long.nullable(), correctAnswer: long.nullable(),
    correct: z.boolean().nullable(), partial: z.boolean(), score: z.number().min(0).max(1).nullable(),
    gradingStatus: z.enum(['NOT_NEEDED', 'PENDING', 'GRADED', 'FEEDBACK_UNAVAILABLE']),
    feedback: long.nullable(), explanation: long.nullable(), sourceLink: linkSchema.nullable(), attempts: count,
    attemptId: id.nullable().optional().transform(value => value ?? null),
  })).max(200),
}) satisfies z.ZodType<AnswerSheet, unknown>

/* ---------- pure helpers ---------- */

const resourceId = /^[a-zA-Z0-9_-]{1,128}$/
export const isPracticeId = (value: string | null | undefined): value is string => !!value && resourceId.test(value)
/** The only scopes the start page accepts from the address bar (HUB never starts anything). */
export type StartScope = 'DUE' | 'MATERIAL' | 'LESSON' | 'TOPIC' | 'PLAN_EXAM' | 'SET'
export const startScopes = ['DUE', 'MATERIAL', 'LESSON', 'TOPIC', 'PLAN_EXAM', 'SET'] as const satisfies readonly StartScope[]
export const isStartScope = (value: string | null | undefined): value is StartScope => !!value && (startScopes as readonly string[]).includes(value)

/** DUE is a review, PLAN_EXAM is the timed mock test, everything else is practice (hints and retries allowed). */
export const modeForScope = (scope: StartScope): PracticeMode => scope === 'DUE' ? 'REVIEW' : scope === 'PLAN_EXAM' ? 'EXAM' : 'PRACTICE'

/** What the session request names. A MATERIAL or LESSON scope becomes the SET that was made for it. */
export function sessionScopeFor(scope: StartScope, id: string | null, planId: string | null, setId: string | null): CreateSessionBody['scope'] | null {
  switch (scope) {
    case 'DUE': return { kind: 'DUE' }
    case 'SET': return id ? { kind: 'SET', id } : null
    case 'MATERIAL': case 'LESSON': return setId ? { kind: 'SET', id: setId } : null
    // The server needs the topic AND its plan (both are checked against the learner's enrolment), so a TOPIC without a plan is not startable.
    case 'TOPIC': return id && planId ? { kind: 'TOPIC', id, planId } : null
    case 'PLAN_EXAM': return id ? { kind: 'PLAN_EXAM', id, planId: id } : null
  }
}

/** Why an answer cannot be sent: the kind must equal the item's kind and every id must belong to it. Null when it is fine. */
export function answerIssue(question: QuestionView, answer: PracticeAnswer): string | null {
  if (answer.kind !== question.kind) return 'ANSWER_KIND_MISMATCH'
  const has = (ids: readonly { id: string }[], value: string) => ids.some(item => item.id === value)
  switch (question.kind) {
    case 'MCQ': return answer.kind === 'MCQ' && has(question.options, answer.optionId) ? null : 'ANSWER_INVALID'
    case 'MULTI_SELECT': {
      if (answer.kind !== 'MULTI_SELECT' || answer.optionIds.length === 0) return 'ANSWER_INVALID'
      if (question.minSelect && answer.optionIds.length < question.minSelect) return 'ANSWER_INVALID'
      return new Set(answer.optionIds).size === answer.optionIds.length && answer.optionIds.every(item => has(question.options, item)) ? null : 'ANSWER_INVALID'
    }
    case 'TRUE_FALSE': return answer.kind === 'TRUE_FALSE' ? null : 'ANSWER_INVALID'
    case 'CLOZE': {
      if (answer.kind !== 'CLOZE') return 'ANSWER_INVALID'
      const blanks = question.parts.filter((part): part is Extract<ClozePart, { type: 'blank' }> => part.type === 'blank')
      if (answer.blanks.length !== blanks.length) return 'ANSWER_INVALID'
      return blanks.every(blank => {
        const given = answer.blanks.find(item => item.blankId === blank.id)
        if (!given) return false
        return blank.options ? has(blank.options, given.value) : given.value.trim().length > 0 && given.value.length <= 80
      }) ? null : 'ANSWER_INVALID'
    }
    case 'MATCHING': return answer.kind === 'MATCHING' && answer.pairs.length === question.left.length
      && new Set(answer.pairs.map(pair => pair.leftId)).size === answer.pairs.length
      && answer.pairs.every(pair => has(question.left, pair.leftId) && has(question.right, pair.rightId)) ? null : 'ANSWER_INVALID'
    case 'ORDERING': return answer.kind === 'ORDERING' && answer.order.length === question.items.length
      && new Set(answer.order).size === answer.order.length && answer.order.every(item => has(question.items, item)) ? null : 'ANSWER_INVALID'
    case 'SHORT_ANSWER': return answer.kind === 'SHORT_ANSWER' && answer.text.trim().length > 0 && answer.text.length <= question.maxChars ? null : 'ANSWER_INVALID'
  }
}

/** A client-generated id for an idempotent request (session, attempt). */
export function newClientId(prefix = 'c'): string {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  return `${prefix}-${random}`.slice(0, 64)
}

export interface HubFilters { subjectId?: string | null; planId?: string | null }
export function hubQuery(filters: HubFilters = {}): string {
  const params = new URLSearchParams()
  if (isPracticeId(filters.subjectId)) params.set('subjectId', filters.subjectId)
  if (isPracticeId(filters.planId)) params.set('planId', filters.planId)
  const text = params.toString()
  return text ? `?${text}` : ''
}
export function historyQuery(cursor?: string | null, limit = 20): string {
  const params = new URLSearchParams({ limit: String(Math.min(50, Math.max(1, Math.floor(limit)))) })
  if (cursor) params.set('cursor', cursor)
  return params.toString()
}

const enc = encodeURIComponent
const session = (sessionId: string) => `/practice/sessions/${enc(sessionId)}`
const item = (sessionId: string, index: number) => `${session(sessionId)}/items/${Math.max(0, Math.floor(index))}`

export const practiceApi = {
  hub: (filters: HubFilters = {}) => learnRequest(`/practice/hub${hubQuery(filters)}`, practiceHubSchema),
  /** Idempotent get-or-create of the question set for one material or lesson. */
  createSet: (body: CreateSetBody) => learnRequest('/practice/sets', setResponseSchema, 'POST', body),
  set: (setId: string) => learnRequest(`/practice/sets/${enc(setId)}`, setResponseSchema),
  retrySet: (setId: string) => learnRequest(`/practice/sets/${enc(setId)}/retry`, setResponseSchema, 'POST', {}),
  cancelSet: (setId: string) => learnRequest(`/practice/sets/${enc(setId)}/cancel`, z.unknown(), 'POST', {}),
  history: (cursor?: string | null, limit?: number) => learnRequest(`/practice/sessions?${historyQuery(cursor, limit)}`, sessionHistorySchema),
  /** Idempotent per `clientSessionId`. */
  createSession: (body: CreateSessionBody) => learnRequest('/practice/sessions', createSessionResponseSchema, 'POST', body),
  session: (sessionId: string) => learnRequest(session(sessionId), sessionStateSchema),
  item: (sessionId: string, index: number) => learnRequest(item(sessionId, index), questionViewSchema),
  /** The body is checked first, so a malformed answer never leaves the browser. Replaying a `clientAttemptId` returns the stored receipt. */
  answer: (sessionId: string, index: number, body: AnswerBody) => learnRequest(`${item(sessionId, index)}/answer`, answerReceiptSchema, 'POST', answerBodySchema.parse(body)),
  hint: (sessionId: string, index: number, level: 1 | 2 | 3) => learnRequest(`${item(sessionId, index)}/hint`, hintResultSchema, 'POST', { level }),
  skip: (sessionId: string, index: number) => learnRequest(`${item(sessionId, index)}/skip`, z.unknown(), 'POST', {}),
  complete: (sessionId: string) => learnRequest(`${session(sessionId)}/complete`, z.unknown(), 'POST', {}),
  summary: (sessionId: string) => learnRequest(`${session(sessionId)}/summary`, practiceSummarySchema),
  answerSheet: (sessionId: string) => learnRequest(`${session(sessionId)}/answer-sheet`, answerSheetSchema),
  /** Queues one more check of a written answer whose feedback was unavailable. */
  regrade: (attemptId: string) => learnRequest(`/practice/attempts/${enc(attemptId)}/regrade`, z.unknown(), 'POST', {}),
}

/* ---------- error copy ---------- */

/** Routes the learner can open for a session id. Resource ids are validated by the caller (`isPracticeId`). */
export const practiceRoutes = {
  hub: '/learn/practice',
  hubPast: '/learn/practice?tab=past',
  session: (sessionId: string) => `/learn/practice/session/${enc(sessionId)}`,
  summary: (sessionId: string) => `/learn/practice/summary/${enc(sessionId)}`,
  answerSheet: (sessionId: string) => `/learn/practice/answer-sheet/${enc(sessionId)}`,
}

const failureText: Record<string, string> = {
  insufficient_source: 'There is not enough in this material to make good questions. Try adding more.',
  INSUFFICIENT_SOURCE: 'There is not enough in this material to make good questions. Try adding more.',
  unsafe_content: 'Co could not make questions from this material.',
  UNSAFE_CONTENT: 'Co could not make questions from this material.',
  age_band_unsupported: 'Practice questions are not available for this age yet.',
  AGE_BAND_UNSUPPORTED: 'Practice questions are not available for this age yet.',
  authorization_changed: 'Access to this material changed, so the questions could not be finished.',
  cancelled: 'These questions were stopped.',
}
/** Reason text for a FAILED question set. Unknown codes get a generic line; raw codes are never shown. */
export const practiceFailureText = (failure: { code: string } | null): string => (failure && failureText[failure.code]) ?? 'Co could not finish these questions. You can try again.'

export const practiceErrorCode = (error: unknown): string | undefined => {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : undefined
}
/** The learner-safe text is built in `learnErrorMessage`; this reads it off the error (server text only ever for POLICY_BLOCKED). */
export const practiceErrorMessage = (error: unknown, fallback = 'Practice is unavailable right now. Please try again.'): string =>
  error instanceof Error && error.message ? error.message : fallback
