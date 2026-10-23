import { z } from 'zod'
import { pollDelay } from './co'
import { kidsMetricIssue } from './kids-metrics'
import { linkSchema, type ApiBand, type Link } from './learn'
import { learnRequest } from './learn-request'

/*
 * B11 teach-back contract (platform <-> web), 21 October 2026 (agents/contracts/B11-contracts.md).
 * The platform presenters were reconciled against these DTOs during B11; every schema
 * `satisfies` them. Voice is never a successful state: `available` is the literal false. A turn that is not READY
 * never carries reply text. Kids payloads are refused when they carry a percentage or a failure count.
 *
 * Reconciled transport: GET session returns `{ session, turns, pending, result }`,
 * POST sessions returns `{ session: { id } }` or `{ id }`, and POST turns returns `{ turn }` (202).
 */

export type TeachBand = ApiBand
export type TeachPhase = 'PROMPT' | 'EXPLAIN' | 'FOLLOW_UP' | 'FEEDBACK' | 'FAILED'
export const teachPhases = ['PROMPT', 'EXPLAIN', 'FOLLOW_UP', 'FEEDBACK', 'FAILED'] as const satisfies readonly TeachPhase[]
export type TeachTurnStatus = 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED' | 'CANCELLED'
export const teachTurnStatuses = ['QUEUED', 'RUNNING', 'READY', 'FAILED', 'CANCELLED'] as const satisfies readonly TeachTurnStatus[]
export type TeachTurnKind = 'EXPLAIN' | 'FOLLOW_UP'
export type TeachDisposition = 'LEARNING' | 'CLARIFY' | 'SAFE_REDIRECT' | 'TRUSTED_ADULT'
export const teachDispositions = ['LEARNING', 'CLARIFY', 'SAFE_REDIRECT', 'TRUSTED_ADULT'] as const satisfies readonly TeachDisposition[]
export type EffortLabel = 'TAUGHT_IT'

export interface TeachVoice { available: false; reason: string }
export interface TeachSource { title: string; materialId: string; link: Link | null }
export interface TeachConcept { title: string; keyPoints: string[]; source: TeachSource }
export interface TeachContext {
  available: boolean
  reason: string | null
  band: TeachBand
  voice: TeachVoice
  concept: TeachConcept | null
  openSessionId: string | null
  /** Code-owned tap prompts. When absent, the concept key points are the taps. */
  prompts: string[]
}
export interface TeachCitation { label: string; anchorRef: string; quote: string; link: Link | null }
export interface TeachMisconception { text: string; sourceLabel: string }
export interface TeachReply {
  text: string
  assistantKind: 'ai' | null
  disposition: TeachDisposition
  followUp: string | null
  covered: string[]
  missing: string[]
  misconceptions: TeachMisconception[]
  examTip: string | null
  citations: TeachCitation[]
  reasonCodes: string[]
  safety: { redirected: boolean; reasonCodes: string[]; guidance: string | null }
  generatedBy: { kind: 'AI'; packVersion: string; promptRelease: string } | { kind: 'CODE' }
}
export interface TeachTurn {
  id: string
  ordinal: number
  clientTurnId: string
  kind: TeachTurnKind
  learnerText: string
  status: TeachTurnStatus
  createdAt: string
  reply: TeachReply | null
  failure: { code: string; retryable: boolean } | null
}
export interface TeachSession {
  id: string
  band: TeachBand
  phase: TeachPhase
  status: string
  voiceAvailable: false
  /** The server's reason voice cannot be used. There is no recording control. */
  voiceReason: string
  conceptTitle: string
  keyPoints: string[]
  practiceSessionId: string | null
  materialId: string
  source: { title: string; link: Link | null } | null
}
export interface TeachResult {
  covered: string[]
  missing: string[]
  misconceptions: TeachMisconception[]
  examTip: string | null
  effortLabel: EffortLabel | null
  packVersion: string
  promptRelease: string
  traceId: string | null
  /** Where to practise what was missed. Null means there is no link to show. */
  practice: Link | null
}
export interface TeachDetail { session: TeachSession; turns: TeachTurn[]; pending: TeachTurn | null; result: TeachResult | null }
export interface TeachContextQuery { practiceSessionId?: string | null; materialId?: string | null }
export interface CreateTeachBody { clientSessionId: string; practiceSessionId?: string; materialId?: string }
export interface TeachTurnBody { clientTurnId: string; text: string }

const id = z.string().min(1).max(256)
const iso = z.string().min(1)
const lines = (max: number) => z.string().max(max)
const band = z.enum(['6-9', '10-13', '14-17'])
const resourceId = /^[a-zA-Z0-9_-]{1,128}$/

const voiceSchema = z.strictObject({
  available: z.literal(false),
  reason: lines(400),
}) satisfies z.ZodType<TeachVoice>
const sourceSchema = z.strictObject({
  title: lines(300), materialId: id, link: linkSchema.nullable(),
}) satisfies z.ZodType<TeachSource>
const conceptSchema = z.strictObject({
  title: lines(200),
  keyPoints: z.array(lines(160)).min(1).max(6),
  source: sourceSchema,
}) satisfies z.ZodType<TeachConcept>

