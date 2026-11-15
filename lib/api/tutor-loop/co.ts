import { z } from 'zod'
import { LearnApiError, LearnSessionError } from '@/lib/api/learn-request'
import { isTutorLoopApiError, tutorLoopRequest } from '@/lib/api/tutor-loop/client'
import {
  tutorContextDescriptorSchema,
  tutorContextToQuery,
  tutorModes,
  type TutorContextDescriptor,
  type TutorMode,
} from '@/lib/tutor-loop/open-tutor'

export const tutorMoves = [
  'DIAGNOSE',
  'EXPLAIN',
  'RE_EXPLAIN',
  'HINT',
  'WORKED_EXAMPLE',
  'CHECK',
  'RETRIEVE',
  'TEACH_BACK',
  'CORRECT_MISCONCEPTION',
  'PLAN',
  'ENCOURAGE',
  'REDIRECT',
] as const

export type TutorMove = (typeof tutorMoves)[number]

export const tutorDispositions = ['TEACH', 'REDIRECT', 'TRUSTED_ADULT', 'CLARIFY'] as const
export type TutorDisposition = (typeof tutorDispositions)[number]

export const tutorTurnStatuses = ['QUEUED', 'CHECKING', 'READY', 'FAILED', 'CANCELLED'] as const
export type TutorTurnStatus = (typeof tutorTurnStatuses)[number]

export const tutorReasonCodes = [
  'LEARNER_ASKED',
  'RECENT_MISTAKE',
  'DUE_REVIEW',
  'EXAM_NEAR',
  'LESSON_DONE',
  'TOPIC_SECURE',
  'MATERIAL_MATCH',
  'ON_SCHEDULE',
  'TEACHER_DUE',
  'LOW_TIME',
  'RETURNED',
  'STUCK',
  'GOAL_LINKED',
] as const

export type TutorReasonCode = (typeof tutorReasonCodes)[number]

export const tutorNudgeKinds = [
  'FIRST_WRONG',
  'REPEATED_WRONG',
  'LESSON_DONE',
  'RETURNED',
  'EXAM_NEAR',
  'READINESS_CHANGED',
  'STUCK',
] as const

export type TutorNudgeKind = (typeof tutorNudgeKinds)[number]

export const tutorGroundingModes = ['MATERIAL_ONLY', 'GENERAL_ALLOWED'] as const
export type TutorGroundingMode = (typeof tutorGroundingModes)[number]

export const tutorFindMaterialStates = ['HIDDEN', 'LOCKED', 'UNAVAILABLE', 'AVAILABLE'] as const
export type TutorFindMaterialState = (typeof tutorFindMaterialStates)[number]

export interface TutorSourceCitation {
  materialId?: string | null
  sourceVersionRef?: string | null
  passageRef: string
  quote: string
  label?: string | null
}

export type TutorTurnSegment =
  | {
      source: 'MATERIAL'
      text: string
      citation: TutorSourceCitation
    }
  | {
      source: 'GENERAL'
      text: string
    }
  | {
      source: 'CO'
      text: string
    }

export interface TutorCheckQuestionOption {
  id: string
  text: string
}

export interface TutorCheckQuestion {
  questionRef: string
  prompt?: string | null
  kind?: 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'ORDERING' | 'CLOZE' | null
  options?: TutorCheckQuestionOption[]
}

export interface TutorBriefSection {
  heading: string
  points: string[]
  citations?: TutorSourceCitation[]
}

export interface TutorBrief {
  title: string
  sections: TutorBriefSection[]
  workedExample: string
  selfChecks: string[]
  citations: TutorSourceCitation[]
}

export interface TutorActionTarget {
  kind: string
  targetId: string | null
  label: string
  minutes: number
  reasonCodes: string[]
}

export interface TutorProposalCard {
  id: string
  kind: string
  optionRef?: string | null
  target: TutorActionTarget
  alternative?: TutorActionTarget | null
  expiresAt?: string | null
}

