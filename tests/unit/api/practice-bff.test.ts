import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), cookie: vi.fn(), fetch: vi.fn() }))
vi.mock('@/lib/auth/config', () => ({ auth: mocks.auth }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.cookie }) }))
vi.mock('@/lib/api/platform-client', () => ({ platformApiBaseUrl: () => 'https://platform.test/api/v1' }))
import * as route from '@/app/api/learn/[[...path]]/route'

const { DELETE, GET, POST, PUT } = route
const context = (path?: string[]) => ({ params: Promise.resolve({ path }) })
const membership = '11111111-1111-4111-8111-111111111111'
const origin = 'https://web.test'
const request = (method: string, path: string, body?: string, from: string | null = origin) =>
  new NextRequest(`https://web.test/api/learn/${path}`, { method, headers: { ...(from ? { origin: from } : {}), 'content-type': 'application/json' }, body: method === 'GET' ? undefined : body })
const send = (method: string, path: string, body?: string) => {
  const handler = { GET, POST, PUT, DELETE }[method as 'GET']
  return handler(request(method, path, body), context(path.split('/')))
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('fetch', mocks.fetch)
  mocks.auth.mockResolvedValue({ accessToken: 'server-session-token', user: { id: 'learner-a' } })
  mocks.cookie.mockImplementation(name => name === 'colearner-school-membership' ? { value: membership } : undefined)
  mocks.fetch.mockImplementation(async () => new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }))
})

