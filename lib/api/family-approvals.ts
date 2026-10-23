import { z } from 'zod'

/**
 * B12A guardian approval of pending enrolments (F-P4-01, F-P4-03 to F-P4-06, F-P4-08).
 * Contract: agents/contracts/B12A-guardian-enrolment-approval.md. Every response is Zod-parsed; a response that does
 * not match renders nothing and shows a safe error. Unknown extra keys are dropped (the platform may add fields).
 */
const text = z.string().max(2000)
const shortText = z.string().min(1).max(300)
const iso = z.iso.datetime({ offset: true })
const requestId = z.string().min(1).max(100)

export const approvalKinds = ['TEACHER_ASSIGNMENT', 'SCHOOL_ASSIGNMENT', 'JOIN_CODE'] as const
export const approvalStates = ['PENDING', 'APPROVED', 'DECLINED', 'REVOKED', 'SUPERSEDED'] as const
export const approvalDecisions = ['APPROVE', 'DECLINE', 'REVOKE'] as const
export type ApprovalState = (typeof approvalStates)[number]
export type ApprovalDecisionKind = (typeof approvalDecisions)[number]

const decisionEntry = z.object({ decision: z.enum(approvalDecisions), by: shortText, at: iso })

export const approvalRequestSchema = z.object({
  id: requestId,
  kind: z.enum(approvalKinds),
  state: z.enum(approvalStates),
  child: z.object({ profileId: requestId, nickname: shortText }),
  school: z.object({ id: requestId, name: shortText }).nullable(),
  className: shortText.nullable(),
  subject: shortText.nullable(),
  plan: z.object({ title: shortText, topicCount: z.number().int().min(0), dueAt: iso.nullable() }),
  requestedBy: z.object({ displayName: shortText, role: z.enum(['TEACHER', 'SCHOOL_ADMIN']) }).nullable(),
  requestedAt: iso,
  disclosure: z.object({ teacherSees: z.array(text).max(20), teacherDoesNotSee: z.array(text).max(20) }),
  decision: decisionEntry.nullable(),
  history: z.array(decisionEntry).max(100),
  actions: z.object({ canApprove: z.boolean(), canDecline: z.boolean(), canRevoke: z.boolean(), reason: text.nullable() }),
})
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>

export const approvalListSchema = z.object({ items: z.array(approvalRequestSchema).max(200) })
export const approvalSummarySchema = z.object({ pendingCount: z.number().int().min(0) })
export const approvalDecisionResultSchema = z.object({ request: approvalRequestSchema, changed: z.boolean() })
export type ApprovalDecisionResult = z.infer<typeof approvalDecisionResultSchema>

export type ApprovalListState = 'pending' | 'history'
export type ApprovalIntent = 'APPROVE' | 'DECLINE' | 'REVOKE'

export class ApprovalsError extends Error {
  constructor(readonly status: number, message: string, readonly code?: string, readonly request?: ApprovalRequest) { super(message); this.name = 'ApprovalsError' }
  /** The request is gone for this guardian, or never was theirs; the server answers both the same way. */
  get notFound() { return this.status === 404 }
  get denied() { return this.status === 401 || this.status === 403 }
}

const invalid = () => new ApprovalsError(502, 'Approval details could not be shown because the service sent an unexpected response. Nothing was displayed. Please try again later.', 'APPROVALS_INVALID')

export function parseWith<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) throw invalid()
  return result.data
}

const safeMessages: Record<string, string> = {
  ALREADY_DECIDED: 'This request was already decided. The recorded decision is shown below.',
  POLICY_BLOCKED: 'Approval is not possible right now because the school’s current rules do not allow this plan for your child. Nothing changed.',
  REQUEST_SUPERSEDED: 'The teacher or school took this request back before it was decided. Nothing changed.',
  NOT_REVOCABLE: 'This approval can no longer be taken back because it is not active. Refresh to see its current state.',
  IDEMPOTENCY_KEY_REUSED: 'This action could not be matched to your earlier attempt. Refresh and review the request before trying again.',
  REQUEST_NOT_FOUND: 'This request is unavailable, or you do not have access to it.',
}
function messageFor(status: number, code?: string) {
  if (code && safeMessages[code]) return safeMessages[code]!
  if (status === 401) return 'Please sign in again to continue.'
  if (status === 403) return 'Approving needs a verified guardian with current consent for this child.'
  if (status === 404) return safeMessages.REQUEST_NOT_FOUND!
  if (status === 409) return 'This request has changed. Refresh and review it before trying again.'
  if (status === 429) return 'Too many tries. Please wait a moment and try again.'
  return 'Approvals are unavailable right now. Nothing was changed; please try again.'
}

