import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const auth = vi.fn()
vi.mock('@/lib/auth/config', () => ({ auth: () => auth() }))
import { familyApprovalsRoute } from '@/lib/api/family-approvals-route'

const ID = '00000000-0000-4000-8000-000000000001'
const make = (method: string, path: string, init: { headers?: Record<string, string>; body?: unknown } = {}) =>
  new NextRequest(`http://localhost:3001/api/family-approvals/${path}`, { method, headers: { origin: 'http://localhost:3001', ...init.headers }, body: init.body === undefined ? undefined : JSON.stringify(init.body) })
const run = (req: NextRequest, segments: string[]) => familyApprovalsRoute(req, { params: Promise.resolve({ path: segments }) })
let fetchSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  auth.mockResolvedValue({ accessToken: 'token-1' })
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ statusCode: 200, data: { pendingCount: 2 } }), { status: 200 }))
})

afterEach(() => vi.restoreAllMocks())

describe('family approvals BFF allowlist', () => {
  it('proxies the list, summary and detail GETs with the session token', async () => {
    expect((await run(make('GET', '?state=pending'), [])).status).toBe(200)
    expect(String(fetchSpy.mock.calls[0]![0])).toBe('http://localhost:3000/api/v1/family/approvals?state=pending')
    expect(((fetchSpy.mock.calls[0]![1] as RequestInit).headers as Record<string, string>).Authorization).toBe('Bearer token-1')
    await run(make('GET', 'summary'), ['summary'])
    expect(String(fetchSpy.mock.calls[1]![0])).toBe('http://localhost:3000/api/v1/family/approvals/summary')
    await run(make('GET', ID), [ID])
    expect(String(fetchSpy.mock.calls[2]![0])).toBe(`http://localhost:3000/api/v1/family/approvals/${ID}`)
  })
  it('refuses anything outside the allowlist without calling the API', async () => {
    for (const [method, segments] of [['GET', ['..', 'x']], ['GET', ['not-a-uuid']], ['DELETE', [ID]], ['POST', [ID]], ['POST', [ID, 'other']], ['GET', [ID, 'decision']], ['POST', ['summary']]] as const) {
      const response = await run(make(method, segments.join('/'), { headers: { 'idempotency-key': 'key-12345678' }, body: method === 'POST' ? {} : undefined }), [...segments])
      expect(response.status, `${method} ${segments.join('/')}`).toBe(404)
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })
  it('validates the list query', async () => {
    expect((await run(make('GET', '?state=all'), [])).status).toBe(400)
    expect((await run(make('GET', '?state=pending&childProfileId=zzz'), [])).status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
  it('needs a same-origin request, an Idempotency-Key and a valid decision for POST', async () => {
    const path = `${ID}/decision`
    expect((await run(make('POST', path, { headers: { origin: 'http://evil.test', 'idempotency-key': 'key-12345678' }, body: { decision: 'APPROVE' } }), [ID, 'decision'])).status).toBe(403)
    expect((await run(make('POST', path, { body: { decision: 'APPROVE' } }), [ID, 'decision'])).status).toBe(400)
    expect((await run(make('POST', path, { headers: { 'idempotency-key': 'key-12345678' }, body: { decision: 'REVOKE' } }), [ID, 'decision'])).status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect((await run(make('POST', path, { headers: { 'idempotency-key': 'key-12345678' }, body: { decision: 'DECLINE', extra: 1 } }), [ID, 'decision'])).status).toBe(200)
    const init = fetchSpy.mock.calls[0]![1] as RequestInit
    expect(init.body).toBe('{"decision":"DECLINE"}')
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('key-12345678')
  })
  it('requires a session and relays only the code and the recorded request on a 409', async () => {
    auth.mockResolvedValueOnce(null)
    expect((await run(make('GET', 'summary'), ['summary'])).status).toBe(401)
    fetchSpy.mockImplementationOnce(async () => new Response(JSON.stringify({ statusCode: 409, message: 'internal detail', code: 'ALREADY_DECIDED', request: { id: ID } }), { status: 409 }))
    const response = await run(make('POST', `${ID}/revoke`, { headers: { 'idempotency-key': 'key-12345678' }, body: {} }), [ID, 'revoke'])
    expect(response.status).toBe(409)
    const json = await response.json()
    expect(json).toEqual({ message: 'Request failed.', code: 'ALREADY_DECIDED', request: { id: ID } })
  })
  it('answers 503 when the API is unreachable', async () => {
    fetchSpy.mockImplementationOnce(async () => { throw new TypeError('down') })
    expect((await run(make('GET', 'summary'), ['summary'])).status).toBe(503)
  })
})