export const teachContextSchema = z.strictObject({
  available: z.boolean(),
  reason: lines(600).nullable(),
  band,
  voice: voiceSchema,
  concept: conceptSchema.nullable(),
  openSessionId: id.nullable(),
  prompts: z.array(lines(160)).max(6).optional().transform(value => value ?? []),
}).superRefine((value, context) => {
  if (value.band === '6-9') {
    const issue = kidsMetricIssue(value)
    if (issue) context.addIssue({ code: 'custom', message: issue })
  }
  if (value.available && !value.concept) context.addIssue({ code: 'custom', message: 'An available teach-back includes the concept.', path: ['concept'] })
}) satisfies z.ZodType<TeachContext>

const citationSchema = z.strictObject({
  label: lines(120), anchorRef: id, quote: lines(2000), link: linkSchema.nullable(),
}) satisfies z.ZodType<TeachCitation>
const misconceptionSchema = z.strictObject({ text: lines(400), sourceLabel: lines(120) }) satisfies z.ZodType<TeachMisconception>
const safetySchema = z.strictObject({
  redirected: z.boolean(),
  reasonCodes: z.array(z.string().min(1).max(64)).max(10),
  guidance: lines(3000).nullable(),
})

const replyBody = z.strictObject({
  text: lines(6000),
  assistantKind: z.literal('ai').nullable(),
  disposition: z.enum(teachDispositions),
  followUp: lines(400).nullable(),
  covered: z.array(lines(160)).max(6),
  missing: z.array(lines(160)).max(6),
  misconceptions: z.array(misconceptionSchema).max(3),
  examTip: lines(400).nullable(),
  citations: z.array(citationSchema).max(8),
  reasonCodes: z.array(z.string().min(1).max(64)).max(12),
  safety: safetySchema,
  generatedBy: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('AI'), packVersion: z.string().min(1).max(64), promptRelease: z.string().min(1).max(128) }),
    z.strictObject({ kind: z.literal('CODE') }),
  ]),
}).superRefine((value, context) => {
  const learning = value.disposition === 'LEARNING'
  if (!learning && (value.covered.length > 0 || value.missing.length > 0 || value.followUp !== null)) {
    context.addIssue({ code: 'custom', message: 'A safety outcome has no coverage and no follow-up.' })
  }
  if (value.generatedBy.kind === 'AI' && value.assistantKind !== 'ai') context.addIssue({ code: 'custom', message: 'An AI reply is labelled ai.', path: ['assistantKind'] })
  if (value.generatedBy.kind === 'CODE' && value.assistantKind !== null) context.addIssue({ code: 'custom', message: 'A code-owned reply is not labelled as model text.', path: ['assistantKind'] })
})
export const teachReplySchema = replyBody satisfies z.ZodType<TeachReply>

const failureSchema = z.strictObject({ code: z.string().min(1).max(64), retryable: z.boolean() })
export const teachTurnSchema = z.strictObject({
  id, ordinal: z.number().int().nonnegative(), clientTurnId: id, kind: z.enum(['EXPLAIN', 'FOLLOW_UP']),
  learnerText: lines(1000), status: z.enum(teachTurnStatuses), createdAt: iso,
  reply: teachReplySchema.nullable(),
  failure: failureSchema.nullable(),
}).superRefine((value, context) => {
  if (value.status !== 'READY' && value.reply !== null) context.addIssue({ code: 'custom', message: 'Only a READY turn carries a reply.', path: ['reply'] })
  if (value.status === 'READY' && value.reply === null) context.addIssue({ code: 'custom', message: 'A READY turn carries a reply.', path: ['reply'] })
}) satisfies z.ZodType<TeachTurn>

const sessionSchema = z.strictObject({
  id, band, phase: z.enum(teachPhases), status: z.string().min(1).max(32),
  voiceAvailable: z.literal(false),
  voiceReason: lines(400),
  conceptTitle: lines(200),
  keyPoints: z.array(lines(160)).min(1).max(6),
  practiceSessionId: id.nullable(),
  materialId: id,
  source: z.strictObject({ title: lines(300), link: linkSchema.nullable() }).nullable(),
}) satisfies z.ZodType<TeachSession>

export const teachResultSchema = z.strictObject({
  covered: z.array(lines(160)).max(6),
  missing: z.array(lines(160)).max(6),
  misconceptions: z.array(misconceptionSchema).max(3),
  examTip: lines(400).nullable(),
  effortLabel: z.literal('TAUGHT_IT').nullable(),
  packVersion: z.string().min(1).max(64),
  promptRelease: z.string().min(1).max(128),
  traceId: z.string().min(1).max(128).nullable(),
  practice: linkSchema.nullable(),
}).superRefine((value, context) => {
  if (value.effortLabel === 'TAUGHT_IT' && value.missing.length > 0) context.addIssue({ code: 'custom', message: 'Taught it requires a complete rubric.', path: ['effortLabel'] })
}) satisfies z.ZodType<TeachResult>

