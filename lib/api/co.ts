import { z } from 'zod'
import { linkSchema, type ApiBand, type Link } from './learn'
import { learnRequest } from './learn-request'

/*
 * B10 Ask Co and guided homework contract (platform <-> web), 21 October 2026 (agents/contracts/B10-contracts.md).
 * The platform co and co-homework modules (agents CD1/CD2) are built in parallel, so these local interfaces mirror the
 * contract and every Zod schema below `satisfies` them until @colearner/api-client ships the matching types.
 * A null field means "hide the widget": the UI never invents a value.
 *
 * Safety of what is held in memory: a Co reply is parsed with a STRICT schema (unknown keys are rejected), and any payload
 * that carries a field named answer / solution / key / rubric (or the obvious variants) is refused whole, so an answer key
 * or a worked solution can never reach a component. A turn that is not READY never carries reply text (no partial text).
 *
 * Coordinator decisions of 21 October 2026 (after the contract text): a turn view always carries `kind`; a homework session
 * always carries `conversationId`; the session state exposes the served `hints` and `finalAttempts`; the homework list is
 * `GET homework/sessions?cursor&limit`; the problem is replaced with `PUT homework/sessions/:id/problem`; the restatement answer
 * takes a `clientTurnId`; `POST .../finish` ends a checked session.
 *
 * Still NOT defined by the contract text (kept tolerant, see docs/b10-homework-web.md): the conversation summary and co history
 * rows, the shape of the homework create answer, an optional `band` on a homework session, the homework `parentVisibility`
 * spelling (a string or { mode }), and whether `hints` / `finalAttempts` sit at the top of the state or inside `session`.
 */

export type Band = ApiBand
export type SafetyReasonCode = 'SELF_HARM' | 'ABUSE_DISCLOSURE' | 'PERSONAL_INFORMATION' | 'EXPLICIT_CONTENT' | 'VIOLENCE' | 'BULLYING' | 'DISTRESS' | 'PRIVACY_RISK' | 'OFF_TOPIC_UNSAFE' | 'OTHER'
export const safetyReasonCodes = ['SELF_HARM', 'ABUSE_DISCLOSURE', 'PERSONAL_INFORMATION', 'EXPLICIT_CONTENT', 'VIOLENCE', 'BULLYING', 'DISTRESS', 'PRIVACY_RISK', 'OFF_TOPIC_UNSAFE', 'OTHER'] as const satisfies readonly SafetyReasonCode[]
export type CoDisposition = 'LEARNING' | 'CLARIFY' | 'SAFE_REDIRECT' | 'TRUSTED_ADULT'
export const coDispositions = ['LEARNING', 'CLARIFY', 'SAFE_REDIRECT', 'TRUSTED_ADULT'] as const satisfies readonly CoDisposition[]
export type CoContext =
  | { kind: 'LESSON'; lessonId: string; stepIndex: number | null }
  | { kind: 'MATERIAL'; materialId: string }
  | { kind: 'HOMEWORK'; homeworkSessionId: string }
export type TurnStatus = 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED' | 'CANCELLED'
export const turnStatuses = ['QUEUED', 'RUNNING', 'READY', 'FAILED', 'CANCELLED'] as const satisfies readonly TurnStatus[]
export type TurnKind = 'CHAT' | 'HW_RESTATE' | 'HW_STEP' | 'HW_HINT' | 'HW_CHECK'
export const turnKinds = ['CHAT', 'HW_RESTATE', 'HW_STEP', 'HW_HINT', 'HW_CHECK'] as const satisfies readonly TurnKind[]

export interface CoSource { label: string; anchorRef: string; quote: string; link: Link | null }
export interface CoReply {
  text: string
  disposition: CoDisposition
  beyondMaterial: boolean
  /** Only when `beyondMaterial` is true. */
  beyondNote: string | null
  sources: CoSource[]
  /** At most three short follow-up questions. */
  suggestions: string[]
  /** Teens EXAM style only, at most four. */
  keyPoints: string[] | null
  safety: { redirected: boolean; reasonCodes: SafetyReasonCode[]; /** Code-owned text. */ guidance: string | null }
  generatedBy: { kind: 'AI'; packVersion: string; promptRelease: string } | { kind: 'CODE' }
}
export interface CoTurnView {
  id: string; ordinal: number; clientTurnId: string; learnerText: string; status: TurnStatus; createdAt: string
  reply: CoReply | null
  failure: { code: string; retryable: boolean } | null
  kind: TurnKind
}

