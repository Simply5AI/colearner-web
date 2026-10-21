import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), cookie: vi.fn(), fetch: vi.fn() }))
vi.mock('@/lib/auth/config', () => ({ auth: mocks.auth }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.cookie }) }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) } }))
vi.mock('@/lib/api/platform-client', () => ({ platformApiBaseUrl: () => 'https://platform.test/api/v1' }))
import * as route from '@/app/api/onboarding/[[...path]]/route'
const { GET, POST, PUT } = route
const context = (path?: string[]) => ({ params: Promise.resolve({ path }) })
const membership = '11111111-1111-4111-8111-111111111111'
const write = (path: string, method: 'PUT' | 'POST', init: { origin?: string; type?: string; body?: string } = {}) => new NextRequest(`https://web.test/api/onboarding${path}`, { method, headers: { origin: init.origin ?? 'https://web.test', 'content-type': init.type ?? 'application/json' }, body: init.body ?? '{}' })
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('fetch', mocks.fetch)
  mocks.auth.mockResolvedValue({ accessToken: 'server-session-token', user: { id: 'learner-a' } })
  mocks.cookie.mockImplementation(name => name === 'colearner-school-membership' ? { value: membership } : undefined)
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }))
})

describe('onboarding BFF allowlist', () => {
  it('exports only GET, PUT and POST', () => { expect(Object.keys(route).filter(key => /^[A-Z]+$/.test(key)).sort()).toEqual(['GET', 'POST', 'PUT']) })
  it.each([
    ['GET', [], 'https://platform.test/api/v1/learn/onboarding'],
    ['PUT', [], 'https://platform.test/api/v1/learn/onboarding'],
    ['POST', ['complete'], 'https://platform.test/api/v1/learn/onboarding/complete'],
    ['POST', ['skip'], 'https://platform.test/api/v1/learn/onboarding/skip'],
  ] as const)('forwards %s /%s to the learn onboarding endpoint only', async (method, segments, upstream) => {
    const path = segments.length ? `/${segments.join('/')}` : ''
    const request = method === 'GET' ? new NextRequest(`https://web.test/api/onboarding${path}?ignored=1`) : write(path, method)
    const response = await (method === 'GET' ? GET : method === 'PUT' ? PUT : POST)(request, context([...segments]))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(mocks.fetch.mock.calls[0]?.[0]).toBe(upstream)
    expect(mocks.fetch.mock.calls[0]?.[1]).toMatchObject({ method, redirect: 'error', headers: { Authorization: 'Bearer server-session-token', 'X-School-Membership-Id': membership } })
  })
  it.each([['learn'], ['complete', 'again'], ['skip', 'x'], ['..', 'materials'], ['__proto__'], ['constructor'], ['config'], ['%2e%2e']])('returns 404 for /%s without any upstream call', async (...segments) => {
    expect((await GET(new NextRequest('https://web.test/api/onboarding/x'), context(segments))).status).toBe(404)
    expect((await POST(write('/x', 'POST'), context(segments))).status).toBe(404)
    expect(mocks.fetch).not.toHaveBeenCalled(); expect(mocks.auth).not.toHaveBeenCalled()
  })
  it('rejects methods outside each operation', async () => {
    expect((await POST(write('', 'POST'), context())).status).toBe(405)
    expect((await GET(new NextRequest('https://web.test/api/onboarding/complete'), context(['complete']))).status).toBe(405)
    expect((await PUT(write('/skip', 'PUT'), context(['skip']))).status).toBe(405)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it('requires same-origin JSON writes of bounded size', async () => {
    expect((await PUT(write('', 'PUT', { origin: 'https://other.test' }), context())).status).toBe(403)
    expect((await POST(new NextRequest('https://web.test/api/onboarding/complete', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } }), context(['complete']))).status).toBe(403)
    expect((await PUT(write('', 'PUT', { type: 'text/plain' }), context())).status).toBe(415)
    expect((await PUT(write('', 'PUT', { body: `{"x":"${'a'.repeat(20000)}"}` }), context())).status).toBe(413)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it('forwards the JSON body unchanged', async () => {
    await PUT(write('', 'PUT', { body: '{"step":"HELLO","draft":{}}' }), context())
    expect(mocks.fetch.mock.calls[0]?.[1].body).toBe('{"step":"HELLO","draft":{}}')
    expect(mocks.fetch.mock.calls[0]?.[1].headers['Content-Type']).toBe('application/json')
  })
})

describe('onboarding BFF credentials', () => {
  it('lets a selected child cookie win, with no adult fallback and no school selector', async () => {
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: 'opaque-child-session' } : { value: membership })
    await GET(new NextRequest('https://web.test/api/onboarding'), context())
    expect(mocks.auth).not.toHaveBeenCalled()
    expect(mocks.fetch.mock.calls[0]?.[1].headers).toMatchObject({ Authorization: 'Bearer opaque-child-session' })
    expect(mocks.fetch.mock.calls[0]?.[1].headers).not.toHaveProperty('X-School-Membership-Id')
  })
  it('fails closed for an empty child selection even with an adult session', async () => {
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: '' } : undefined)
    expect((await GET(new NextRequest('https://web.test/api/onboarding'), context())).status).toBe(401)
    expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it('passes through a revoked child 401 without retrying as the adult', async () => {
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: 'revoked' } : undefined)
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ message: 'expired' }), { status: 401 }))
    expect((await GET(new NextRequest('https://web.test/api/onboarding'), context())).status).toBe(401)
    expect(mocks.fetch).toHaveBeenCalledTimes(1); expect(mocks.auth).not.toHaveBeenCalled()
  })
  it('requires a session and a well-formed membership selection', async () => {
    mocks.auth.mockResolvedValue(null)
    expect((await GET(new NextRequest('https://web.test/api/onboarding'), context())).status).toBe(401)
    mocks.auth.mockResolvedValue({ accessToken: 'server-session-token', user: { id: 'learner-a' } })
    mocks.cookie.mockImplementation(name => name === 'colearner-school-membership' ? { value: 'forged' } : undefined)
    expect((await GET(new NextRequest('https://web.test/api/onboarding'), context())).status).toBe(403)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it('hides network details and does not replay writes', async () => {
    mocks.fetch.mockRejectedValue(new Error('private connection string'))
    const response = await POST(write('/complete', 'POST'), context(['complete']))
    expect(response.status).toBe(503); expect(await response.text()).not.toContain('private connection string')
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })
})