async function call(path: string, init: { method: 'GET' | 'POST'; body?: unknown; idempotencyKey?: string }): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`/api/family-approvals/${path}`, {
      method: init.method,
      headers: { 'Content-Type': 'application/json', ...(init.idempotencyKey ? { 'Idempotency-Key': init.idempotencyKey } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store', signal: AbortSignal.timeout(15000),
    })
  } catch { throw new ApprovalsError(503, 'Approvals are unavailable right now. Nothing was changed; please try again.', 'UNAVAILABLE') }
  const json: unknown = await response.json().catch(() => null)
  const record = json && typeof json === 'object' ? json as Record<string, unknown> : {}
  if (!response.ok) {
    const code = typeof record.code === 'string' ? record.code : undefined
    let request: ApprovalRequest | undefined
    if (response.status === 409 && record.request) {
      const parsed = approvalRequestSchema.safeParse(record.request)
      if (parsed.success) request = parsed.data
    }
    throw new ApprovalsError(response.status, messageFor(response.status, code), code, request)
  }
  return record.data ?? json
}

export const approvalsListPath = (state: ApprovalListState, childProfileId?: string | null) => {
  const query = new URLSearchParams({ state })
  if (childProfileId) query.set('childProfileId', childProfileId)
  return `?${query}`
}
export const fetchApprovals = async (state: ApprovalListState, childProfileId?: string | null) => parseWith(approvalListSchema, await call(approvalsListPath(state, childProfileId), { method: 'GET' })).items
export const fetchApproval = async (id: string) => parseWith(approvalRequestSchema, await call(encodeURIComponent(id), { method: 'GET' }))
export const fetchApprovalSummary = async () => parseWith(approvalSummarySchema, await call('summary', { method: 'GET' }))
export async function submitDecision(id: string, decision: 'APPROVE' | 'DECLINE', idempotencyKey: string) {
  return parseWith(approvalDecisionResultSchema, await call(`${encodeURIComponent(id)}/decision`, { method: 'POST', body: { decision }, idempotencyKey }))
}
export async function submitRevoke(id: string, idempotencyKey: string) {
  return parseWith(approvalDecisionResultSchema, await call(`${encodeURIComponent(id)}/revoke`, { method: 'POST', body: {}, idempotencyKey }))
}

/** One key per (request, intent). A retry of the same intent reuses it; a new intent gets a new key. */
export class IntentKeys {
  private keys = new Map<string, string>()
  keyFor(id: string, intent: ApprovalIntent) {
    const slot = `${id}:${intent}`
    let key = this.keys.get(slot)
    if (!key) { key = globalThis.crypto.randomUUID(); this.keys.set(slot, key) }
    return key
  }
  /** Called once the server has answered definitively, so a later deliberate action is a new intent. */
  release(id: string, intent: ApprovalIntent) { this.keys.delete(`${id}:${intent}`) }
}

export const stateLabel: Record<ApprovalState, string> = { PENDING: 'Waiting for you', APPROVED: 'Approved', DECLINED: 'Declined', REVOKED: 'Access removed', SUPERSEDED: 'Withdrawn by the teacher' }
export const decisionLabel: Record<ApprovalDecisionKind, string> = { APPROVE: 'Approved', DECLINE: 'Declined', REVOKE: 'Access removed' }
export const requesterRoleLabel = { TEACHER: 'Teacher', SCHOOL_ADMIN: 'School administrator' } as const
export const kindLabel: Record<(typeof approvalKinds)[number], string> = { TEACHER_ASSIGNMENT: 'Teacher assigned this plan', SCHOOL_ASSIGNMENT: 'School assigned this plan', JOIN_CODE: 'Joined with a class code' }