/* ---------- context, conversations ---------- */

export interface CoCapabilityNote { available: boolean; reason: string | null }
export interface CoContextInfo {
  available: boolean; reason: string | null
  source: { title: string; materialId: string; link: Link | null } | null
  /** Code-owned per band and context, no AI. */
  suggestions: string[]
  openConversationId: string | null
  parentVisibility: { mode: 'FULL' | 'SUMMARY' }
  voice: CoCapabilityNote
  photo: CoCapabilityNote
  hintsMax: 0 | 1 | 2 | 3
  /** Not in the contract text: the age band the server resolved. */
  band?: Band
}
export interface CoConversation {
  id: string
  kind: 'CHAT' | 'HOMEWORK' | null
  context: CoContext | null
  title: string
  status: 'OPEN' | 'CLOSED' | null
  turnCount: number | null
  lastTurnAt: string | null
}
export interface CoConversationDetail { conversation: CoConversation; turns: CoTurnView[]; pending: CoTurnView | null }
export interface CoHistoryPage { conversations: CoConversation[]; nextCursor: string | null }
export interface CoContextQuery { lessonId?: string | null; materialId?: string | null; stepIndex?: number | null }
export interface SendTurnBody { clientTurnId: string; text: string; style?: 'SIMPLE' | 'EXAM'; stepIndex?: number }

/* ---------- homework ---------- */

export type HomeworkPhase = 'CAPTURE' | 'RESTATE' | 'STEPS' | 'FINAL' | 'CHECKED' | 'DONE' | 'ABANDONED'
export const homeworkPhases = ['CAPTURE', 'RESTATE', 'STEPS', 'FINAL', 'CHECKED', 'DONE', 'ABANDONED'] as const satisfies readonly HomeworkPhase[]
export type FinalVerdict = 'on_track' | 'not_yet' | 'unclear'
export const finalVerdicts = ['on_track', 'not_yet', 'unclear'] as const satisfies readonly FinalVerdict[]
export type ParentVisibilityMode = 'FULL' | 'SUMMARY'
export interface HomeworkStep { number: number; prompt: string; learnerResponse: string | null }
/** The learner's OWN answer and the coach's verdict on it. The correct answer is never part of this. */
export interface HomeworkFinal { answer: string; verdict: FinalVerdict | null; feedback: string | null }
export interface HomeworkSession {
  id: string; phase: HomeworkPhase; stepNumber: number; hintLevel: number; hintsUsed: number
  /** The school and family cap, 0..3. */
  hintsMax: number
  parentVisibility: { mode: ParentVisibilityMode }
  problem: string
  /** Names the failed turn to the co retry endpoint. */
  conversationId: string
  /** How many times the learner has typed a final answer (0 to 3). */
  finalAttempts: number
  /** Optional (assumption): the age band the server resolved. */
  band: Band | null
}
/** A hint rung the server already served, with the step it belongs to (resume shows these). */
export interface HomeworkHintServed { level: 1 | 2 | 3; text: string; stepNumber: number }
export interface HomeworkDetail {
  session: HomeworkSession
  turns: CoTurnView[]
  pending: CoTurnView | null
  steps: HomeworkStep[]
  restatement: string | null
  final: HomeworkFinal | null
  /** Every rung served so far, oldest first. */
  hints: HomeworkHintServed[]
}
/** One row of the learner's earlier homework sessions. */
export interface HomeworkListItem {
  id: string; conversationId: string; phase: HomeworkPhase; problemPreview: string
  stepNumber: number; hintsUsed: number; startedAt: string; finalVerdict: FinalVerdict | null
}
export interface HomeworkListPage { items: HomeworkListItem[]; nextCursor: string | null }
export interface RestatementBody { clientTurnId: string; confirmed: boolean }
export interface ProblemBody { clientTurnId: string; problem: string }
export interface CreateHomeworkBody { problem: string; referenceMaterialId?: string; clientSessionId: string }
export interface StepBody { clientTurnId: string; learnerResponse: string }
export interface HintBody { clientTurnId: string; level: 1 | 2 | 3 }
export interface FinalBody { clientTurnId: string; answerText: string }