export interface TutorTurnResult {
  move: TutorMove
  segments: TutorTurnSegment[]
  question: TutorCheckQuestion | null
  brief: TutorBrief | null
  proposals: TutorProposalCard[]
  reasonCodes: string[]
  disposition: TutorDisposition
  hintRung?: number | null
  maxHintRungs?: number | null
}

export interface TutorTurn {
  id: string
  sessionId: string
  status: TutorTurnStatus
  learnerText?: string | null
  mode?: TutorMode | null
  result: TutorTurnResult | null
  reasonCode: string | null
  retryable: boolean
  createdAt: string
}

export interface TutorRecapSummary {
  summary: string
  topicRef?: string | null
  topicTitle?: string | null
  sessionId?: string | null
}

export interface TutorContextResponse {
  context: TutorContextDescriptor
  available: boolean
  reasonCode: string | null
  subjectRef: string | null
  topicRef: string | null
  source: {
    materialId: string
    title: string
    passageRef?: string | null
    quote?: string | null
  } | null
  suggestions: string[]
  returnTo: TutorContextDescriptor | null
  groundingMode: TutorGroundingMode
  recap?: TutorRecapSummary | null
  activeExamSessionId?: string | null
}

export interface TutorSessionSummaryItem {
  id: string
  title: string
  subjectRef: string | null
  topicRef: string | null
  status: 'OPEN' | 'CLOSED'
  mode: TutorMode
  lastTurnAt: string | null
  expiresAt: string | null
}

export interface TutorSessionListResponse {
  items: TutorSessionSummaryItem[]
  nextCursor: string | null
}

export interface TutorSessionDetail extends TutorSessionSummaryItem {
  turns: TutorTurn[]
  nextCursor: string | null
}

export type TutorObjectiveAnswer =
  | { kind: 'MCQ'; optionId: string }
  | { kind: 'TRUE_FALSE'; value: boolean }
  | { kind: 'CLOZE'; blanks: Array<{ blankId: string; value: string }> }
  | { kind: 'ORDERING'; order: string[] }
  | { kind: 'SHORT_ANSWER'; text: string }

export interface TutorCheckResponseInput {
  turnId: string
  questionRef: string
  answer: TutorObjectiveAnswer
}

export interface CreateTutorSessionInput {
  clientRequestId: string
  context: TutorContextDescriptor
  mode: TutorMode
}

export interface CreateTutorTurnInput {
  clientRequestId: string
  text: string
  mode?: TutorMode
  checkResponse?: TutorCheckResponseInput
}

export interface TutorProposalAcceptedResponse {
  id: string
  kind: string
  target: TutorActionTarget
  acceptedAt: string
}

export interface TutorNudgeItem {
  id: string
  kind: TutorNudgeKind
  text: string
  reasonCodes: string[]
  action: TutorActionTarget
  alternative: TutorActionTarget | null
  expiresAt: string
}

export interface TutorNudgeListResponse {
  items: TutorNudgeItem[]
}

export interface TutorNudgeMuteResponse {
  kind: TutorNudgeKind
  muted: boolean
}

export interface TutorFindMaterialInput {
  clientRequestId: string
  topicId: string
  query?: string
}

export interface TutorMaterialProposalItem {
  id: string
  title: string
  publisher: string
  host: string
  expiresAt: string
}

export interface TutorMaterialProposalsResponse {
  items: TutorMaterialProposalItem[]
}

export interface TutorMaterialAddedResponse {
  materialId: string
  jobId: string
  status: string
  attribution: {
    publisher: string
    host: string
    addedByTutor: boolean
  }
}

/* ---------- Zod schemas ---------- */

const sourceCitationSchema: z.ZodType<TutorSourceCitation> = z.object({
  materialId: z.string().nullable().optional(),
  sourceVersionRef: z.string().nullable().optional(),
  passageRef: z.string().min(1),
  quote: z.string(),
  label: z.string().nullable().optional(),
})

