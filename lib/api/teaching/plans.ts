import { z } from 'zod'
import { ApiError } from '../client'
import { TeachingApiError, type TeachingMethod } from './core'
import { teachingContextSchema } from './dashboard'

/*
 * B12 sections 6.3 and 10 (T2 plan list, new plan, T3 plan editor). Every response is Zod-parsed; a response that does not
 * match is a 502, never a half-rendered screen. `request` is `useTeaching().request` (or any compatible function), so these
 * helpers are transport-agnostic and testable. Mutations always send `expectedRevision` (where the contract has one) and an
 * `Idempotency-Key`; a retry of the same intent reuses its key via `IntentKey`.
 */
export type TeachingRequest = <T>(suffix: string, method?: TeachingMethod, body?: unknown, headers?: Record<string, string>) => Promise<T>

export type Band = '6-9' | '10-13' | '14-17'
export type PlanStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export const bandSchema = z.enum(['6-9', '10-13', '14-17'])
export const planStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
const id = z.string().min(1).max(256)
const iso = z.string().min(1)
const count = z.number().int().nonnegative()
const originSchema = z.enum(['SCRATCH', 'CURRICULUM', 'OUTLINE', 'LEGACY_ADOPTED', 'AI_DRAFT'])

export interface PlanTreeNode {
  id: string; kind: 'module' | 'topic' | 'subtopic'; title: string; description: string | null; sortOrder: number; dueAt: string | null
  prerequisiteTopicIds: string[]
  counts: { materials: number; publishedQuestions: number; draftQuestions: number; lesson: 'NONE' | 'DRAFT' | 'PUBLISHED' }
  children: PlanTreeNode[]
}
export const planTreeNodeSchema: z.ZodType<PlanTreeNode> = z.lazy(() => z.object({
  id, kind: z.enum(['module', 'topic', 'subtopic']), title: z.string().max(500), description: z.string().nullable(), sortOrder: z.number().int(),
  dueAt: iso.nullable(), prerequisiteTopicIds: z.array(id),
  counts: z.object({ materials: count, publishedQuestions: count, draftQuestions: count, lesson: z.enum(['NONE', 'DRAFT', 'PUBLISHED']) }),
  children: z.array(planTreeNodeSchema),
}))

const eligibilitySchema = z.object({
  targetBand: bandSchema, defaultBandForGrade: bandSchema,
  rosterByBand: z.object({ '6-9': count, '10-13': count, '14-17': count }),
  unknownBand: count, outsideTarget: count, note: z.string().nullable(),
})
export type PlanEligibility = z.infer<typeof eligibilitySchema>
const scopeSchema = z.object({
  classId: id, classLabel: z.string(), subject: z.string(), curriculumSubjectId: id.nullable(), curriculumLabel: z.string().nullable(),
  targetBand: bandSchema, origin: originSchema,
})
export type PlanScope = z.infer<typeof scopeSchema>
export const planCardSchema = z.object({
  id, title: z.string(), status: planStatusSchema, scope: scopeSchema,
  students: z.object({ roster: count, enrolledActive: count, pendingGuardian: count }),
  averageProgress: z.number().min(0).max(100).nullable(), topicCount: count, updatedAt: iso, publishedAt: iso.nullable(),
})
export type TeachingPlanCard = z.infer<typeof planCardSchema>
const issueSchema = z.object({
  code: z.enum(['NO_TOPICS', 'EMPTY_TITLE', 'ASSIGNMENT_REVOKED', 'TOPIC_WITHOUT_CONTENT', 'LESSON_DRAFT_UNPUBLISHED']),
  severity: z.enum(['ERROR', 'WARNING']), nodeId: id.nullable(), message: z.string(),
})
export type ReadinessIssue = z.infer<typeof issueSchema>
export const visibilityStates = ['NOT_PUBLISHED', 'PUBLISHED_NOT_ASSIGNED', 'ASSIGNED_PENDING_APPROVAL', 'ASSIGNED'] as const
export const planDetailSchema = planCardSchema.extend({
  description: z.string().nullable(), revision: z.number().int().nonnegative(), tree: z.array(planTreeNodeSchema), eligibility: eligibilitySchema,
  readiness: z.object({ publishable: z.boolean(), issues: z.array(issueSchema) }),
  studentVisibility: z.object({ state: z.enum(visibilityStates), assignedClassIds: z.array(id) }),
  frozen: z.boolean(),
  /** Present on publish, unpublish and archive responses: false for an idempotent replay. */
  changed: z.boolean().optional(),
})
export type TeachingPlanDetail = z.infer<typeof planDetailSchema>
const planListSchema = z.object({
  items: z.array(planCardSchema), nextCursor: z.string().nullable(),
  counts: z.object({ draft: count, published: count, archived: count }),
})
export type TeachingPlanList = z.infer<typeof planListSchema>
export type PlanTeachingContext = z.infer<typeof teachingContextSchema>