export const teachDetailSchema = z.strictObject({
  session: sessionSchema,
  turns: z.array(teachTurnSchema).max(8),
  pending: teachTurnSchema.nullable(),
  result: teachResultSchema.nullable(),
}).superRefine((value, context) => {
  if (value.session.band !== '14-17' && (value.result?.examTip || value.turns.some(turn => turn.reply?.examTip))) {
    context.addIssue({ code: 'custom', message: 'An exam tip is only for ages 14-17.' })
  }
  if (value.session.band === '6-9') {
    const issue = kidsMetricIssue(value)
    if (issue) context.addIssue({ code: 'custom', message: issue })
  }
  const points = value.session.keyPoints
  const completeRubric = (covered: string[], missing: string[]) => {
    const all = [...covered, ...missing]
    return all.length === points.length && new Set(all).size === points.length && all.every(point => points.includes(point))
  }
  if (value.result && !completeRubric(value.result.covered, value.result.missing)) context.addIssue({ code: 'custom', message: 'Saved coverage must partition the supplied rubric exactly.' })
  for (const turn of value.turns) {
    if (turn.reply?.disposition === 'LEARNING' && !completeRubric(turn.reply.covered, turn.reply.missing)) context.addIssue({ code: 'custom', message: 'Coverage must partition the supplied rubric exactly.' })
    if (turn.kind === 'FOLLOW_UP' && turn.reply?.followUp) context.addIssue({ code: 'custom', message: 'Only EXPLAIN may ask a follow-up.' })
  }
  if (value.session.phase === 'FEEDBACK' && value.result === null) context.addIssue({ code: 'custom', message: 'Feedback includes a saved result.', path: ['result'] })
}) satisfies z.ZodType<TeachDetail>

const createdSchema = z.union([
  z.object({ session: z.object({ id }) }),
  z.object({ id }),
]).transform((value): { id: string } => ({ id: 'session' in value ? value.session.id : value.id }))

export const teachTurnResponseSchema = z.union([
  z.object({ turn: teachTurnSchema }).transform(value => value.turn),
  teachTurnSchema,
])

const clientId = z.string().min(8).max(64)
export const createTeachBodySchema = z.strictObject({
  clientSessionId: clientId,
  practiceSessionId: id.optional(),
  materialId: id.optional(),
}).refine(value => value.practiceSessionId || value.materialId, { message: 'A teach-back needs a practice session or a material.' }) satisfies z.ZodType<CreateTeachBody>
export const teachTurnBodySchema = z.strictObject({
  clientTurnId: clientId,
  text: z.string().trim().min(1).max(1000),
}) satisfies z.ZodType<TeachTurnBody>

export const isTeachId = (value: string | null | undefined): value is string => !!value && resourceId.test(value)

/** Same backoff as Ask Co: 800 ms, 1.2 s, 1.6 s, then 400 ms steps capped at 4 s. */
export function teachPollDelay(attempt: number, baseMs = 800): number {
  return Math.max(1, Math.round(pollDelay(attempt) * baseMs / 800))
}

export function teachContextQuery(query: TeachContextQuery = {}): string {
  const params = new URLSearchParams()
  if (isTeachId(query.practiceSessionId)) params.set('practiceSessionId', query.practiceSessionId)
  if (isTeachId(query.materialId)) params.set('materialId', query.materialId)
  const text = params.toString()
  return text ? `?${text}` : ''
}

const enc = encodeURIComponent
const sessionPath = (sessionId: string) => `/teach/sessions/${enc(sessionId)}`

export const teachApi = {
  context: (query: TeachContextQuery = {}) => learnRequest(`/teach/context${teachContextQuery(query)}`, teachContextSchema),
  create: (body: CreateTeachBody) => learnRequest('/teach/sessions', createdSchema, 'POST', createTeachBodySchema.parse(body)),
  session: (sessionId: string) => learnRequest(sessionPath(sessionId), teachDetailSchema),
  sendTurn: (sessionId: string, body: TeachTurnBody) => learnRequest(`${sessionPath(sessionId)}/turns`, teachTurnResponseSchema, 'POST', teachTurnBodySchema.parse(body)),
  turn: (sessionId: string, turnId: string) => learnRequest(`${sessionPath(sessionId)}/turns/${enc(turnId)}`, teachTurnResponseSchema),
}

export const teachRoutes = {
  home: '/learn/teach',
  start: (practiceSessionId: string) => `/learn/teach?practiceSessionId=${enc(practiceSessionId)}`,
  session: (sessionId: string) => `/learn/teach/${enc(sessionId)}`,
}

export const isTerminalTeachTurn = (turn: TeachTurn) => turn.status === 'READY' || turn.status === 'FAILED' || turn.status === 'CANCELLED'