const segmentSchema: z.ZodType<TutorTurnSegment> = z.discriminatedUnion('source', [
  z.object({
    source: z.literal('MATERIAL'),
    text: z.string(),
    citation: sourceCitationSchema,
  }),
  z.object({
    source: z.literal('GENERAL'),
    text: z.string(),
  }),
  z.object({
    source: z.literal('CO'),
    text: z.string(),
  }),
])

const checkQuestionSchema: z.ZodType<TutorCheckQuestion> = z.object({
  questionRef: z.string().min(1),
  prompt: z.string().nullable().optional(),
  kind: z.enum(['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER', 'ORDERING', 'CLOZE']).nullable().optional(),
  options: z
    .array(
      z.object({
        id: z.string().min(1),
        text: z.string(),
      }),
    )
    .optional(),
})

const rawBriefSectionSchema = z.object({
  heading: z.string().optional(),
  h: z.string().optional(),
  points: z.array(z.union([z.string(), z.object({ text: z.string() })])).optional(),
  keyPoints: z.array(z.string()).optional(),
  pts: z.array(z.union([z.string(), z.object({ t: z.string() })])).optional(),
  citations: z.array(sourceCitationSchema).optional(),
})

const briefSchema: z.ZodType<TutorBrief> = z
  .object({
    title: z.string().default('Study brief'),
    sections: z.array(rawBriefSectionSchema).optional(),
    headings: z.array(rawBriefSectionSchema).optional(),
    workedExample: z
      .union([z.string(), z.object({ text: z.string() })])
      .optional(),
    ex: z.string().optional(),
    selfChecks: z.array(z.union([z.string(), z.object({ text: z.string() })])).optional(),
    checks: z.array(z.union([z.string(), z.object({ t: z.string() })])).optional(),
    citations: z.array(sourceCitationSchema).optional(),
  })
  .transform((raw): TutorBrief => {
    const rawSections = raw.sections ?? raw.headings ?? []
    const sections: TutorBriefSection[] = rawSections.map(sec => {
      const heading = sec.heading ?? sec.h ?? 'Key points'
      const rawPoints = sec.points ?? sec.keyPoints ?? sec.pts ?? []
      const points = rawPoints.map(pt => {
        if (typeof pt === 'string') return pt
        if ('text' in pt) return pt.text
        return pt.t
      })
      return {
        heading,
        points,
        ...(sec.citations ? { citations: sec.citations } : {}),
      }
    })
    const workedExample =
      typeof raw.workedExample === 'string'
        ? raw.workedExample
        : raw.workedExample && typeof raw.workedExample === 'object'
          ? raw.workedExample.text
          : (raw.ex ?? '')
    const rawChecks = raw.selfChecks ?? raw.checks ?? []
    const selfChecks = rawChecks.map(ck => {
      if (typeof ck === 'string') return ck
      if ('text' in ck) return ck.text
      return ck.t
    })
    return {
      title: raw.title,
      sections,
      workedExample,
      selfChecks,
      citations: raw.citations ?? [],
    }
  })

const actionTargetSchema: z.ZodType<TutorActionTarget> = z.object({
  kind: z.string().min(1),
  targetId: z.string().nullable().default(null),
  label: z.string(),
  minutes: z.number().int().min(0).default(0),
  reasonCodes: z.array(z.string()).default([]),
})

const proposalCardSchema: z.ZodType<TutorProposalCard> = z
  .object({
    id: z.string().optional(),
    proposalId: z.string().optional(),
    optionRef: z.string().nullable().optional(),
    kind: z.string().min(1),
    target: actionTargetSchema.optional(),
    label: z.string().optional(),
    targetId: z.string().nullable().optional(),
    minutes: z.number().int().min(0).optional(),
    reasonCodes: z.array(z.string()).optional(),
    alternative: actionTargetSchema.nullable().optional(),
    expiresAt: z.string().nullable().optional(),
  })
  .transform((raw): TutorProposalCard => {
    const id = raw.id ?? raw.proposalId ?? raw.optionRef ?? 'proposal-1'
    const target: TutorActionTarget = raw.target ?? {
      kind: raw.kind,
      targetId: raw.targetId ?? null,
      label: raw.label ?? 'Suggested next step',
      minutes: raw.minutes ?? 10,
      reasonCodes: raw.reasonCodes ?? [],
    }
    return {
      id,
      kind: raw.kind,
      optionRef: raw.optionRef ?? null,
      target,
      alternative: raw.alternative ?? null,
      expiresAt: raw.expiresAt ?? null,
    }
  })