/* ---------- answer-key guard ---------- */

/** Field names that would turn a Co or homework payload into an answer key or a worked solution. Matched case-insensitively at any depth. */
const answerKeyNames = new Set([
  'answer', 'answers', 'solution', 'solutions', 'key', 'keys', 'rubric', 'answerkey', 'correctanswer', 'correctanswers', 'finalanswer', 'modelanswer',
  'workedsolution', 'expectedanswer', 'correctoptionid', 'markscheme',
])
const normalise = (name: string) => name.toLowerCase().replace(/[_\-\s]/g, '')
/** True when the value, at any depth, has a field named like an answer key. Strings are never inspected (a hint may contain any word). */
export function leaksAnswerKey(value: unknown, depth = 0): boolean {
  if (depth > 14 || value === null || typeof value !== 'object') return false
  if (Array.isArray(value)) return value.some(item => leaksAnswerKey(item, depth + 1))
  return Object.entries(value).some(([key, item]) => answerKeyNames.has(normalise(key)) || leaksAnswerKey(item, depth + 1))
}
const guarded = <S extends z.ZodType>(schema: S) => z.preprocess((value, context) => {
  if (leaksAnswerKey(value)) { context.addIssue({ code: 'custom', message: 'A Co payload must not contain an answer key or a solution.' }); return z.NEVER }
  return value
}, schema)

/* ---------- schemas ---------- */

const id = z.string().min(1).max(256)
const iso = z.string().min(1)
const count = z.number().int().nonnegative()
const band = z.enum(['6-9', '10-13', '14-17'])
const lines = (max: number) => z.string().max(max)

export const safetyReasonCodeSchema = z.enum(safetyReasonCodes)
export const coDispositionSchema = z.enum(coDispositions)
export const coSourceSchema = z.strictObject({
  label: z.string().min(1).max(120), anchorRef: id, quote: lines(2000), link: linkSchema.nullable(),
}) satisfies z.ZodType<CoSource, unknown>

const coReplyBody = z.strictObject({
  text: lines(6000),
  disposition: coDispositionSchema,
  beyondMaterial: z.boolean(),
  beyondNote: lines(600).nullish().transform(value => value ?? null),
  sources: z.array(coSourceSchema).max(12),
  suggestions: z.array(lines(300)).max(3),
  keyPoints: z.array(lines(400)).max(4).nullish().transform(value => value ?? null),
  safety: z.strictObject({
    redirected: z.boolean(),
    reasonCodes: z.array(safetyReasonCodeSchema).max(10),
    guidance: lines(3000).nullish().transform(value => value ?? null),
  }),
  generatedBy: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('AI'), packVersion: z.string().min(1).max(64), promptRelease: z.string().min(1).max(128) }),
    z.strictObject({ kind: z.literal('CODE') }),
  ]),
}).superRefine((value, context) => {
  // The "beyond your material" note exists only when the server says the reply goes beyond the material.
  if (value.beyondNote !== null && !value.beyondMaterial) context.addIssue({ code: 'custom', message: 'beyondNote requires beyondMaterial.', path: ['beyondNote'] })
})
export const coReplySchema = guarded(coReplyBody) satisfies z.ZodType<CoReply, unknown>

const turnFailure = z.strictObject({ code: z.string().min(1).max(64), retryable: z.boolean() })
export const coTurnViewSchema = z.strictObject({
  id, ordinal: count, clientTurnId: id, learnerText: lines(6000), status: z.enum(turnStatuses), createdAt: iso,
  reply: coReplySchema.nullable(),
  failure: turnFailure.nullable(),
  kind: z.enum(turnKinds),
}).superRefine((value, context) => {
  // Co's text exists only on a finished turn: a queued or running turn never carries partial text.
  if (value.status !== 'READY' && value.reply !== null) context.addIssue({ code: 'custom', message: 'Only a READY turn carries a reply.', path: ['reply'] })
  if (value.status === 'READY' && value.reply === null) context.addIssue({ code: 'custom', message: 'A READY turn carries a reply.', path: ['reply'] })
}) satisfies z.ZodType<CoTurnView, unknown>

