import type { ApprovalRequest } from '@/lib/api/family-approvals'

/** Synthetic server for the B12A development harness and tests. Mirrors the contract; no real child or API is involved. */
export const approvalScenarios = ['default', 'empty', 'denied', 'unavailable', 'invalid', 'flaky-decision', 'already-decided', 'policy-blocked', 'superseded-on-decide', 'not-found'] as const
export type ApprovalScenario = (typeof approvalScenarios)[number]

export interface MockCall { method: string; path: string; key: string | null; body: unknown }
export interface MockReply { status: number; body: unknown }

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const at = (days: number) => new Date(Date.UTC(2026, 9, 22, 9, 0, 0) + days * 86_400_000).toISOString()
const disclosure = {
  teacherSees: ['Progress in this plan', 'Answers to the checks in this plan', 'Due dates you can see on the plan'],
  teacherDoesNotSee: ['Conversations with Co', 'Other plans', 'Personal details'],
}
const actions = (state: ApprovalRequest['state']) => ({
  canApprove: state === 'PENDING', canDecline: state === 'PENDING', canRevoke: state === 'APPROVED',
  reason: state === 'DECLINED' ? 'Declined requests are not reopened here. The teacher or school can send a new request.' : state === 'REVOKED' ? 'Access was removed. The teacher or school can send a new request.' : state === 'SUPERSEDED' ? 'The teacher took this request back.' : null,
})
export function makeRequest(n: number, overrides: Partial<ApprovalRequest> & { state?: ApprovalRequest['state'] } = {}): ApprovalRequest {
  const state = overrides.state ?? 'PENDING'
  return {
    id: id(n), kind: 'TEACHER_ASSIGNMENT', state,
    child: { profileId: id(900), nickname: 'Student' },
    school: { id: id(800), name: 'Review School A' },
    className: 'Class 3 B03', subject: 'Mathematics',
    plan: { title: `Fractions plan ${n}`, topicCount: 4, dueAt: at(14) },
    requestedBy: { displayName: 'Review teacher', role: 'TEACHER' }, requestedAt: at(-1),
    disclosure, decision: null, history: [], actions: actions(state),
    ...overrides,
  }
}
const decided = (request: ApprovalRequest, decision: 'APPROVE' | 'DECLINE' | 'REVOKE', by = 'Review Parent'): ApprovalRequest => {
  const state = decision === 'APPROVE' ? 'APPROVED' : decision === 'DECLINE' ? 'DECLINED' : 'REVOKED'
  const entry = { decision, by, at: at(0) }
  return { ...request, state, decision: entry, history: [...request.history, entry], actions: actions(state) }
}

export function createApprovalsMock(scenario: ApprovalScenario) {
  const calls: MockCall[] = []
  const replays = new Map<string, MockReply>()
  let flakyFailed = false
  const sibling = { profileId: id(901), nickname: 'Sibling' }
  const store = new Map<string, ApprovalRequest>()
  if (scenario !== 'empty') {
    ;[
      makeRequest(1), makeRequest(2, { child: sibling, className: 'Class 6', subject: 'Science' }),
      decided(makeRequest(3, { plan: { title: 'Earlier plan', topicCount: 2, dueAt: null } }), 'APPROVE'),
      decided(makeRequest(4), 'DECLINE'),
      makeRequest(5, { state: 'SUPERSEDED', requestedBy: null }),
    ].forEach(request => store.set(request.id, request))
  }
  const list = (state: string | null) => [...store.values()].filter(r => state === 'history' ? r.state !== 'PENDING' : r.state === 'PENDING')
  const err = (status: number, code?: string, extra?: object): MockReply => ({ status, body: { message: 'Request failed.', ...(code ? { code } : {}), ...extra } })

  function handle(method: string, pathWithQuery: string, key: string | null, body: unknown): MockReply {
    calls.push({ method, path: pathWithQuery, key, body })
    const url = new URL(pathWithQuery, 'http://mock.local')
    const segments = url.pathname.replace(/^\/api\/family-approvals\/?/, '').split('/').filter(Boolean)
    if (scenario === 'denied') return err(403)
    if (scenario === 'unavailable' && method === 'GET') return err(503)
    if (method === 'GET' && segments.length === 0) {
      if (scenario === 'invalid') return { status: 200, body: { data: { items: [{ id: 'x', state: 'MAYBE' }] } } }
      return { status: 200, body: { data: { items: list(url.searchParams.get('state')) } } }
    }
    if (method === 'GET' && segments[0] === 'summary') return { status: 200, body: { data: { pendingCount: list('pending').length } } }
    const request = store.get(segments[0] ?? '')
    if (!request || scenario === 'not-found') return err(404, 'REQUEST_NOT_FOUND')
    if (method === 'GET') return { status: 200, body: { data: request } }
    if (!key) return err(400, 'IDEMPOTENCY_KEY_REQUIRED')
    const replay = replays.get(key)
    if (replay) {
      const data = replay.body as { data: { request: ApprovalRequest } }
      return { status: 200, body: { data: { request: data.data.request, changed: false } } }
    }
    if (scenario === 'flaky-decision' && !flakyFailed) { flakyFailed = true; return err(503) }
    const decision = segments[1] === 'revoke' ? 'REVOKE' : (body as { decision?: 'APPROVE' | 'DECLINE' }).decision
    if (!decision) return err(400)
    if (scenario === 'already-decided' && request.state === 'PENDING') {
      const other = decided(request, 'APPROVE', 'Other Guardian')
      store.set(request.id, other)
      return err(409, 'ALREADY_DECIDED', { request: other })
    }
    if (scenario === 'policy-blocked' && decision === 'APPROVE') return err(409, 'POLICY_BLOCKED')
    if (scenario === 'superseded-on-decide' && request.state === 'PENDING') { store.set(request.id, { ...request, state: 'SUPERSEDED', actions: actions('SUPERSEDED') }); return err(409, 'REQUEST_SUPERSEDED') }
    if (decision === 'REVOKE' ? request.state !== 'APPROVED' : request.state !== 'PENDING') return err(409, decision === 'REVOKE' ? 'NOT_REVOCABLE' : 'ALREADY_DECIDED', decision === 'REVOKE' ? undefined : { request })
    const next = decided(request, decision)
    store.set(request.id, next)
    const reply: MockReply = { status: 200, body: { data: { request: next, changed: true } } }
    replays.set(key, reply)
    return reply
  }
  return { handle, calls, store }
}
