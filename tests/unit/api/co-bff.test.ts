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
  ['GET', 'co/context'], ['GET', 'co/conversations'], ['GET', 'co/conversations/conv-1'], ['GET', 'co/conversations/conv-1/turns/turn-1'],
  ['POST', 'co/conversations', '{"context":{"kind":"MATERIAL","materialId":"m1"}}'], ['POST', 'co/conversations/conv-1/turns', '{"clientTurnId":"c-12345678","text":"hi"}'],
  ['POST', 'co/conversations/conv-1/turns/turn-1/retry', '{}'], ['POST', 'co/conversations/conv-1/turns/turn-1/cancel', '{}'],
  ['POST', 'co/analogies', '{"materialId":"m1","conceptRef":"c1","conceptLabel":"Chlorophyll"}'],
  ['GET', 'homework/sessions'], ['GET', 'homework/sessions/hw-1'],
  ['PUT', 'homework/sessions/hw-1/problem', '{"clientTurnId":"c-12345678","problem":"3/4 + 1/8"}'],
  ['POST', 'homework/sessions/hw-1/finish', '{}'],
  ['POST', 'homework/sessions', '{"problem":"3/4 + 1/8","clientSessionId":"c-12345678"}'], ['POST', 'homework/sessions/hw-1/restatement', '{"clientTurnId":"c-12345678","confirmed":true}'],
  ['POST', 'homework/sessions/hw-1/steps', '{"clientTurnId":"c-12345678","learnerResponse":"x"}'], ['POST', 'homework/sessions/hw-1/hint', '{"clientTurnId":"c-12345678","level":1}'],
  ['POST', 'homework/sessions/hw-1/final', '{"clientTurnId":"c-12345678","answerText":"7"}'], ['POST', 'homework/sessions/hw-1/final-phase', '{}'], ['POST', 'homework/sessions/hw-1/abandon', '{}'],
  // CD2: ask Co again after the newest homework turn failed (the shared turn retry refuses a homework conversation).
  ['POST', 'homework/sessions/hw-1/retry', '{}'],
]
describe('B10 co and homework BFF allowlist', () => {
  it.each(allowed)('forwards %s /%s with fresh server credentials and the selected membership', async (method, path, body) => {
    const response = await send(method, path, body)
    expect(response.status).toBe(200)
    const [url, init] = mocks.fetch.mock.calls[0]!
    expect(url).toBe(`https://platform.test/api/v1/learn/${path}`)
    expect(init.method).toBe(method)
    expect(init.headers).toMatchObject({ Authorization: 'Bearer server-session-token', 'X-School-Membership-Id': membership })
    expect(init.redirect).toBe('error')
    expect(response.headers.get('cache-control')).toBe('no-store')
    if (method !== 'GET') expect(init.body).toBe(body)
    else expect(init.body).toBeUndefined()
  })

  it.each([
    // wrong method for a known path
    ['POST', 'co/context'], ['GET', 'co/analogies'], ['PUT', 'co/analogies'], ['DELETE', 'co/analogies'], ['POST', 'co/analogies/extra'], ['PUT', 'co/conversations'], ['DELETE', 'co/conversations/conv-1'], ['GET', 'co/conversations/conv-1/turns'], ['GET', 'co/conversations/conv-1/turns/turn-1/retry'],
    ['GET', 'co/conversations/conv-1/turns/turn-1/cancel'], ['POST', 'co/conversations/conv-1'], ['POST', 'co/conversations/conv-1/turns/turn-1'], ['PUT', 'co/conversations/conv-1/turns/turn-1'],
    ['DELETE', 'co/conversations/conv-1/turns/turn-1'], ['PUT', 'homework/sessions'], ['PUT', 'homework/sessions/hw-1'], ['DELETE', 'homework/sessions/hw-1'], ['POST', 'homework/sessions/hw-1'],
    ['GET', 'homework/sessions/hw-1/steps'], ['GET', 'homework/sessions/hw-1/hint'], ['GET', 'homework/sessions/hw-1/final'], ['GET', 'homework/sessions/hw-1/restatement'], ['GET', 'homework/sessions/hw-1/abandon'],
    ['PUT', 'homework/sessions/hw-1/steps'], ['DELETE', 'homework/sessions/hw-1/steps'], ['PUT', 'homework/sessions/hw-1/final'],
    ['GET', 'homework/sessions/hw-1/problem'], ['POST', 'homework/sessions/hw-1/problem'], ['DELETE', 'homework/sessions/hw-1/problem'], ['PUT', 'homework/sessions/hw-1/restatement'], ['PUT', 'homework/sessions/hw-1/finish'],
    ['GET', 'homework/sessions/hw-1/finish'], ['GET', 'homework/sessions/hw-1/retry'], ['PUT', 'homework/sessions/hw-1/retry'], ['DELETE', 'homework/sessions/hw-1/retry'], ['PUT', 'homework/sessions/hw-1/hint'], ['PUT', 'homework/sessions/hw-1/problem/extra'], ['PUT', 'homework/problem'], ['PUT', 'co/conversations/conv-1/problem'],
    // paths that do not exist in the contract
    ['GET', 'co'], ['GET', 'co/'], ['GET', 'co/admin'], ['GET', 'co/conversations/conv-1/turns/turn-1/extra'], ['POST', 'co/conversations/conv-1/turns/turn-1/regrade'], ['POST', 'co/conversations/conv-1/turns/turn-1/retry/x'],
    ['POST', 'co/conversations/conv-1/close'], ['GET', 'co/safety-events'], ['GET', 'co/conversations/conv-1/export'], ['POST', 'co/messages'],
    ['GET', 'homework'], ['GET', 'homework/'], ['GET', 'homework/sessions/hw-1/solution'], ['GET', 'homework/sessions/hw-1/worked-solution'], ['POST', 'homework/sessions/hw-1/worked-solution'],
    ['POST', 'homework/sessions/hw-1/solution'], ['POST', 'homework/sessions/hw-1/reveal'], ['POST', 'homework/sessions/hw-1/answer'], ['POST', 'homework/sessions/hw-1/photo'], ['POST', 'homework/sessions/hw-1/final/extra'],
    ['POST', 'homework/sessions/hw-1/hint/2'], ['GET', 'homework/sessions/hw-1/turns'], ['POST', 'homework/internal/dispatch'], ['POST', 'internal/co-jobs/dispatch'], ['POST', 'co/internal/co-jobs/dispatch'],
    ['POST', 'internal/homework/dispatch'], ['GET', 'homework/sessions/hw-1/extra/more'],
    // traversal and encoded separators
    ['GET', 'co/conversations/../context'], ['GET', 'homework/sessions/a%2Fb'], ['GET', 'homework/sessions/..'], ['GET', 'co/conversations/a%2F..%2Fb'], ['POST', 'homework/sessions/hw-1/steps%2Fx'],
  ])('refuses %s /%s with a 404 before any credential is read', async (method, path) => {
    const response = await send(method, path, '{}')
    expect(response.status).toBe(404)
    expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it.each([
    ['POST', 'co/conversations'], ['POST', 'co/conversations/conv-1/turns'], ['POST', 'co/conversations/conv-1/turns/turn-1/retry'], ['POST', 'homework/sessions'],
    ['POST', 'homework/sessions/hw-1/steps'], ['POST', 'homework/sessions/hw-1/hint'], ['POST', 'homework/sessions/hw-1/final'], ['POST', 'homework/sessions/hw-1/abandon'], ['POST', 'homework/sessions/hw-1/finish'],
  ])('refuses a cross-origin or origin-less %s /%s before reading credentials', async (_method, path) => {
    const parts = path.split('/')
    expect((await POST(request('POST', path, '{}', 'https://other.test'), context(parts))).status).toBe(403)
    expect((await POST(request('POST', path, '{}', null), context(parts))).status).toBe(403)
    expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('forwards only cursor and limit on the homework list', async () => {
    await GET(new NextRequest('https://web.test/api/learn/homework/sessions?cursor=abc&limit=20&learnerId=other&phase=DONE'), context(['homework', 'sessions']))
    expect(mocks.fetch.mock.calls[0]![0]).toBe('https://platform.test/api/v1/learn/homework/sessions?cursor=abc&limit=20')
  })
  it('sends the problem PUT with the body, a same-origin check and no query string', async () => {
    const put = (from: string | null) => PUT(new NextRequest('https://web.test/api/learn/homework/sessions/hw-1/problem?orgId=x', { method: 'PUT', headers: { ...(from ? { origin: from } : {}), 'content-type': 'application/json' }, body: '{"clientTurnId":"c-12345678","problem":"x"}' }), context(['homework', 'sessions', 'hw-1', 'problem']))
    expect((await put('https://other.test')).status).toBe(403)
    expect((await put(null)).status).toBe(403)
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect((await put(origin)).status).toBe(200)
    const [url, init] = mocks.fetch.mock.calls[0]!
    expect(url).toBe('https://platform.test/api/v1/learn/homework/sessions/hw-1/problem')
    expect(init.method).toBe('PUT'); expect(init.body).toBe('{"clientTurnId":"c-12345678","problem":"x"}')
  })
  it('forwards only lessonId, materialId and stepIndex on the context call and only cursor and limit on the history', async () => {
    await GET(new NextRequest('https://web.test/api/learn/co/context?lessonId=l1&materialId=m1&stepIndex=2&learnerId=other&orgId=x&cursor=c'), context(['co', 'context']))
    expect(mocks.fetch.mock.calls[0]![0]).toBe('https://platform.test/api/v1/learn/co/context?lessonId=l1&materialId=m1&stepIndex=2')
    await GET(new NextRequest('https://web.test/api/learn/co/conversations?cursor=abc&limit=20&learnerId=other&lessonId=l1'), context(['co', 'conversations']))
    expect(mocks.fetch.mock.calls[1]![0]).toBe('https://platform.test/api/v1/learn/co/conversations?cursor=abc&limit=20')
  })
  it('forwards no query string on other co and homework routes or on writes', async () => {
    await GET(new NextRequest('https://web.test/api/learn/homework/sessions/hw-1?learnerId=other&cursor=c'), context(['homework', 'sessions', 'hw-1']))
    expect(mocks.fetch.mock.calls[0]![0]).toBe('https://platform.test/api/v1/learn/homework/sessions/hw-1')
    await GET(new NextRequest('https://web.test/api/learn/co/conversations/conv-1?limit=5'), context(['co', 'conversations', 'conv-1']))
    expect(mocks.fetch.mock.calls[1]![0]).toBe('https://platform.test/api/v1/learn/co/conversations/conv-1')
    await POST(new NextRequest('https://web.test/api/learn/homework/sessions?orgId=x', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '{}' }), context(['homework', 'sessions']))
    expect(mocks.fetch.mock.calls[2]![0]).toBe('https://platform.test/api/v1/learn/homework/sessions')
  })

  it('lets a selected child win: opaque credential, no school selector, no adult session read', async () => {
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: 'opaque-child-session' } : { value: membership })
    await send('POST', 'homework/sessions/hw-1/hint', '{"clientTurnId":"c-12345678","level":1}')
    expect(mocks.auth).not.toHaveBeenCalled()
    const headers = mocks.fetch.mock.calls[0]?.[1].headers
    expect(headers).toMatchObject({ Authorization: 'Bearer opaque-child-session' })
    expect(headers).not.toHaveProperty('X-School-Membership-Id')
  })
  it('fails closed without a session, never replays a failed write and hides backend exceptions', async () => {
    mocks.auth.mockResolvedValue(null)
    expect((await send('POST', 'homework/sessions', '{}')).status).toBe(401)
    expect(mocks.fetch).not.toHaveBeenCalled()
    mocks.auth.mockResolvedValue({ accessToken: 'token', user: { id: 'a' } })
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ code: 'HINT_OUT_OF_ORDER' }), { status: 409 }))
    const response = await send('POST', 'homework/sessions/hw-1/hint', '{}')
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ code: 'HINT_OUT_OF_ORDER' })
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    mocks.fetch.mockRejectedValue(new Error('private connection string'))
    const failed = await send('GET', 'homework/sessions/hw-1')
    expect(failed.status).toBe(503)
    expect(await failed.text()).not.toContain('private connection string')
  })
  it('keeps the earlier B07, B08 and B09 routes working', async () => {
    expect((await send('GET', 'home')).status).toBe(200)
    expect((await send('GET', 'lessons/lesson-1')).status).toBe(200)
    expect((await send('PUT', 'lessons/lesson-1/progress', '{}')).status).toBe(200)
    expect((await send('GET', 'practice/hub')).status).toBe(200)
    expect((await send('POST', 'practice/sessions/s-1/complete', '{}')).status).toBe(200)
    expect((await send('POST', 'enrollments/join', '{}')).status).toBe(200)
  })
})
