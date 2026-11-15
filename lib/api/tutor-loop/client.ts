import { z } from 'zod'
import { LearnApiError, LearnSessionError } from '@/lib/api/learn-request'
import { resolveTutorLoopFixture } from './fixtures'

export type TutorWorkspaceScope = 'school' | 'personal'

export class TutorLoopApiError extends LearnApiError {
  constructor(
    status: number,
    message: string,
    code?: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(status, message, code)
    this.name = 'TutorLoopApiError'
  }
}

/**
 * W1's `goals.ts` and `profile.ts` still define their own `TutorLoopApiError` (arguments: status, code, message).
 * Recognise those by name so one `instanceof TutorLoopApiError` / `isTutorLoopApiError` check works everywhere.
 */
Object.defineProperty(TutorLoopApiError, Symbol.hasInstance, {
  value(candidate: unknown) {
    return candidate instanceof Error && (candidate as { name?: string }).name === 'TutorLoopApiError'
  },
})

export function isTutorLoopApiError(error: unknown): error is { status: number; code?: string; message: string; retryAfterSeconds?: number } {
  return error instanceof TutorLoopApiError
}

/** True when the platform says Tutor Loop is off for this learner (flag-off or ineligible band). */
export function isTutorNotEnabled(error: unknown): boolean {
  return isTutorLoopApiError(error) && (error.code === 'TUTOR_NOT_ENABLED' || error.status === 403)
}

/** True for the typed 503 family the design shows as "Co is resting". */
export function isTutorResting(error: unknown): boolean {
  return isTutorLoopApiError(error) && (error.code === 'TUTOR_RESTING' || error.code === 'AI_UNAVAILABLE')
}

export { LearnSessionError as TutorLoopSessionError }

const tutorErrorCopy: Record<string, string> = {
  INVALID_REQUEST: 'Check what you entered and try again.',
  INVALID_CURSOR: 'This list changed while you were browsing. Refresh to start from the top.',
  INVALID_DATE_RANGE: 'Choose a valid date range (up to 90 days) and try again.',
  INVALID_CONTEXT: 'This tutor context is no longer valid. Open your topic or material again.',
  ANSWER_INVALID: 'That answer could not be read. Check it and try again.',
  AUTH_REQUIRED: 'Your learning session has ended. Sign in again to continue.',
  TUTOR_NOT_ENABLED: 'Tutor Loop is not enabled for this workspace yet.',
  CONSENT_REQUIRED: 'Consent is required before you can use this learning workspace.',
  POLICY_BLOCKED: 'Your school or family settings do not allow this right now.',
  ADULT_VERIFICATION_REQUIRED: 'Verified adult personal access is required for this space.',
  GENERAL_DISABLED: 'Your tutor can answer from your material.',
  FIND_MATERIAL_NOT_ENTITLED: 'Finding material is available with Plus.',
  EXAM_CONDITIONS_ACTIVE: 'Your tutor is available after the exam.',
  RESOURCE_NOT_FOUND: 'We could not find this item.',
  REQUEST_CONFLICT: 'That request conflicted with an earlier change. Refresh and try again.',
  REVISION_CONFLICT: 'Your changes are out of date. Refresh to get the latest version.',
  PREVIEW_STALE: 'Your schedule has changed. Preview the move again.',
  CONVERSATION_CLOSED: 'This chat is closed. Start a new chat with your tutor.',
  TURN_PENDING: 'Your tutor is still working on your last message.',
  NOT_CANCELLABLE: 'This action has already finished and cannot be cancelled.',
  NOT_RETRYABLE: 'This action cannot be retried.',
  JOB_NOT_READY: 'This is still being prepared. Give it a moment.',
  PLAN_READ_ONLY: 'Your teacher controls the structure of this plan.',
  ITEM_FIXED: 'This teacher deadline is fixed and cannot be moved.',
  SCHEDULE_FULL: 'There is not enough study time in your schedule for this.',
  MOCK_ACTIVE: 'A mock exam is currently in progress.',
  MOCK_NOT_SUBMITTED: 'Submit your mock exam before viewing results.',
  MOCK_SHORTFALL: 'There is not enough material for the full mock length.',
  DEADLINE_PASSED: 'The deadline for this sitting has passed.',
  SOURCE_ACCESS_CHANGED: 'Access to this source material has changed.',
  INVALID_TUTOR_NAME: 'Choose a short, appropriate name (up to 16 characters, letters and spaces only).',
  INSUFFICIENT_MATERIAL: 'Add more study material to generate this.',
  NO_QUESTIONS_AVAILABLE: 'No questions are available for this selection yet.',
  NON_LEARNING_MEMORY: 'Your tutor only remembers notes that help with your learning.',
  DAILY_TUTOR_LIMIT: 'Your tutor is available again tomorrow.',
  DAILY_PLAN_LIMIT: 'You have reached today’s limit for drafting plans. You can still edit your plan manually.',
  DAILY_MOCK_LIMIT: 'You have reached today’s limit for building mock exams. Try again tomorrow.',
  ATTEMPT_RATE_LIMIT: 'Too many requests in a short time. Wait a moment and try again.',
  TUTOR_RESTING: 'Your tutor is resting. Try again soon.',
  AI_UNAVAILABLE: 'Your tutor is resting. Non-AI study tools are still available.',
  SEARCH_UNAVAILABLE: 'Search is temporarily unavailable. Please try again in a moment.',
}