export const coContextSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('LESSON'), lessonId: id, stepIndex: z.number().int().min(0).max(99).nullable() }),
  z.strictObject({ kind: z.literal('MATERIAL'), materialId: id }),
  z.strictObject({ kind: z.literal('HOMEWORK'), homeworkSessionId: id }),
]) satisfies z.ZodType<CoContext>

const capabilityNote = z.object({ available: z.boolean(), reason: lines(600).nullish().transform(value => value ?? null) }) satisfies z.ZodType<CoCapabilityNote, unknown>
const visibilityMode = z.enum(['FULL', 'SUMMARY'])
/** The snapshot is `{ mode }` in the context answer; a homework session may send the bare string. Both are read. */
const visibility = z.union([visibilityMode, z.object({ mode: visibilityMode })]).transform((value): { mode: ParentVisibilityMode } => typeof value === 'string' ? { mode: value } : { mode: value.mode })

export const coContextInfoSchema = z.object({
  available: z.boolean(), reason: lines(600).nullable(),
  source: z.object({ title: lines(300), materialId: id, link: linkSchema.nullable() }).nullable(),
  suggestions: z.array(lines(300)).max(8),
  openConversationId: id.nullable(),
  parentVisibility: visibility,
  voice: capabilityNote, photo: capabilityNote,
  hintsMax: z.number().int().min(0).max(3).transform(value => value as 0 | 1 | 2 | 3),
  band: band.nullish().transform(value => value ?? undefined),
}) satisfies z.ZodType<CoContextInfo, unknown>

export const coConversationSchema = z.object({
  id,
  kind: z.enum(['CHAT', 'HOMEWORK']).nullish().transform(value => value ?? null),
  context: coContextSchema.nullish().transform(value => value ?? null),
  title: lines(400).nullish().transform(value => value ?? ''),
  status: z.enum(['OPEN', 'CLOSED']).nullish().transform(value => value ?? null),
  // The history row names the count `turnCount` (or `count`).
  turnCount: count.nullish().transform(value => value ?? null),
  count: count.nullish(),
  lastTurnAt: iso.nullish().transform(value => value ?? null),
}).transform(({ count: alias, ...row }): CoConversation => ({ ...row, turnCount: row.turnCount ?? alias ?? null })) satisfies z.ZodType<CoConversation, unknown>
export const coConversationDetailSchema = z.object({
  conversation: coConversationSchema,
  turns: z.array(coTurnViewSchema).max(500),
  pending: coTurnViewSchema.nullable(),
}) satisfies z.ZodType<CoConversationDetail, unknown>
export const coOpenConversationSchema = z.object({ conversation: z.object({ id }) })
/** The history page; `items` is accepted as an alias of `conversations`. */
export const coHistorySchema = z.union([
  z.object({ conversations: z.array(coConversationSchema), nextCursor: z.string().max(1024).nullable() }),
  z.object({ items: z.array(coConversationSchema), nextCursor: z.string().max(1024).nullable() }),
]).transform((value): CoHistoryPage => ({ conversations: 'conversations' in value ? value.conversations : value.items, nextCursor: value.nextCursor }))
export const sendTurnResponseSchema = z.object({ turn: coTurnViewSchema })