export const tutorTurnResultSchema: z.ZodType<TutorTurnResult> = z.object({
  move: z.enum(tutorMoves),
  segments: z.array(segmentSchema),
  question: checkQuestionSchema.nullable().default(null),
  brief: briefSchema.nullable().default(null),
  proposals: z.array(proposalCardSchema).default([]),
  reasonCodes: z.array(z.string()).default([]),
  disposition: z.enum(tutorDispositions),
  hintRung: z.number().int().min(1).max(4).nullable().optional(),
  maxHintRungs: z.number().int().min(1).max(4).nullable().optional(),
})


// ---------------------------------------------------------------------------------------------------------------------
// R1 wire adapters. The platform's Co routes (P4) answer with slightly different keys than the contract fixtures W3 coded
// against (`reply.output` for `result`, `history.items` for `turns`, no `title`, a flat context). These adapters accept
// both shapes so neither side has to change; unknown shapes fall through to the strict schema and fail loudly there.
type Raw = Record<string, unknown>
const isRaw = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)
/** Redirect, clarify and trusted-adult replies are code-owned text with no model output; show them as one Co segment. */
const codeOwnedResult = (reply: Raw | null, turn: Raw): unknown => {
  if (!reply || typeof reply.text !== 'string' || reply.text.length === 0 || turn.status !== 'READY') return null
  const fallback = String(reply.fallback ?? '')
  return {
    move: fallback.includes('ADULT') ? 'ENCOURAGE' : 'DIAGNOSE',
    segments: [{ source: 'CO', text: reply.text, citation: null }],
    question: null, brief: null, proposals: [], reasonCodes: [],
    disposition: fallback.includes('ADULT') ? 'TRUSTED_ADULT' : fallback.includes('CLARIFY') ? 'CLARIFY' : 'REDIRECT',
  }
}
const adaptTurn = (raw: unknown, sessionId?: string): unknown => {
  if (!isRaw(raw)) return raw
  const reply = isRaw(raw.reply) ? raw.reply : null
  const withheld = typeof raw.withheld === 'string' ? raw.withheld : null
  return {
    ...raw,
    id: raw.id ?? raw.turnId,
    sessionId: raw.sessionId ?? sessionId ?? 'session',
    createdAt: raw.createdAt ?? new Date(0).toISOString(),
    result: raw.result !== undefined ? raw.result : withheld ? null : isRaw(reply?.output) ? reply.output : codeOwnedResult(reply, raw),
    reasonCode: raw.reasonCode ?? withheld,
    ...(withheld && raw.status === 'READY' ? { status: 'FAILED', retryable: false } : {}),
  }
}
const adaptSessionItem = (raw: unknown): unknown => (isRaw(raw) ? { ...raw, title: raw.title ?? (raw.topicRef ? 'Topic chat' : 'Chat with Co') } : raw)
const adaptSession = (raw: unknown): unknown => {
  if (!isRaw(raw)) return raw
  const history = isRaw(raw.history) ? raw.history : null
  const items = history && Array.isArray(history.items) ? (history.items as Raw[]) : null
  const turns = raw.turns ?? (items ? [...items].sort((a, b) => Number(a.ordinal ?? 0) - Number(b.ordinal ?? 0)).map((t) => adaptTurn(t, String(raw.id))) : undefined)
  return { ...(adaptSessionItem(raw) as Raw), turns, nextCursor: raw.nextCursor ?? history?.nextCursor ?? null }
}
const adaptContext = (raw: unknown): unknown => {
  if (!isRaw(raw) || raw.context !== undefined || typeof raw.kind !== 'string') return raw
  const returnTo = isRaw(raw.returnTo) ? raw.returnTo : { kind: raw.kind }
  return { context: returnTo, available: true, reasonCode: null, subjectRef: raw.subjectRef ?? null, topicRef: raw.topicRef ?? null, source: null, suggestions: [], returnTo }
}

