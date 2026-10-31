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
  ['GET', 'lessons/lesson-1'],
  ['POST', 'lessons', '{"materialId":"m1"}'],
  ['PUT', 'lessons/lesson-1/progress', '{"currentStep":1,"revision":0}'],
  ['POST', 'lessons/lesson-1/check', '{"stepIndex":2,"optionId":"a"}'],
  ['POST', 'lessons/lesson-1/complete', '{}'],
  ['POST', 'lessons/lesson-1/retry', '{}'],
  ['POST', 'lessons/lesson-1/cancel', '{}'],
  ['POST', 'lessons/lesson-1/notes', '{"stepIndex":1,"text":"hi"}'],
  ['DELETE', 'lessons/lesson-1/notes/note-9'],
]
describe('B08 lesson BFF allowlist', () => {
  it.each(allowed)('forwards %s /%s with fresh server credentials and the selected membership', async (method, path, body) => {
    const response = await send(method, path, body)
    expect(response.status).toBe(200)
    const [url, init] = mocks.fetch.mock.calls[0]!
    expect(url).toBe(`https://platform.test/api/v1/learn/${path}`)
    expect(init.method).toBe(method)
    expect(init.headers).toMatchObject({ Authorization: 'Bearer server-session-token', 'X-School-Membership-Id': membership })
    expect(init.redirect).toBe('error')
    expect(response.headers.get('cache-control')).toBe('no-store')
    if (method === 'POST' || method === 'PUT') expect(init.body).toBe(body)
    else expect(init.body).toBeUndefined()
  })

  it.each([
    ['GET', 'lessons'], ['GET', 'lessons/lesson-1/progress'], ['GET', 'lessons/lesson-1/notes'], ['GET', 'lessons/a/b/c'], ['GET', 'lessons/../home'],
    ['POST', 'lessons/lesson-1'], ['POST', 'lessons/lesson-1/progress'], ['POST', 'lessons/lesson-1/grade'], ['POST', 'lessons/lesson-1/notes/n1'],
    ['POST', 'lessons/lesson-1/check/extra'], ['POST', 'lessons/a%2Fb/check'],
    ['PUT', 'lessons'], ['PUT', 'lessons/lesson-1'], ['PUT', 'lessons/lesson-1/check'], ['PUT', 'lessons/lesson-1/notes/n1'], ['PUT', 'enrollments/join'],
    ['DELETE', 'lessons/lesson-1'], ['DELETE', 'lessons/lesson-1/notes'], ['DELETE', 'lessons/lesson-1/progress'], ['DELETE', 'plans/plan-1'], ['DELETE', 'lessons/lesson-1/notes/n1/extra'],
  ])('refuses %s /%s with a 404 before any credential is read', async (method, path) => {
    const response = await send(method, path, '{}')
    expect(response.status).toBe(404)
    expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('exports only GET, POST, PUT, PATCH (study notes) and DELETE handlers', () => {
    expect(Object.keys(route).filter(key => /^[A-Z]+$/.test(key)).sort()).toEqual(['DELETE', 'GET', 'PATCH', 'POST', 'PUT'])
  })

  it.each([['POST', 'lessons'], ['PUT', 'lessons/lesson-1/progress'], ['DELETE', 'lessons/lesson-1/notes/n1']])('refuses a cross-origin or origin-less %s /%s before reading credentials', async (method, path) => {
    const handler = { POST, PUT, DELETE }[method as 'POST']
    expect((await handler(request(method, path, '{}', 'https://other.test'), context(path.split('/')))).status).toBe(403)
    expect((await handler(request(method, path, '{}', null), context(path.split('/')))).status).toBe(403)
    expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('does not forward query parameters on lesson routes (no client-chosen learner or school)', async () => {
    await GET(new NextRequest('https://web.test/api/learn/lessons/lesson-1?learnerId=other&orgId=x'), context(['lessons', 'lesson-1']))
    expect(mocks.fetch.mock.calls[0]?.[0]).toBe('https://platform.test/api/v1/learn/lessons/lesson-1')
  })

  it('lets a selected child win for lessons: opaque credential, no school selector, no adult session read', async () => {
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: 'opaque-child-session' } : { value: membership })
    await send('PUT', 'lessons/lesson-1/progress', '{"currentStep":1,"revision":0}')
    expect(mocks.auth).not.toHaveBeenCalled()
    const headers = mocks.fetch.mock.calls[0]?.[1].headers
    expect(headers).toMatchObject({ Authorization: 'Bearer opaque-child-session' })
    expect(headers).not.toHaveProperty('X-School-Membership-Id')
  })

  it('fails closed without a session and never replays a failed write', async () => {
    mocks.auth.mockResolvedValue(null)
    expect((await send('POST', 'lessons', '{}')).status).toBe(401)
    expect(mocks.fetch).not.toHaveBeenCalled()
    mocks.auth.mockResolvedValue({ accessToken: 'token', user: { id: 'a' } })
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ code: 'PROGRESS_CONFLICT' }), { status: 409 }))
    const response = await send('PUT', 'lessons/lesson-1/progress', '{"currentStep":1,"revision":0}')
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ code: 'PROGRESS_CONFLICT' })
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it('hides backend exceptions behind a 503', async () => {
    mocks.fetch.mockRejectedValue(new Error('private connection string'))
    const response = await send('DELETE', 'lessons/lesson-1/notes/n1')
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('private connection string')
  })

  it('keeps the earlier B07 routes working', async () => {
    expect((await GET(request('GET', 'home'), context(['home']))).status).toBe(200)
    expect((await GET(request('GET', 'plans/plan-1'), context(['plans', 'plan-1']))).status).toBe(200)
    expect((await POST(request('POST', 'enrollments/join', '{"code":"A"}'), context(['enrollments', 'join']))).status).toBe(200)
    expect((await GET(request('GET', 'link-status'), context(['link-status']))).status).toBe(200)
  })
})