const statusFallbackCopy: Record<number, string> = {
  400: 'Check what you entered and try again.',
  401: 'Your learning session has ended. Sign in again to continue.',
  403: 'This action is not permitted by your current workspace settings.',
  404: 'We could not find this item.',
  409: 'This has changed. Refresh and review it before trying again.',
  422: 'We could not complete that with the current inputs.',
  429: 'Too many tries. Please wait a moment and try again.',
  503: 'Your tutor is resting. Try again soon.',
}

const codePattern = /^[A-Z][A-Z0-9_]{2,63}$/

export function parseTutorErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined
  const record = body as Record<string, unknown>
  if (typeof record.code === 'string' && codePattern.test(record.code)) return record.code
  const nested = record.error && typeof record.error === 'object' ? (record.error as Record<string, unknown>).code : undefined
  if (typeof nested === 'string' && codePattern.test(nested)) return nested
  return undefined
}

export function formatTutorErrorMessage(status: number, code: string | undefined, body?: unknown): string {
  if (code && tutorErrorCopy[code]) return tutorErrorCopy[code]!
  if (body && typeof body === 'object') {
    const msg = (body as Record<string, unknown>).message
    if (typeof msg === 'string' && msg.trim().length > 0 && msg.length <= 240 && !codePattern.test(msg)) {
      return msg
    }
  }
  return statusFallbackCopy[status] ?? 'Learning services are unavailable right now. Please try again.'
}

/* ---------- Workspace & Fixture Mode State ---------- */

let currentWorkspaceScope: TutorWorkspaceScope | null = null
let fixtureModeOverride: boolean | null = null

export function setTutorWorkspaceScope(scope: TutorWorkspaceScope | null) {
  currentWorkspaceScope = scope
  if (typeof document !== 'undefined') {
    if (scope === 'personal') {
      document.cookie = 'colearner-tutor-workspace=personal; path=/; SameSite=Lax'
    } else if (scope === 'school') {
      document.cookie = 'colearner-tutor-workspace=school; path=/; SameSite=Lax'
    } else {
      document.cookie = 'colearner-tutor-workspace=; path=/; max-age=0'
    }
  }
}

export function getTutorWorkspaceScope(): TutorWorkspaceScope {
  if (currentWorkspaceScope) return currentWorkspaceScope
  if (typeof document !== 'undefined') {
    const match = /(?:^|;\s*)colearner-tutor-workspace=(personal|school)/.exec(document.cookie)
    if (match?.[1] === 'personal') return 'personal'
  }
  return 'school'
}

export function setTutorLoopFixtureMode(enabled: boolean | null) {
  fixtureModeOverride = enabled
}

export function isTutorLoopFixtureMode(): boolean {
  if (fixtureModeOverride !== null) return fixtureModeOverride
  if (typeof process !== 'undefined') {
    if (
      process.env.TUTOR_LOOP_USE_FIXTURES === 'true' ||
      process.env.NEXT_PUBLIC_TUTOR_LOOP_USE_FIXTURES === 'true'
    ) {
      return true
    }
  }
  return false
}

/* ---------- Shared Schemas & DTOs ---------- */

export const tutorIconSchema = z.enum(['BUDDY', 'CLOUD', 'SPARK', 'SPROUT'])
export type TutorIcon = z.infer<typeof tutorIconSchema>