export const unexpectedResponse = () => new TeachingApiError(502, 'The teaching service returned something unexpected. Please refresh or try again later.')
/** Every response is parsed; a mismatch (including an unexpected field where a schema is strict) is a 502. */
export function parseResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) throw unexpectedResponse()
  return result.data
}

export interface TeachingErrorInfo { status: number; code: string | null; currentRevision: number | null; message: string }
/** One reading of every failure: status, platform code (when the transport kept it) and a message safe to show. */
export function teachingErrorInfo(error: unknown): TeachingErrorInfo {
  if (error instanceof TeachingApiError) return { status: error.status, code: error.code, currentRevision: error.currentRevision, message: error.message }
  if (error instanceof ApiError) return { status: error.status, code: null, currentRevision: null, message: error.message }
  return { status: 0, code: null, currentRevision: null, message: error instanceof Error ? error.message : 'Something went wrong. Please try again.' }
}
/** A revision conflict: the platform code when the transport kept it, otherwise any 409 (the only 409s on these routes mean "reload"). */
export const isRevisionConflict = (error: unknown) => {
  const info = teachingErrorInfo(error)
  return info.code === 'REVISION_CONFLICT' || (info.status === 409 && (info.code === null || info.code === 'REVISION_CONFLICT'))
}
export const isDenied = (error: unknown) => { const { status } = teachingErrorInfo(error); return status === 403 || status === 404 }
export const isUnavailable = (error: unknown) => { const { status } = teachingErrorInfo(error); return status === 503 || status === 0 || status === 502 }

/** Reasons for the codes a teacher can act on. Anything else falls back to the transport's safe message. */
const messages: Record<string, string> = {
  REVISION_CONFLICT: 'This plan changed somewhere else. Reload to see the latest, then try again.',
  PLAN_STRUCTURE_FROZEN: 'A published plan keeps its structure so students see what you published. You can still add material, write lessons and set due dates.',
  PLAN_NOT_READY: 'This plan is not ready to publish yet. Fix the items marked as errors first.',
  PLAN_IN_USE: 'Students are already enrolled, so this plan cannot be taken back to a draft or archived.',
  REMOVAL_NEEDS_CONFIRMATION: 'That item has material, questions or a lesson. Confirm to remove it.',
  CLASS_NOT_ASSIGNED: 'You are not assigned to that class. Ask your school administrator.',
  SUBJECT_NOT_ASSIGNED: 'You are not assigned to teach that subject in this class. Ask your school administrator.',
  CURRICULUM_NOT_LOADED: 'The school curriculum is not loaded for this class and subject yet. Start from scratch or use an outline.',
  OUTLINE_INVALID: 'The outline could not be read. Use one phase per line and indent the topics under it.',
  IDEMPOTENCY_KEY_REUSED: 'That request was already used with different details. Check the form and try again.',
  TEACHER_AI_UNAVAILABLE: 'Co drafting for teachers is not available yet.',
  TEACHING_UNAVAILABLE: 'The teaching workspace is not switched on for your school yet.',
  PLAN_NOT_FOUND: 'This plan was not found, or you no longer have access to it.',
  PLAN_NOT_PUBLISHED: 'Publish the plan before assigning it to a class.',
  CLASS_TOO_LARGE: 'This class has more than 100 active students, which is more than can be assigned at once.',
  ASSIGNMENT_NOT_OWNED: 'Your school administrator created this assignment, so only they can remove it.',
}
export function teachingErrorText(error: unknown): string {
  const info = teachingErrorInfo(error)
  return (info.code ? messages[info.code] : undefined) ?? info.message
}

/**
 * One idempotency key per user intent. The same request body keeps its key across retries (so a retry never duplicates
 * a side effect); a changed body gets a fresh key (the server refuses a reused key with a different body); `done()` ends the intent.
 */
export class IntentKey {
  private current: { fingerprint: string; key: string } | null = null
  keyFor(body: unknown): string {
    const fingerprint = JSON.stringify(body ?? null)
    if (!this.current || this.current.fingerprint !== fingerprint) this.current = { fingerprint, key: newKey() }
    return this.current.key
  }
  done() { this.current = null }
}
export const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `key-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`)
export const idempotent = (key: string = newKey()) => ({ 'Idempotency-Key': key })

/* ---------- requests ---------- */

export type NewPlanSource =
  | { kind: 'SCRATCH' }
  | { kind: 'CURRICULUM'; curriculumSubjectId: string; chapterIds?: string[] }
  | { kind: 'OUTLINE'; text: string }
