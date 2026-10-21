import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), cookie: vi.fn(), fetch: vi.fn() }))
vi.mock('@/lib/auth/config', () => ({ auth: mocks.auth }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.cookie }) }))
vi.mock('@/lib/api/platform-client', () => ({ platformApiBaseUrl: () => 'https://platform.test/api/v1' }))
import { GET, POST } from '@/app/api/learn/[[...path]]/route'
const context = (path?: string[]) => ({ params: Promise.resolve({ path }) })
const membership = '11111111-1111-4111-8111-111111111111'
const post = (body = '{"code":"ABC"}', origin = 'https://web.test') => new NextRequest('https://web.test/api/learn/enrollments/join', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body })
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('fetch', mocks.fetch)
  mocks.auth.mockResolvedValue({ accessToken: 'server-session-token', user: { id: 'learner-a' } })
  mocks.cookie.mockImplementation(name => name === 'colearner-school-membership' ? { value: membership } : undefined)
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }))
})
describe('learn BFF forwarding', () => {
  it('forwards the three reads with fresh server credentials, the selected membership and no client authority', async () => {
    for (const path of [['home'], ['overview'], ['plans', 'plan-1']]) {
      mocks.fetch.mockClear()
      const response = await GET(new NextRequest(`https://web.test/api/learn/${path.join('/')}`), context(path))
      const [url, request] = mocks.fetch.mock.calls[0]!
      expect(url).toBe(`https://platform.test/api/v1/learn/${path.join('/')}`)
      expect(request.headers).toMatchObject({ Authorization: 'Bearer server-session-token', 'X-School-Membership-Id': membership })
      expect(request.redirect).toBe('error')
      expect(response.headers.get('cache-control')).toBe('no-store')
    }
  })
  it('keeps only allowed overview query parameters and drops everything else', async () => {
    await GET(new NextRequest('https://web.test/api/learn/overview?q=ma&subjectId=s1&kind=ASSIGNED&status=ACTIVE&cursor=c&limit=20&learnerId=other&orgId=x'), context(['overview']))
    expect(mocks.fetch.mock.calls[0]?.[0]).toBe('https://platform.test/api/v1/learn/overview?q=ma&subjectId=s1&kind=ASSIGNED&status=ACTIVE&cursor=c&limit=20')
    mocks.fetch.mockClear()
    await GET(new NextRequest('https://web.test/api/learn/home?learnerId=other'), context(['home']))
    expect(mocks.fetch.mock.calls[0]?.[0]).toBe('https://platform.test/api/v1/learn/home')
  })
  it('posts the join body unchanged after a same-origin check', async () => {
    await POST(post(), context(['enrollments', 'join']))
    const [url, request] = mocks.fetch.mock.calls[0]!
    expect(url).toBe('https://platform.test/api/v1/learn/enrollments/join')
    expect(request.method).toBe('POST')
    expect(request.body).toBe('{"code":"ABC"}')
    expect(request.headers['Content-Type']).toBe('application/json')
  })
  it('refuses cross-origin and origin-less writes before reading any credential', async () => {
    expect((await POST(post('{}', 'https://other.test'), context(['enrollments', 'join']))).status).toBe(403)
    const noOrigin = new NextRequest('https://web.test/api/learn/enrollments/join', { method: 'POST', body: '{}' })
    expect((await POST(noOrigin, context(['enrollments', 'join']))).status).toBe(403)
    expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it('allowlists operations: unknown paths, wrong methods and traversal are 404', async () => {
    for (const path of [['anything'], ['home', 'extra'], ['plans'], ['plans', '../x'], ['enrollments', 'join'], ['onboarding'], ['plans', 'a', 'edit']]) {
      expect((await GET(new NextRequest('https://web.test/api/learn/x'), context(path))).status).toBe(404)
    }
    expect((await POST(post(), context(['home']))).status).toBe(404)
    expect((await POST(post(), context(['plans', 'plan-1']))).status).toBe(404)
    expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it('requires an authenticated session', async () => {
    mocks.auth.mockResolvedValue(null)
    expect((await GET(new NextRequest('https://web.test/api/learn/home'), context(['home']))).status).toBe(401)
    mocks.auth.mockResolvedValue({ accessToken: 'token' })
    expect((await GET(new NextRequest('https://web.test/api/learn/home'), context(['home']))).status).toBe(401)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it('lets a selected child cookie win: opaque credential, no school selector, no adult session read', async () => {
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: 'opaque-child-session' } : { value: membership })
    await GET(new NextRequest('https://web.test/api/learn/home'), context(['home']))
    expect(mocks.auth).not.toHaveBeenCalled()
    expect(mocks.fetch.mock.calls[0]?.[1].headers).toMatchObject({ Authorization: 'Bearer opaque-child-session' })
    expect(mocks.fetch.mock.calls[0]?.[1].headers).not.toHaveProperty('X-School-Membership-Id')
  })
  it('fails closed for an empty or revoked child even when an adult session exists', async () => {
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: '' } : undefined)
    expect((await GET(new NextRequest('https://web.test/api/learn/home'), context(['home']))).status).toBe(401)
    expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled()
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: 'revoked-child' } : undefined)
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ message: 'Expired child session' }), { status: 401 }))
    expect((await GET(new NextRequest('https://web.test/api/learn/home'), context(['home']))).status).toBe(401)
    expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })
  it('fails closed on an invalid selected membership and hides backend exceptions', async () => {
    mocks.cookie.mockImplementation(name => name === 'colearner-school-membership' ? { value: 'not-a-membership' } : undefined)
    expect((await GET(new NextRequest('https://web.test/api/learn/home'), context(['home']))).status).toBe(403)
    mocks.cookie.mockReturnValue(undefined); mocks.fetch.mockRejectedValue(new Error('private connection string'))
    const response = await GET(new NextRequest('https://web.test/api/learn/home'), context(['home']))
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('private connection string')
  })
  it('relays backend error status without rewriting or replaying the join', async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ code: 'CODE_EXPIRED' }), { status: 410 }))
    const response = await POST(post(), context(['enrollments', 'join']))
    expect(response.status).toBe(410)
    expect(await response.json()).toEqual({ code: 'CODE_EXPIRED' })
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })
})