const verdict = z.preprocess(value => typeof value === 'string' ? value.toLowerCase() : value, z.enum(finalVerdicts))
const homeworkStep = z.strictObject({ number: z.number().int().min(1).max(100), prompt: lines(2000), learnerResponse: lines(4000).nullable() }) satisfies z.ZodType<HomeworkStep>
const homeworkFinal = z.object({
  answer: lines(1000), verdict: verdict.nullish().transform(value => value ?? null), feedback: lines(3000).nullish().transform(value => value ?? null),
}) satisfies z.ZodType<HomeworkFinal, unknown>
const homeworkSession = z.object({
  id, phase: z.enum(homeworkPhases), stepNumber: count, hintLevel: z.number().int().min(0).max(3), hintsUsed: count,
  hintsMax: z.number().int().min(0).max(3),
  parentVisibility: visibility,
  problem: lines(2000),
  conversationId: id,
  // `finalAttempts` (and `hints`, below) may sit in the session object or at the top of the state; the detail schema settles that.
  finalAttempts: z.number().int().min(0).max(3).optional(),
  hints: z.array(z.unknown()).optional(),
  band: band.nullish().transform(value => value ?? null),
})
const hintServed = z.strictObject({ level: z.union([z.literal(1), z.literal(2), z.literal(3)]), text: lines(3000), stepNumber: z.number().int().min(1).max(100) }) satisfies z.ZodType<HomeworkHintServed>
export const homeworkListItemSchema = z.object({
  id, conversationId: id, phase: z.enum(homeworkPhases), problemPreview: lines(600), stepNumber: count, hintsUsed: count, startedAt: iso,
  finalVerdict: verdict.nullish().transform(value => value ?? null),
}) satisfies z.ZodType<HomeworkListItem, unknown>
export const homeworkListSchema = z.object({ items: z.array(homeworkListItemSchema).max(100), nextCursor: z.string().max(1024).nullable() }) satisfies z.ZodType<HomeworkListPage, unknown>
export const homeworkDetailSchema = z.preprocess((value, context) => {
  // The learner's own typed answer lives under `final.answer`; everything the coach wrote must be free of answer-key fields.
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const { final: _final, ...coached } = value as Record<string, unknown>
    void _final
    if (leaksAnswerKey(coached)) { context.addIssue({ code: 'custom', message: 'A homework payload must not contain an answer key or a solution.' }); return z.NEVER }
  }
  return value
}, z.object({
  session: homeworkSession,
  turns: z.array(coTurnViewSchema).max(500),
  pending: coTurnViewSchema.nullable(),
  steps: z.array(homeworkStep).max(100),
  restatement: lines(2000).nullable(),
  final: homeworkFinal.nullable(),
  hints: z.array(hintServed).max(300).optional(),
  finalAttempts: z.number().int().min(0).max(3).optional(),
}).transform((value, context): HomeworkDetail => {
  const { hints: _inner, finalAttempts: sessionAttempts, ...session } = value.session
  void _inner
  const hints = value.hints ?? z.array(hintServed).max(300).safeParse(value.session.hints).data
  const finalAttempts = value.finalAttempts ?? sessionAttempts
  if (hints === undefined) context.addIssue({ code: 'custom', message: 'The session state must list the hints served.', path: ['hints'] })
  if (finalAttempts === undefined) context.addIssue({ code: 'custom', message: 'The session state must carry finalAttempts.', path: ['finalAttempts'] })
  return { session: { ...session, finalAttempts: finalAttempts ?? 0 }, turns: value.turns, pending: value.pending, steps: value.steps, restatement: value.restatement, final: value.final, hints: hints ?? [] }
})) satisfies z.ZodType<HomeworkDetail, unknown>
/** Only the id is needed to move to the session page, so the create answer is read leniently (`{ session }` or the session itself). */
export const createHomeworkResponseSchema = z.union([
  z.object({ session: z.object({ id }) }),
  z.object({ id }),
]).transform((value): { id: string } => ({ id: 'session' in value ? value.session.id : value.id }))

/* ---------- request bodies (checked before they leave the browser) ---------- */

const clientId = z.string().min(8).max(64)
export const createHomeworkBodySchema = z.strictObject({
  problem: z.string().trim().min(1).max(1000), referenceMaterialId: id.optional(), clientSessionId: clientId,
}) satisfies z.ZodType<CreateHomeworkBody>
export const restatementBodySchema = z.strictObject({ clientTurnId: clientId, confirmed: z.boolean() }) satisfies z.ZodType<RestatementBody>
export const problemBodySchema = z.strictObject({ clientTurnId: clientId, problem: z.string().trim().min(1).max(1000) }) satisfies z.ZodType<ProblemBody>
export const stepBodySchema = z.strictObject({ clientTurnId: clientId, learnerResponse: z.string().trim().min(1).max(1000) }) satisfies z.ZodType<StepBody>
export const hintBodySchema = z.strictObject({ clientTurnId: clientId, level: z.union([z.literal(1), z.literal(2), z.literal(3)]) }) satisfies z.ZodType<HintBody>
export const finalBodySchema = z.strictObject({ clientTurnId: clientId, answerText: z.string().trim().min(1).max(200) }) satisfies z.ZodType<FinalBody>
export const sendTurnBodySchema = z.strictObject({
  // The platform accepts stepIndex 0..4 (a lesson has five steps) and a UUID clientTurnId.
  clientTurnId: clientId, text: z.string().trim().min(1).max(1000), style: z.enum(['SIMPLE', 'EXAM']).optional(), stepIndex: z.number().int().min(0).max(4).optional(),
}) satisfies z.ZodType<SendTurnBody>