export const tutorStyleSchema = z.enum(['FRIENDLY', 'TO_THE_POINT', 'DETAILED', 'CHALLENGING'])
export type TutorStyle = z.infer<typeof tutorStyleSchema>

export const tutorPresenceSchema = z.enum(['AVAILABLE', 'QUIET'])
export type TutorPresence = z.infer<typeof tutorPresenceSchema>

export const findMaterialCapabilitySchema = z.enum(['HIDDEN', 'LOCKED', 'UNAVAILABLE', 'AVAILABLE'])
export type FindMaterialCapability = z.infer<typeof findMaterialCapabilitySchema>

export const tutorCapabilitiesSchema = z.object({
  canCreatePersonalPlan: z.boolean(),
  canUseTutor: z.boolean(),
  canUseMock: z.boolean(),
  canUseMemory: z.boolean(),
  findMaterial: findMaterialCapabilitySchema,
})
export type TutorCapabilities = z.infer<typeof tutorCapabilitiesSchema>

export const tutorIdentitySchema = z.object({
  name: z.string(),
  icon: tutorIconSchema,
})
export type TutorIdentity = z.infer<typeof tutorIdentitySchema>

export const tutorEntrySchema = z.object({
  band: z.enum(['14-17', '18+']),
  scope: z.enum(['SCHOOL', 'PERSONAL']),
  needsOnboarding: z.boolean(),
  needsConsent: z.boolean(),
  capabilities: tutorCapabilitiesSchema,
  tutorIdentity: tutorIdentitySchema.nullable(),
})
export type TutorEntryResponse = z.infer<typeof tutorEntrySchema>

export const learnerGoalKindSchema = z.enum(['EXAM', 'LEARNING', 'SCHOOL', 'ASSIGNMENT', 'TEST'])
export type LearnerGoalKind = z.infer<typeof learnerGoalKindSchema>

export const learnerExamSchema = z.object({
  id: z.string(),
  goalId: z.string(),
  title: z.string(),
  date: z.string().nullable(),
  passMarkPercent: z.number().nullable(),
  revision: z.number(),
})
export type LearnerExam = z.infer<typeof learnerExamSchema>

export const learnerGoalTopicLinkSchema = z.object({
  topicId: z.string(),
  weightBps: z.number(),
})
export type LearnerGoalTopicLink = z.infer<typeof learnerGoalTopicLinkSchema>

export const learnerGoalSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: learnerGoalKindSchema,
  dueDate: z.string().nullable(),
  status: z.enum(['ACTIVE', 'ARCHIVED']),
  position: z.number(),
  source: z.enum(['LEARNER', 'ONBOARDING', 'ASSIGNED']),
  revision: z.number(),
  exam: learnerExamSchema.nullable().optional(),
  topics: z.array(learnerGoalTopicLinkSchema).default([]),
})
export type LearnerGoal = z.infer<typeof learnerGoalSchema>

export const learnerGoalsListSchema = z.object({
  items: z.array(learnerGoalSchema),
  nextCursor: z.string().nullable(),
})
export type LearnerGoalsList = z.infer<typeof learnerGoalsListSchema>

export const planTopicStateSchema = z.enum(['NOT_STARTED', 'LEARNING', 'PRACTICING', 'SECURE', 'MASTERED', 'NEEDS_REVIEW'])
export type PlanTopicState = z.infer<typeof planTopicStateSchema>

export const planTopicBasisSchema = z.enum(['SYLLABUS', 'MATERIAL', 'SUGGESTION', 'MANUAL'])
export type PlanTopicBasis = z.infer<typeof planTopicBasisSchema>

export const tutorPlanTopicSchema = z.object({
  id: z.string(),
  title: z.string(),
  estimateMin: z.number(),
  priority: z.number(),
  basis: planTopicBasisSchema,
  materialIds: z.array(z.string()),
  state: planTopicStateSchema,
  dueDate: z.string().nullable(),
  alreadyKnown: z.boolean(),
  archived: z.boolean(),
  subjectId: z.string().nullable().optional(),
  subjectTitle: z.string().nullable().optional(),
})
export type TutorPlanTopic = z.infer<typeof tutorPlanTopicSchema>

export const tutorPlanPhaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  topics: z.array(tutorPlanTopicSchema),
})
export type TutorPlanPhase = z.infer<typeof tutorPlanPhaseSchema>