const tutorTurnStrict: z.ZodType<TutorTurn> = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  status: z.enum(tutorTurnStatuses),
  learnerText: z.string().nullable().optional(),
  mode: z.enum(tutorModes).nullable().optional(),
  result: tutorTurnResultSchema.nullable().default(null),
  reasonCode: z.string().nullable().default(null),
  retryable: z.boolean().default(false),
  createdAt: z.string(),
})
export const tutorTurnSchema = z.preprocess((v) => adaptTurn(v), tutorTurnStrict) as unknown as z.ZodType<TutorTurn>

const tutorContextStrict: z.ZodType<TutorContextResponse> = z.object({
  context: tutorContextDescriptorSchema,
  available: z.boolean(),
  reasonCode: z.string().nullable().default(null),
  subjectRef: z.string().nullable().default(null),
  topicRef: z.string().nullable().default(null),
  source: z
    .object({
      materialId: z.string().min(1),
      title: z.string(),
      passageRef: z.string().nullable().optional(),
      quote: z.string().nullable().optional(),
    })
    .nullable()
    .default(null),
  suggestions: z.array(z.string()).default([]),
  returnTo: tutorContextDescriptorSchema.nullable().default(null),
  groundingMode: z.enum(tutorGroundingModes).default('MATERIAL_ONLY'),
  recap: z
    .object({
      summary: z.string(),
      topicRef: z.string().nullable().optional(),
      topicTitle: z.string().nullable().optional(),
      sessionId: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  activeExamSessionId: z.string().nullable().optional(),
})
export const tutorContextResponseSchema = z.preprocess(adaptContext, tutorContextStrict) as unknown as z.ZodType<TutorContextResponse>

const sessionSummarySchema: z.ZodType<TutorSessionSummaryItem> = z.object({
  id: z.string().min(1),
  title: z.string(),
  subjectRef: z.string().nullable().default(null),
  topicRef: z.string().nullable().default(null),
  status: z.enum(['OPEN', 'CLOSED']),
  mode: z.enum(tutorModes),
  lastTurnAt: z.string().nullable().default(null),
  expiresAt: z.string().nullable().default(null),
})

const tutorSessionListStrict: z.ZodType<TutorSessionListResponse> = z.object({
  items: z.array(sessionSummarySchema),
  nextCursor: z.string().nullable().default(null),
})
export const tutorSessionListSchema = z.preprocess(
  (v) => (isRaw(v) && Array.isArray(v.items) ? { ...v, items: v.items.map(adaptSessionItem) } : v),
  tutorSessionListStrict,
) as unknown as z.ZodType<TutorSessionListResponse>

const tutorSessionDetailStrict: z.ZodType<TutorSessionDetail> = z.object({
  id: z.string().min(1),
  title: z.string(),
  subjectRef: z.string().nullable().default(null),
  topicRef: z.string().nullable().default(null),
  status: z.enum(['OPEN', 'CLOSED']),
  mode: z.enum(tutorModes),
  lastTurnAt: z.string().nullable().default(null),
  expiresAt: z.string().nullable().default(null),
  turns: z.array(tutorTurnSchema).default([]),
  nextCursor: z.string().nullable().default(null),
})
export const tutorSessionDetailSchema = z.preprocess(adaptSession, tutorSessionDetailStrict) as unknown as z.ZodType<TutorSessionDetail>

const removedSchema = z.object({
  removed: z.boolean(),
})

export const proposalAcceptedSchema: z.ZodType<TutorProposalAcceptedResponse> = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  target: actionTargetSchema,
  acceptedAt: z.string(),
})

export const nudgeItemSchema: z.ZodType<TutorNudgeItem> = z.object({
  id: z.string().min(1),
  kind: z.enum(tutorNudgeKinds),
  text: z.string(),
  reasonCodes: z.array(z.string()).default([]),
  action: actionTargetSchema,
  alternative: actionTargetSchema.nullable().default(null),
  expiresAt: z.string(),
})