/* ---------- pure helpers ---------- */

const resourceId = /^[a-zA-Z0-9_-]{1,128}$/
export const isCoId = (value: string | null | undefined): value is string => !!value && resourceId.test(value)

/** Backoff for polling a queued or running turn: 800 ms, 1.2 s, 1.6 s, 2 s ... capped at 4 s. */
export function pollDelay(attempt: number): number {
  return Math.min(4000, 800 + 400 * Math.max(0, Math.floor(attempt)))
}

/**
 * A client-generated UUID v4 for an idempotent request (turn, homework session). `crypto.randomUUID` needs a secure
 * context, so a plain fallback keeps the id unique on insecure development hosts.
 */
export function newClientId(): string {
  const c = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const bytes = new Uint8Array(16)
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes)
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Query string of the context call. Only the three allowlisted parameters, only valid values. */
export function contextQuery(query: CoContextQuery = {}): string {
  const params = new URLSearchParams()
  if (isCoId(query.lessonId)) params.set('lessonId', query.lessonId)
  if (isCoId(query.materialId)) params.set('materialId', query.materialId)
  if (typeof query.stepIndex === 'number' && Number.isInteger(query.stepIndex) && query.stepIndex >= 0 && query.stepIndex <= 4) params.set('stepIndex', String(query.stepIndex))
  const text = params.toString()
  return text ? `?${text}` : ''
}
export function historyQuery(cursor?: string | null, limit = 20): string {
  const params = new URLSearchParams({ limit: String(Math.min(50, Math.max(1, Math.floor(limit)))) })
  if (cursor) params.set('cursor', cursor)
  return params.toString()
}

/** A reply the server marked as a safety redirect: shown as a safety check, with the code-owned guidance, never as an answer. */
export const isSafetyReply = (reply: CoReply | null | undefined): boolean =>
  !!reply && (reply.disposition === 'SAFE_REDIRECT' || reply.disposition === 'TRUSTED_ADULT' || reply.safety.redirected)

const enc = encodeURIComponent
const conversation = (conversationId: string) => `/co/conversations/${enc(conversationId)}`
const sessionPath = (sessionId: string) => `/homework/sessions/${enc(sessionId)}`

export const coApi = {
  context: (query: CoContextQuery = {}) => learnRequest(`/co/context${contextQuery(query)}`, coContextInfoSchema),
  /** Idempotent get-or-create of the learner's OPEN conversation for a context. */
  openConversation: (context: CoContext) => learnRequest('/co/conversations', coOpenConversationSchema, 'POST', { context: coContextSchema.parse(context) }),
  history: (cursor?: string | null, limit?: number) => learnRequest(`/co/conversations?${historyQuery(cursor, limit)}`, coHistorySchema),
  conversation: (conversationId: string) => learnRequest(conversation(conversationId), coConversationDetailSchema),
  /** Idempotent by `clientTurnId`: the same body returns the same turn, a different body with the same id is a 409. */
  sendTurn: (conversationId: string, body: SendTurnBody) => learnRequest(`${conversation(conversationId)}/turns`, sendTurnResponseSchema, 'POST', sendTurnBodySchema.parse(body)),
  turn: (conversationId: string, turnId: string) => learnRequest(`${conversation(conversationId)}/turns/${enc(turnId)}`, sendTurnResponseSchema.or(coTurnViewSchema.transform(turn => ({ turn })))),
  /**
   * Ask Co chat only (a HOMEWORK conversation answers 409 HOMEWORK_CONVERSATION: use `homeworkApi.retry`). The platform makes a NEW
   * turn from the failed one and answers 202 with it, so the caller shows that turn, not the failed one.
   */
  retryTurn: (conversationId: string, turnId: string) => learnRequest(`${conversation(conversationId)}/turns/${enc(turnId)}/retry`, sendTurnResponseSchema, 'POST', {}),
  cancelTurn: (conversationId: string, turnId: string) => learnRequest(`${conversation(conversationId)}/turns/${enc(turnId)}/cancel`, sendTurnResponseSchema, 'POST', {}),
}