export const tutorPlanSchema = z.object({
  id: z.string(),
  title: z.string(),
  ownership: z.enum(['OWN', 'ASSIGNED']),
  state: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']),
  revision: z.number(),
  goalIds: z.array(z.string()),
  phases: z.array(tutorPlanPhaseSchema),
  teacherName: z.string().nullable().optional(),
  teacherNote: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
})
export type TutorPlan = z.infer<typeof tutorPlanSchema>

export const tutorPlansListSchema = z.object({
  items: z.array(tutorPlanSchema),
  nextCursor: z.string().nullable(),
})
export type TutorPlansList = z.infer<typeof tutorPlansListSchema>

export const topicMaterialAttachmentSchema = z.object({
  planId: z.string(),
  topicId: z.string(),
  materialId: z.string(),
  attached: z.boolean(),
})
export type TopicMaterialAttachment = z.infer<typeof topicMaterialAttachmentSchema>

export const removedReceiptSchema = z.object({
  removed: z.boolean(),
})

export const sourceCitationSchema = z.object({
  materialId: z.string(),
  sourceVersionRef: z.string(),
  passageRef: z.string(),
  quote: z.string(),
  label: z.string(),
})
export type SourceCitation = z.infer<typeof sourceCitationSchema>

export const tutorActionSchema = z.object({
  kind: z.string(),
  targetId: z.string().nullable(),
  label: z.string(),
  minutes: z.number(),
  reasonCodes: z.array(z.string()),
})
export type TutorAction = z.infer<typeof tutorActionSchema>

export const tutorNextStepSchema = z.object({
  activityKind: z.enum(['MATERIAL', 'LESSON', 'PRACTICE', 'TEACH_BACK', 'HOMEWORK']),
  activityId: z.string(),
  measured: z.record(z.string(), z.number()),
  briefing: z.object({
    action: tutorActionSchema,
    alternative: tutorActionSchema,
    wording: z.string(),
  }),
})
export type TutorNextStep = z.infer<typeof tutorNextStepSchema>

export const materialProposalSchema = z.object({
  id: z.string(),
  title: z.string(),
  publisher: z.string(),
  host: z.string(),
  expiresAt: z.string(),
})
export type TutorMaterialProposal = z.infer<typeof materialProposalSchema>

export const materialProposalsResponseSchema = z.object({
  items: z.array(materialProposalSchema),
})

export const materialAddedResponseSchema = z.object({
  materialId: z.string(),
  jobId: z.string(),
  status: z.string(),
  attribution: z.object({
    publisher: z.string(),
    host: z.string(),
    addedByTutor: z.boolean(),
  }),
})
export type TutorMaterialAdded = z.infer<typeof materialAddedResponseSchema>

/* ---------- Query & Request Helpers ---------- */

export function buildTutorQuery(
  params?: Record<string, string | number | boolean | null | undefined>,
): string {
  if (!params) return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const str = search.toString()
  return str ? `?${str}` : ''
}

export interface TutorRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | null | undefined>
  workspace?: TutorWorkspaceScope
  headers?: Record<string, string>
  timeoutMs?: number
  useFixtures?: boolean
}

