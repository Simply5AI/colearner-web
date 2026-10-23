import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  ApprovalsError, IntentKeys, approvalListSchema, approvalRequestSchema, approvalsListPath, fetchApprovals, parseWith, submitDecision, submitRevoke,
} from '@/lib/api/family-approvals'
import { createApprovalsMock, makeRequest } from '@/components/family/approvals/dev/approvals-mock'

const respond = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))
afterEach(() => vi.restoreAllMocks())

describe('approval schemas', () => {
  it('accepts the contract shape and drops unknown keys', () => {
    const parsed = approvalRequestSchema.parse({ ...makeRequest(1), extra: 'x' })
    expect(parsed).not.toHaveProperty('extra')
    expect(parsed.actions.canApprove).toBe(true)
  })
  it('rejects a wrong state, a non-iso date and a missing disclosure', () => {
    expect(approvalRequestSchema.safeParse({ ...makeRequest(1), state: 'MAYBE' }).success).toBe(false)
    expect(approvalRequestSchema.safeParse({ ...makeRequest(1), requestedAt: 'yesterday' }).success).toBe(false)
    const rest: Record<string, unknown> = { ...makeRequest(1) }
    delete rest.disclosure
    expect(approvalRequestSchema.safeParse(rest).success).toBe(false)
  })
  it('parses every mock scenario list', () => {
    for (const state of ['pending', 'history']) {
      const mock = createApprovalsMock('default')
      const reply = mock.handle('GET', `/api/family-approvals/?state=${state}`, null, undefined)
      expect(approvalListSchema.safeParse((reply.body as { data: unknown }).data).success).toBe(true)
    }
  })
  it('turns a bad response into a safe error', () => {
    expect(() => parseWith(approvalListSchema, { items: [{ id: 'x' }] })).toThrowError(ApprovalsError)
  })
})

describe('requests', () => {
  it('builds the list path', () => {
    expect(approvalsListPath('pending')).toBe('?state=pending')
    expect(approvalsListPath('history', 'abc')).toBe('?state=history&childProfileId=abc')
  })
  it('sends the Idempotency-Key header and the decision body, and parses the result', async () => {
    const request = makeRequest(1)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => respond(200, { data: { request: { ...request, state: 'APPROVED' }, changed: true } }))
    const result = await submitDecision(request.id, 'APPROVE', 'key-12345678')
    expect(result.changed).toBe(true)
    const [url, init] = fetchSpy.mock.calls[0]!
    expect(String(url)).toBe(`/api/family-approvals/${request.id}/decision`)
    expect((init!.headers as Record<string, string>)['Idempotency-Key']).toBe('key-12345678')
    expect(init!.body).toBe('{"decision":"APPROVE"}')
  })
  it('posts revoke with an empty body', async () => {
    const request = makeRequest(1, { state: 'APPROVED' })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => respond(200, { data: { request, changed: true } }))
    await submitRevoke(request.id, 'key-12345678')
    expect(String(fetchSpy.mock.calls[0]![0])).toBe(`/api/family-approvals/${request.id}/revoke`)
  })
  it('carries the already-decided request on a 409', async () => {
    const decided = makeRequest(1, { state: 'APPROVED' })
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => respond(409, { message: 'Request failed.', code: 'ALREADY_DECIDED', request: decided }))
    const error = (await submitDecision(decided.id, 'DECLINE', 'key-12345678').catch(e => e)) as ApprovalsError
    expect(error).toBeInstanceOf(ApprovalsError)
    expect(error.code).toBe('ALREADY_DECIDED')
    expect(error.request?.state).toBe('APPROVED')
  })
  it('maps 404, 403 and network failures without leaking server text', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => respond(404, { message: 'secret internal' }))
    const notFound = (await fetchApprovals('pending').catch(e => e)) as ApprovalsError
    expect(notFound.notFound).toBe(true)
    expect(notFound.message).not.toContain('secret')
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => respond(403, {}))
    expect(((await fetchApprovals('pending').catch(e => e)) as ApprovalsError).denied).toBe(true)
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => Promise.reject(new TypeError('offline')))
    expect(((await fetchApprovals('pending').catch(e => e)) as ApprovalsError).status).toBe(503)
  })
})

describe('IntentKeys', () => {
  it('reuses a key per intent, separates intents and requests, and issues a new key after release', () => {
    const keys = new IntentKeys()
    const first = keys.keyFor('r1', 'APPROVE')
    expect(keys.keyFor('r1', 'APPROVE')).toBe(first)
    expect(keys.keyFor('r1', 'DECLINE')).not.toBe(first)
    expect(keys.keyFor('r2', 'APPROVE')).not.toBe(first)
    keys.release('r1', 'APPROVE')
    expect(keys.keyFor('r1', 'APPROVE')).not.toBe(first)
  })
})