export interface CreatePlanInput { title: string; description?: string; classId: string; subject: string; targetBand?: Band; source: NewPlanSource }
export interface ListPlansParams { classId?: string; status?: PlanStatus; q?: string; cursor?: string | null; limit?: number }

export const listQuery = (params: ListPlansParams) => {
  const query = new URLSearchParams()
  query.set('limit', String(params.limit ?? 20))
  if (params.classId) query.set('classId', params.classId)
  if (params.status) query.set('status', params.status)
  const q = params.q?.trim().slice(0, 100)
  if (q) query.set('q', q)
  if (params.cursor) query.set('cursor', params.cursor)
  return query.toString()
}

/** A tree node in the shape `PUT /plans/:planId/tree` takes (the legacy TreeNodeDto; counts and dates are not sent). */
export interface TreeNodeDto { id: string; kind: PlanTreeNode['kind']; title: string; description?: string; prerequisiteTopicIds: string[]; children: TreeNodeDto[] }
export const toTreeDto = (nodes: PlanTreeNode[]): TreeNodeDto[] => nodes.map(node => ({
  id: node.id, kind: node.kind, title: node.title, ...(node.description ? { description: node.description } : {}),
  prerequisiteTopicIds: node.prerequisiteTopicIds, children: toTreeDto(node.children),
}))

const planPath = (planId: string) => `/plans/${encodeURIComponent(planId)}`

export function plansApi(request: TeachingRequest) {
  const get = async <T>(schema: z.ZodType<T>, suffix: string) => parseResponse(schema, await request<unknown>(suffix))
  const send = async <T>(schema: z.ZodType<T>, suffix: string, method: TeachingMethod, body: unknown, key?: string) =>
    parseResponse(schema, await request<unknown>(suffix, method, body, idempotent(key)))
  return {
    context: () => get(teachingContextSchema, '/context'),
    list: (params: ListPlansParams = {}) => get(planListSchema, `/plans?${listQuery(params)}`),
    get: (planId: string) => get(planDetailSchema, planPath(planId)),
    create: (input: CreatePlanInput, key: string) => send(planDetailSchema, '/plans', 'POST', input, key),
    update: (planId: string, body: { expectedRevision: number; title?: string; description?: string; targetBand?: Band }) =>
      send(planDetailSchema, planPath(planId), 'PATCH', body),
    putTree: (planId: string, body: { expectedRevision: number; tree: TreeNodeDto[]; confirmRemoveNodeIds?: string[] }) =>
      send(planDetailSchema, `${planPath(planId)}/tree`, 'PUT', body),
    publish: (planId: string, expectedRevision: number, key?: string) => send(planDetailSchema, `${planPath(planId)}/publish`, 'POST', { expectedRevision }, key),
    unpublish: (planId: string, expectedRevision: number, key?: string) => send(planDetailSchema, `${planPath(planId)}/unpublish`, 'POST', { expectedRevision }, key),
    archive: (planId: string, expectedRevision: number, key?: string) => send(planDetailSchema, `${planPath(planId)}/archive`, 'POST', { expectedRevision }, key),
  }
}
export type PlansApi = ReturnType<typeof plansApi>

/* ---------- pure helpers ---------- */

/** Class 1-4 -> 6-9, 5-8 -> 10-13, 9-10 -> 14-17 (a suggestion only, never enforced). */
export const defaultBandForGrade = (grade: number): Band => grade <= 4 ? '6-9' : grade <= 8 ? '10-13' : '14-17'

export interface OutlineProblem { line: number; message: string }
/**
 * The same limits as the server's deterministic outline parser: a non-indented line is a phase; an indented line or one that
 * starts with `-`, `*` or `1.` is a topic; at most 20 phases and 200 topics; at most 8000 characters. Used to point at the
 * offending line before the request; the server stays the authority.
 */
export function checkOutline(text: string): OutlineProblem | null {
  if (text.length > 8000) return { line: 1, message: 'The outline is longer than 8000 characters.' }
  let phases = 0
  let topics = 0
  const lines = text.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index]!
    if (raw.trim() === '') continue
    const topic = /^\s+\S/.test(raw) || /^\s*(?:[-*]|\d+[.)])\s+\S/.test(raw)
    if (topic) {
      if (phases === 0) return { line: index + 1, message: 'A topic needs a phase above it. Start with an unindented phase line.' }
      topics += 1
    } else phases += 1
    if (phases > 20) return { line: index + 1, message: 'An outline has at most 20 phases.' }
    if (topics > 200) return { line: index + 1, message: 'An outline has at most 200 topics.' }
  }
  if (phases === 0) return { line: 1, message: 'Add at least one phase.' }
  return null
}