const allowed: [string, string, string?][] = [
  ['GET', 'practice/hub'], ['GET', 'practice/sets/set-1'], ['GET', 'practice/sessions'], ['GET', 'practice/sessions/s-1'], ['GET', 'practice/sessions/s-1/items/0'],
  ['GET', 'practice/sessions/s-1/items/12'], ['GET', 'practice/sessions/s-1/summary'], ['GET', 'practice/sessions/s-1/answer-sheet'],
  ['POST', 'practice/sets', '{"materialId":"m1"}'], ['POST', 'practice/sets/set-1/retry', '{}'], ['POST', 'practice/sets/set-1/cancel', '{}'],
  ['POST', 'practice/sessions', '{"clientSessionId":"c-12345678","mode":"REVIEW","scope":{"kind":"DUE"}}'],
  ['POST', 'practice/sessions/s-1/items/0/answer', '{"clientAttemptId":"a-12345678","answer":{"kind":"TRUE_FALSE","value":true},"timeSpentMs":10}'],
  ['POST', 'practice/sessions/s-1/items/3/hint', '{"level":1}'], ['POST', 'practice/sessions/s-1/items/3/skip', '{}'],
  ['POST', 'practice/sessions/s-1/complete', '{}'], ['POST', 'practice/attempts/at-1/regrade', '{}'],
]
describe('B09 practice BFF allowlist', () => {
  it.each(allowed)('forwards %s /%s with fresh server credentials and the selected membership', async (method, path, body) => {
    const response = await send(method, path, body)
    expect(response.status).toBe(200)
    const [url, init] = mocks.fetch.mock.calls[0]!
    expect(url).toBe(`https://platform.test/api/v1/learn/${path}`)
    expect(init.method).toBe(method)
    expect(init.headers).toMatchObject({ Authorization: 'Bearer server-session-token', 'X-School-Membership-Id': membership })
    expect(init.redirect).toBe('error')
    expect(response.headers.get('cache-control')).toBe('no-store')
    if (method === 'POST') expect(init.body).toBe(body)
    else expect(init.body).toBeUndefined()
  })

  it.each([
    ['GET', 'practice'], ['GET', 'practice/'], ['GET', 'practice/sets'], ['GET', 'practice/hub/extra'], ['GET', 'practice/sessions/s-1/items'], ['GET', 'practice/sessions/s-1/items/abc'],
    ['GET', 'practice/sessions/s-1/items/1234'], ['GET', 'practice/sessions/s-1/items/0/answer'], ['GET', 'practice/sessions/s-1/complete'], ['GET', 'practice/attempts/at-1'],
    ['GET', 'practice/attempts/at-1/regrade'], ['GET', 'practice/sessions/../hub'], ['GET', 'practice/sessions/a%2Fb'], ['GET', 'practice/admin'], ['GET', 'practice/sets/s/retry'],
    ['POST', 'practice/hub'], ['POST', 'practice/sets/set-1'], ['POST', 'practice/sessions/s-1'], ['POST', 'practice/sessions/s-1/summary'], ['POST', 'practice/sessions/s-1/items/0'],
    ['POST', 'practice/sessions/s-1/items/0/grade'], ['POST', 'practice/sessions/s-1/items/x/answer'], ['POST', 'practice/sessions/s-1/items/0/answer/extra'], ['POST', 'practice/attempts'],
    ['POST', 'practice/attempts/at-1'], ['POST', 'practice/attempts/at-1/score'], ['POST', 'practice/sets/set-1/regrade'], ['POST', 'practice/rewards'], ['POST', 'practice/sessions/s-1/reward'],
    ['POST', 'practice/internal/practice-jobs/dispatch'], ['POST', 'internal/practice-jobs/dispatch'],
    ['PUT', 'practice/sessions'], ['PUT', 'practice/sessions/s-1/items/0/answer'], ['PUT', 'practice/sets/set-1'],
    ['DELETE', 'practice/sessions/s-1'], ['DELETE', 'practice/sets/set-1'], ['DELETE', 'practice/attempts/at-1'],
  ])('refuses %s /%s with a 404 before any credential is read', async (method, path) => {
    const response = await send(method, path, '{}')
    expect(response.status).toBe(404)
    expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it.each([['POST', 'practice/sessions'], ['POST', 'practice/sessions/s-1/items/0/answer'], ['POST', 'practice/attempts/at-1/regrade'], ['POST', 'practice/sets']])('refuses a cross-origin or origin-less %s /%s before reading credentials', async (_method, path) => {
    const parts = path.split('/')
    expect((await POST(request('POST', path, '{}', 'https://other.test'), context(parts))).status).toBe(403)
    expect((await POST(request('POST', path, '{}', null), context(parts))).status).toBe(403)
    expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('forwards only the hub filters on the hub and only the cursor and limit on the session history', async () => {
    await GET(new NextRequest('https://web.test/api/learn/practice/hub?subjectId=sub-1&planId=plan-1&learnerId=other&orgId=x&cursor=c'), context(['practice', 'hub']))
    expect(mocks.fetch.mock.calls[0]![0]).toBe('https://platform.test/api/v1/learn/practice/hub?subjectId=sub-1&planId=plan-1')
    await GET(new NextRequest('https://web.test/api/learn/practice/sessions?cursor=abc&limit=20&learnerId=other&subjectId=s'), context(['practice', 'sessions']))
    expect(mocks.fetch.mock.calls[1]![0]).toBe('https://platform.test/api/v1/learn/practice/sessions?cursor=abc&limit=20')
  })
  it('forwards no query string on other practice routes or on writes', async () => {
    await GET(new NextRequest('https://web.test/api/learn/practice/sessions/s-1/summary?learnerId=other'), context(['practice', 'sessions', 's-1', 'summary']))
    expect(mocks.fetch.mock.calls[0]![0]).toBe('https://platform.test/api/v1/learn/practice/sessions/s-1/summary')
    await POST(new NextRequest('https://web.test/api/learn/practice/sessions?orgId=x', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '{}' }), context(['practice', 'sessions']))
    expect(mocks.fetch.mock.calls[1]![0]).toBe('https://platform.test/api/v1/learn/practice/sessions')
  })

  it('lets a selected child win: opaque credential, no school selector, no adult session read', async () => {
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: 'opaque-child-session' } : { value: membership })
    await send('POST', 'practice/sessions/s-1/complete', '{}')
    expect(mocks.auth).not.toHaveBeenCalled()
    const headers = mocks.fetch.mock.calls[0]?.[1].headers
    expect(headers).toMatchObject({ Authorization: 'Bearer opaque-child-session' })
    expect(headers).not.toHaveProperty('X-School-Membership-Id')
  })
  it('fails closed without a session, never replays a failed write and hides backend exceptions', async () => {
    mocks.auth.mockResolvedValue(null)
    expect((await send('POST', 'practice/sessions', '{}')).status).toBe(401)
    expect(mocks.fetch).not.toHaveBeenCalled()
    mocks.auth.mockResolvedValue({ accessToken: 'token', user: { id: 'a' } })
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ code: 'ATTEMPTS_EXHAUSTED' }), { status: 409 }))
    const response = await send('POST', 'practice/sessions/s-1/items/0/answer', '{}')
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ code: 'ATTEMPTS_EXHAUSTED' })
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    mocks.fetch.mockRejectedValue(new Error('private connection string'))
    const failed = await send('GET', 'practice/hub')
    expect(failed.status).toBe(503)
    expect(await failed.text()).not.toContain('private connection string')
  })
  it('keeps the earlier B07 and B08 routes working', async () => {
    expect((await send('GET', 'home')).status).toBe(200)
    expect((await send('GET', 'lessons/lesson-1')).status).toBe(200)
    expect((await send('PUT', 'lessons/lesson-1/progress', '{}')).status).toBe(200)
    expect((await send('POST', 'enrollments/join', '{}')).status).toBe(200)
  })
})