export const nudgeListSchema: z.ZodType<TutorNudgeListResponse> = z.object({
  items: z.array(nudgeItemSchema),
})

const dismissedSchema = z.object({
  dismissed: z.boolean(),
})

export const nudgeMuteSchema: z.ZodType<TutorNudgeMuteResponse> = z.object({
  kind: z.enum(tutorNudgeKinds),
  muted: z.boolean(),
})

export const materialProposalsSchema: z.ZodType<TutorMaterialProposalsResponse> = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string(),
      publisher: z.string(),
      host: z.string(),
      expiresAt: z.string(),
    }),
  ),
})

export const materialAddedSchema: z.ZodType<TutorMaterialAddedResponse> = z.object({
  materialId: z.string().min(1),
  jobId: z.string().min(1),
  status: z.string(),
  attribution: z.object({
    publisher: z.string(),
    host: z.string(),
    addedByTutor: z.boolean(),
  }),
})

/* ---------- Error handling & transport ---------- */

const tutorMessagesByCode: Record<string, string> = {
  RESOURCE_NOT_FOUND: 'We could not find this item.',
  EXAM_CONDITIONS_ACTIVE: 'Your tutor is available after the exam.',
  PREVIEW_STALE: 'Your schedule has changed. Preview the move again.',
  TUTOR_RESTING: 'Your tutor is resting. Try again soon.',
  AI_UNAVAILABLE: 'Your tutor is resting. Try again soon.',
  FIND_MATERIAL_NOT_ENTITLED: 'Finding material is available with Plus.',
  GENERAL_DISABLED: 'Your tutor can answer from your material.',
  DAILY_TUTOR_LIMIT: 'Your tutor is available again tomorrow.',
  TURN_PENDING: 'Your tutor is still working on your last message.',
  CONVERSATION_CLOSED: 'This session is closed. Start a new session to continue.',
  NOT_RETRYABLE: 'This turn cannot be retried.',
  NOT_CANCELLABLE: 'This turn can no longer be cancelled.',
  INSUFFICIENT_MATERIAL: 'Add material for this topic so your tutor can ground its answer.',
  TUTOR_NOT_ENABLED: 'Your tutor is not enabled for this workspace yet.',
  CONSENT_REQUIRED: 'Consent is required before using the tutor.',
}

const tutorStatusMessages: Record<number, string> = {
  400: 'Check what you entered and try again.',
  401: 'Your learning session has ended. Sign in again to continue.',
  403: 'This action is not available right now.',
  404: 'We could not find this item.',
  409: 'This session changed. Refresh and try again.',
  422: 'Could not complete that request with the current material.',
  429: 'Your tutor is available again tomorrow.',
  503: 'Your tutor is resting. Try again soon.',
}

export class TutorCoApiError extends LearnApiError {
  readonly retryAfterSeconds?: number