export const homeworkApi = {
  /** Idempotent per `clientSessionId`: a refresh or double press returns the same session. */
  create: (body: CreateHomeworkBody) => learnRequest('/homework/sessions', createHomeworkResponseSchema, 'POST', createHomeworkBodySchema.parse(body)),
  session: (sessionId: string) => learnRequest(sessionPath(sessionId), homeworkDetailSchema),
  /** Earlier sessions of the learner, newest first. */
  list: (cursor?: string | null, limit?: number) => learnRequest(`/homework/sessions?${historyQuery(cursor, limit)}`, homeworkListSchema),
  /** Idempotent by `clientTurnId`. `confirmed: false` only moves the session back to CAPTURE (no model call). */
  restatement: (sessionId: string, body: RestatementBody) => learnRequest(`${sessionPath(sessionId)}/restatement`, z.unknown(), 'POST', restatementBodySchema.parse(body)),
  /** In CAPTURE: replaces the problem text and queues a new restate turn. Idempotent by `clientTurnId`. */
  updateProblem: (sessionId: string, body: ProblemBody) => learnRequest(`${sessionPath(sessionId)}/problem`, z.unknown(), 'PUT', problemBodySchema.parse(body)),
  /** Ends a checked session (the platform also ends it when the answer is on track or after three tries). */
  finish: (sessionId: string) => learnRequest(`${sessionPath(sessionId)}/finish`, z.unknown(), 'POST', {}),
  /** Answer the current step; the same `clientTurnId` with the same body is the same turn. */
  step: (sessionId: string, body: StepBody) => learnRequest(`${sessionPath(sessionId)}/steps`, z.unknown(), 'POST', stepBodySchema.parse(body)),
  /** Hint rungs are asked for one at a time: `level` must be the current hint level plus one. */
  hint: (sessionId: string, body: HintBody) => learnRequest(`${sessionPath(sessionId)}/hint`, z.unknown(), 'POST', hintBodySchema.parse(body)),
  /** The learner's own answer, at most 200 characters. */
  final: (sessionId: string, body: FinalBody) => learnRequest(`${sessionPath(sessionId)}/final`, z.unknown(), 'POST', finalBodySchema.parse(body)),
  /** Moves from the steps to the learner's own final answer. */
  finalPhase: (sessionId: string) => learnRequest(`${sessionPath(sessionId)}/final-phase`, z.unknown(), 'POST', {}),
  abandon: (sessionId: string) => learnRequest(`${sessionPath(sessionId)}/abandon`, z.unknown(), 'POST', {}),
  /**
   * Ask Co again after the newest homework turn failed (HW_RESTATE, HW_STEP, HW_HINT or HW_CHECK). Idempotent: a repeat makes no second turn.
   * The shared `co/conversations/:id/turns/:turnId/retry` is for Ask Co chat only and refuses a homework conversation.
   */
  retry: (sessionId: string) => learnRequest(`${sessionPath(sessionId)}/retry`, z.unknown(), 'POST', {}),
}

export const homeworkRoutes = {
  home: '/learn/homework',
  session: (sessionId: string) => `/learn/homework/${enc(sessionId)}`,
}

export const coErrorCode = (error: unknown): string | undefined => {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : undefined
}
/** The learner-safe text is built in `learnErrorMessage`; this reads it off the error (server text only ever for POLICY_BLOCKED). */
export const coErrorMessage = (error: unknown, fallback = 'Co is unavailable right now. Please try again.'): string =>
  error instanceof Error && error.message ? error.message : fallback