function normalizeTutorSubpath(path: string): string {
  const trimmed = path.trim()
  if (trimmed.startsWith('/api/learn/tutor-loop')) {
    return trimmed.slice('/api/learn/tutor-loop'.length) || '/'
  }
  if (trimmed.startsWith('/api/v1/learn/tutor-loop')) {
    return trimmed.slice('/api/v1/learn/tutor-loop'.length) || '/'
  }
  if (trimmed.startsWith('/tutor-loop')) {
    return trimmed.slice('/tutor-loop'.length) || '/'
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

/**
 * Typed client for `/api/v1/learn/tutor-loop/*` through the web BFF (`/api/learn/tutor-loop/*`).
 * Supports both options-object and positional `(path, schema, method, body, options)` signatures.
 */
export async function tutorLoopRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  methodOrOptions?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | TutorRequestOptions,
  maybeBody?: unknown,
  maybeOptions?: Omit<TutorRequestOptions, 'method' | 'body'>,
): Promise<T> {
  const options: TutorRequestOptions =
    typeof methodOrOptions === 'string'
      ? { ...maybeOptions, method: methodOrOptions, body: maybeBody }
      : methodOrOptions ?? {}

  const method = options.method ?? 'GET'
  const subpath = normalizeTutorSubpath(path)
  const queryStr = buildTutorQuery(options.query)
  const fullSubpath = queryStr
    ? `${subpath}${subpath.includes('?') ? '&' : '?'}${queryStr.slice(1)}`
    : subpath

  if (options.useFixtures ?? isTutorLoopFixtureMode()) {
    const resolved = resolveTutorLoopFixture(method, fullSubpath)
    if (resolved) {
      const parsed = schema.safeParse(resolved.body)
      if (parsed.success) return parsed.data
    }
  }

  const workspace = options.workspace ?? getTutorWorkspaceScope()
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  }
  if (workspace === 'personal') {
    headers['X-Tutor-Workspace'] = 'personal'
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const bffUrl = `/api/learn/tutor-loop${fullSubpath}`
  let response: Response
  try {
    response = await fetch(bffUrl, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: 'no-store',
      signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
    })
  } catch {
    throw new TutorLoopApiError(503, statusFallbackCopy[503]!)
  }

  if (!response.ok) {
    const failure: unknown = await response.json().catch(() => null)
    if (response.status === 401) {
      throw new LearnSessionError(statusFallbackCopy[401]!)
    }
    const code = parseTutorErrorCode(failure)
    const retryAfter =
      failure && typeof failure === 'object' && typeof (failure as Record<string, unknown>).retryAfterSeconds === 'number'
        ? ((failure as Record<string, unknown>).retryAfterSeconds as number)
        : undefined
    throw new TutorLoopApiError(
      response.status,
      formatTutorErrorMessage(response.status, code, failure),
      code,
      retryAfter,
    )
  }

  const json: unknown =
    response.status === 204
      ? undefined
      : await response.json().catch(() => {
          throw new TutorLoopApiError(
            502,
            'Learning services returned something unexpected. Please refresh or try again later.',
          )
        })

  const payload =
    json !== null && typeof json === 'object' && 'data' in json
      ? (json as { data: unknown }).data
      : json
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    throw new TutorLoopApiError(
      502,
      'Learning services returned something unexpected. Please refresh or try again later.',
    )
  }
  return parsed.data
}

export function tutorLoopGet<T>(
  path: string,
  schema: z.ZodType<T>,
  query?: Record<string, string | number | boolean | null | undefined>,
  options?: Omit<TutorRequestOptions, 'method' | 'query'>,
): Promise<T> {
  return tutorLoopRequest(path, schema, { ...options, method: 'GET', query })
}

export function tutorLoopPost<T>(
  path: string,
  schema: z.ZodType<T>,
  body?: unknown,
  options?: Omit<TutorRequestOptions, 'method' | 'body'>,
): Promise<T> {
  return tutorLoopRequest(path, schema, { ...options, method: 'POST', body })
}

export function tutorLoopPut<T>(
  path: string,
  schema: z.ZodType<T>,
  body?: unknown,
  options?: Omit<TutorRequestOptions, 'method' | 'body'>,
): Promise<T> {
  return tutorLoopRequest(path, schema, { ...options, method: 'PUT', body })
}

export function tutorLoopPatch<T>(
  path: string,
  schema: z.ZodType<T>,
  body?: unknown,
  options?: Omit<TutorRequestOptions, 'method' | 'body'>,
): Promise<T> {
  return tutorLoopRequest(path, schema, { ...options, method: 'PATCH', body })
}

export function tutorLoopDelete<T>(
  path: string,
  schema: z.ZodType<T>,
  query?: Record<string, string | number | boolean | null | undefined>,
  options?: Omit<TutorRequestOptions, 'method' | 'query'>,
): Promise<T> {
  return tutorLoopRequest(path, schema, { ...options, method: 'DELETE', query })
}

/* ---------- Plan Edit Operations ---------- */