  constructor(status: number, message: string, code?: string, retryAfterSeconds?: number) {
    super(status, message, code)
    this.name = 'TutorCoApiError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

/**
 * All Ask Co calls go through W5's shared transport (`tutorLoopRequest`): same BFF path, workspace header and
 * contract-fixture mode. Failures are re-thrown as `TutorCoApiError` so the page only has one error type to handle.
 */
export async function tutorCoRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<T> {
  try {
    return await tutorLoopRequest(path, schema, method, body)
  } catch (error) {
    if (error instanceof LearnSessionError || error instanceof TutorCoApiError) throw error
    if (isTutorLoopApiError(error)) {
      const code = error.code ?? (error.status === 503 ? 'TUTOR_RESTING' : undefined)
      const message =
        (code ? tutorMessagesByCode[code] : undefined) ??
        tutorStatusMessages[error.status] ??
        'Your tutor is resting. Try again soon.'
      throw new TutorCoApiError(error.status, message, code, error.retryAfterSeconds)
    }
    throw new TutorCoApiError(503, tutorMessagesByCode.TUTOR_RESTING!, 'TUTOR_RESTING')
  }
}

/* ---------- Reason code display helper ---------- */

export const reasonCodeLabels: Record<string, string> = {
  LEARNER_ASKED: 'Because you asked about this',
  RECENT_MISTAKE: 'Because this slipped in recent practice',
  DUE_REVIEW: 'Because a review is due today',
  EXAM_NEAR: 'Because your exam is coming up soon',
  LESSON_DONE: 'Because you just finished the lesson',
  TOPIC_SECURE: 'Because this concept looks secure',
  MATERIAL_MATCH: 'From your study material',
  ON_SCHEDULE: 'Next on your study schedule',
  TEACHER_DUE: 'Due from your teacher',
  LOW_TIME: 'Fits the time you have today',
  RETURNED: 'Picking up where you left off',
  STUCK: 'Trying a smaller step together',
  GOAL_LINKED: 'Part of your active goal',
}

export function formatReasonCodes(codes: readonly string[]): string {
  for (const code of codes) {
    if (reasonCodeLabels[code]) return reasonCodeLabels[code]!
  }
  return 'Suggested for your current topic'
}

/* ---------- Typed Client Functions ---------- */

export interface ListTutorSessionsQuery {
  subjectRef?: string | null
  topicRef?: string | null
  planId?: string | null
  cursor?: string | null
  limit?: number
}

export function getTutorContext(
  context: TutorContextDescriptor = { kind: 'GLOBAL' },
): Promise<TutorContextResponse> {
  const queryRecord = tutorContextToQuery(context)
  const params = new URLSearchParams(queryRecord)
  const qs = params.toString()
  return tutorCoRequest(`/co/context${qs ? `?${qs}` : ''}`, tutorContextResponseSchema, 'GET')
}

export function listTutorSessions(
  query: ListTutorSessionsQuery = {},
): Promise<TutorSessionListResponse> {
  const params = new URLSearchParams()
  if (query.subjectRef) params.set('subjectRef', query.subjectRef)
  if (query.topicRef) params.set('topicRef', query.topicRef)
  if (query.planId) params.set('planId', query.planId)
  if (query.cursor) params.set('cursor', query.cursor)
  if (query.limit !== undefined) params.set('limit', String(query.limit))
  const qs = params.toString()
  return tutorCoRequest(`/co/sessions${qs ? `?${qs}` : ''}`, tutorSessionListSchema, 'GET')
}

export function createTutorSession(input: CreateTutorSessionInput): Promise<TutorSessionDetail> {
  return tutorCoRequest('/co/sessions', tutorSessionDetailSchema, 'POST', input)
}

export function getTutorSession(
  sessionId: string,
  query: { cursor?: string | null; limit?: number } = {},
): Promise<TutorSessionDetail> {
  const params = new URLSearchParams()
  if (query.cursor) params.set('cursor', query.cursor)
  if (query.limit !== undefined) params.set('limit', String(query.limit))
  const qs = params.toString()
  return tutorCoRequest(
    `/co/sessions/${encodeURIComponent(sessionId)}${qs ? `?${qs}` : ''}`,
    tutorSessionDetailSchema,
    'GET',
  )
}

export function closeTutorSession(
  sessionId: string,
  clientRequestId: string,
): Promise<TutorSessionDetail> {
  return tutorCoRequest(
    `/co/sessions/${encodeURIComponent(sessionId)}/close`,
    tutorSessionDetailSchema,
    'POST',
    { clientRequestId },
  )
}

export function deleteTutorSession(sessionId: string): Promise<{ removed: boolean }> {
  return tutorCoRequest(
    `/co/sessions/${encodeURIComponent(sessionId)}`,
    removedSchema,
    'DELETE',
  )
}

export function submitTutorTurn(
  sessionId: string,
  input: CreateTutorTurnInput,
): Promise<TutorTurn> {
  const body: Record<string, unknown> = {
    clientRequestId: input.clientRequestId,
    text: input.text.trim(),
  }
  if (input.mode) body.mode = input.mode
  if (input.checkResponse) body.checkResponse = input.checkResponse
  return tutorCoRequest(
    `/co/sessions/${encodeURIComponent(sessionId)}/turns`,
    tutorTurnSchema,
    'POST',
    body,
  )
}

export function getTutorTurn(sessionId: string, turnId: string): Promise<TutorTurn> {
  return tutorCoRequest(
    `/co/sessions/${encodeURIComponent(sessionId)}/turns/${encodeURIComponent(turnId)}`,
    tutorTurnSchema,
    'GET',
  )
}

export function retryTutorTurn(
  sessionId: string,
  turnId: string,
  clientRequestId: string,
): Promise<TutorTurn> {
  return tutorCoRequest(
    `/co/sessions/${encodeURIComponent(sessionId)}/turns/${encodeURIComponent(turnId)}/retry`,
    tutorTurnSchema,
    'POST',
    { clientRequestId },
  )
}

export function cancelTutorTurn(
  sessionId: string,
  turnId: string,
  clientRequestId: string,
): Promise<TutorTurn> {
  return tutorCoRequest(
    `/co/sessions/${encodeURIComponent(sessionId)}/turns/${encodeURIComponent(turnId)}/cancel`,
    tutorTurnSchema,
    'POST',
    { clientRequestId },
  )
}

export function acceptTutorProposal(
  proposalId: string,
  clientRequestId: string,
): Promise<TutorProposalAcceptedResponse> {
  return tutorCoRequest(
    `/co/proposals/${encodeURIComponent(proposalId)}/accept`,
    proposalAcceptedSchema,
    'POST',
    { clientRequestId },
  )
}

export function getTutorNudges(screen?: string): Promise<TutorNudgeListResponse> {
  const params = new URLSearchParams()
  if (screen) params.set('screen', screen)
  const qs = params.toString()
  return tutorCoRequest(`/co/nudges${qs ? `?${qs}` : ''}`, nudgeListSchema, 'GET')
}

export function dismissTutorNudge(nudgeId: string): Promise<{ dismissed: boolean }> {
  return tutorCoRequest(
    `/co/nudges/${encodeURIComponent(nudgeId)}/dismiss`,
    dismissedSchema,
    'POST',
  )
}

export function setTutorNudgeMute(
  kind: TutorNudgeKind,
  muted: boolean,
): Promise<TutorNudgeMuteResponse> {
  return tutorCoRequest(
    `/co/nudges/mutes/${encodeURIComponent(kind)}`,
    nudgeMuteSchema,
    'PUT',
    { muted },
  )
}

export function findTutorMaterial(
  input: TutorFindMaterialInput,
): Promise<TutorMaterialProposalsResponse> {
  const body: Record<string, unknown> = {
    clientRequestId: input.clientRequestId,
    topicId: input.topicId,
  }
  if (input.query?.trim()) {
    body.query = input.query.trim()
  }
  return tutorCoRequest('/co/find-material', materialProposalsSchema, 'POST', body)
}

export function addFoundTutorMaterial(
  proposalId: string,
  clientRequestId: string,
): Promise<TutorMaterialAddedResponse> {
  return tutorCoRequest(
    `/co/find-material/${encodeURIComponent(proposalId)}/add`,
    materialAddedSchema,
    'POST',
    { clientRequestId },
  )
}

export const tutorCoApi = {
  getContext: getTutorContext,
  listSessions: listTutorSessions,
  createSession: createTutorSession,
  getSession: getTutorSession,
  closeSession: closeTutorSession,
  deleteSession: deleteTutorSession,
  submitTurn: submitTutorTurn,
  getTurn: getTutorTurn,
  retryTurn: retryTutorTurn,
  cancelTurn: cancelTutorTurn,
  acceptProposal: acceptTutorProposal,
  getNudges: getTutorNudges,
  dismissNudge: dismissTutorNudge,
  setNudgeMute: setTutorNudgeMute,
  findMaterial: findTutorMaterial,
  addFoundMaterial: addFoundTutorMaterial,
}