export type PlanEditOperation =
  | { kind: 'TITLE'; title: string }
  | { kind: 'REORDER'; phaseId: string; topicIds: string[] }
  | {
      kind: 'ADD'
      phaseId: string
      topic: {
        title: string
        estimateMin: number
        priority: number
        basis: PlanTopicBasis
        materialIds?: string[]
      }
    }
  | { kind: 'ARCHIVE_TOPIC'; topicId: string }
  | { kind: 'KNOWN'; topicId: string; alreadyKnown: boolean }
  | { kind: 'STATE'; state: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' }

export interface ListPlansFilters {
  goalId?: string | null
  ownership?: 'OWN' | 'ASSIGNED'
  query?: string
  groupBy?: 'SUBJECT' | 'STATUS'
  cursor?: string | null
  limit?: number
}

export interface CreateManualPlanInput {
  clientRequestId: string
  title: string
  goalId?: string | null
  phases?: {
    title: string
    topics: {
      title: string
      estimateMin: number
      priority: number
      basis: PlanTopicBasis
      materialIds: string[]
    }[]
  }[]
}

export const tutorLoopClient = {
  entry: (options?: Omit<TutorRequestOptions, 'method'>) =>
    tutorLoopGet('/entry', tutorEntrySchema, undefined, options),

  goals: (includeArchived = false, options?: Omit<TutorRequestOptions, 'method' | 'query'>) =>
    tutorLoopGet('/goals', learnerGoalsListSchema, { includeArchived }, options),

  createGoal: (
    body: {
      clientRequestId: string
      title: string
      kind: LearnerGoalKind
      dueDate?: string | null
      exam?: { date: string | null; passMarkPercent: number | null }
      topics?: { topicId: string; weightBps: number }[]
    },
    options?: Omit<TutorRequestOptions, 'method' | 'body'>,
  ) => tutorLoopPost('/goals', learnerGoalSchema, body, options),

  plans: (filters: ListPlansFilters = {}, options?: Omit<TutorRequestOptions, 'method' | 'query'>) =>
    tutorLoopGet(
      '/plans',
      tutorPlansListSchema,
      {
        goalId: filters.goalId ?? undefined,
        ownership: filters.ownership,
        query: filters.query?.trim() || undefined,
        groupBy: filters.groupBy,
        cursor: filters.cursor ?? undefined,
        limit: filters.limit,
      },
      options,
    ),

  plan: (planId: string, goalId?: string | null, options?: Omit<TutorRequestOptions, 'method' | 'query'>) =>
    tutorLoopGet(`/plans/${encodeURIComponent(planId)}`, tutorPlanSchema, { goalId: goalId ?? undefined }, options),

  createPlan: (input: CreateManualPlanInput, options?: Omit<TutorRequestOptions, 'method' | 'body'>) =>
    tutorLoopPost('/plans', tutorPlanSchema, input, options),

  patchPlan: (
    planId: string,
    revision: number,
    operations: PlanEditOperation[],
    options?: Omit<TutorRequestOptions, 'method' | 'body'>,
  ) =>
    tutorLoopPatch(
      `/plans/${encodeURIComponent(planId)}`,
      tutorPlanSchema,
      { revision, operations },
      options,
    ),

  attachTopicMaterial: (
    planId: string,
    topicId: string,
    materialId: string,
    options?: Omit<TutorRequestOptions, 'method'>,
  ) =>
    tutorLoopPut(
      `/plans/${encodeURIComponent(planId)}/topics/${encodeURIComponent(topicId)}/materials/${encodeURIComponent(materialId)}`,
      topicMaterialAttachmentSchema,
      undefined,
      options,
    ),

  detachTopicMaterial: (
    planId: string,
    topicId: string,
    materialId: string,
    options?: Omit<TutorRequestOptions, 'method'>,
  ) =>
    tutorLoopDelete(
      `/plans/${encodeURIComponent(planId)}/topics/${encodeURIComponent(topicId)}/materials/${encodeURIComponent(materialId)}`,
      removedReceiptSchema,
      undefined,
      options,
    ),

  nextStep: (
    activityKind: 'MATERIAL' | 'LESSON' | 'PRACTICE' | 'TEACH_BACK' | 'HOMEWORK',
    activityId: string,
    options?: Omit<TutorRequestOptions, 'method'>,
  ) =>
    tutorLoopGet(
      `/activities/${activityKind}/${encodeURIComponent(activityId)}/next`,
      tutorNextStepSchema,
      undefined,
      options,
    ),

  findMaterial: (
    input: { clientRequestId: string; topicId: string; query?: string },
    options?: Omit<TutorRequestOptions, 'method' | 'body'>,
  ) => tutorLoopPost('/co/find-material', materialProposalsResponseSchema, input, options),

  addFoundMaterial: (
    proposalId: string,
    clientRequestId: string,
    options?: Omit<TutorRequestOptions, 'method' | 'body'>,
  ) =>
    tutorLoopPost(
      `/co/find-material/${encodeURIComponent(proposalId)}/add`,
      materialAddedResponseSchema,
      { clientRequestId },
      options,
    ),
}
