import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), fetch: vi.fn() }))
vi.mock('@/lib/auth/config', () => ({ auth: mocks.auth }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock('@/lib/api/platform-client', () => ({ platformApiBaseUrl: () => 'https://platform.test/api/v1' }))
import { DELETE, GET, POST, PUT } from '@/app/api/learn/[[...path]]/route'
const context = (path: string) => ({ params: Promise.resolve({ path: path.split('/') }) })
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', mocks.fetch); mocks.auth.mockResolvedValue({ accessToken: 'server-token', user: { id: 'learner-fixture' } }); mocks.fetch.mockResolvedValue(new Response('{"data":{}}', { headers: { 'Content-Type': 'application/json' } })) })
afterEach(() => vi.unstubAllGlobals())

it('forwards exactly the two contracted teacher lesson routes', async () => {
  const read = await GET(new NextRequest('https://web.test/api/learn/plans/plan-1/topics/topic-1/teacher-lesson'), context('plans/plan-1/topics/topic-1/teacher-lesson'))
  expect(read.status).toBe(200)
  expect(mocks.fetch.mock.calls[0]![0]).toBe('https://platform.test/api/v1/learn/plans/plan-1/topics/topic-1/teacher-lesson')
  const check = await POST(new NextRequest('https://web.test/api/learn/plans/plan-1/topics/topic-1/teacher-lesson/check', { method: 'POST', headers: { origin: 'https://web.test' }, body: '{"stepIndex":3,"optionId":"o"}' }), context('plans/plan-1/topics/topic-1/teacher-lesson/check'))
  expect(check.status).toBe(200)
  expect(mocks.fetch).toHaveBeenCalledTimes(2)
})
it.each([
  ['GET', 'plans/plan-1/topics/topic-1/teacher-lesson/check'],
  ['GET', 'plans/plan-1/topics/topic-1/lessons'],
  ['GET', 'plans/plan-1/topics/topic-1/teacher-lesson/answers'],
  ['GET', 'plans/plan-1/topics/topic-1/teacher-lesson/extra/more'],
  ['POST', 'plans/plan-1/topics/topic-1/teacher-lesson'],
  ['POST', 'plans/plan-1/topics/topic-1/teacher-lesson/check/extra'],
  ['PUT', 'plans/plan-1/topics/topic-1/teacher-lesson'],
  ['DELETE', 'plans/plan-1/topics/topic-1/teacher-lesson'],
  ['GET', 'plans/plan-1/topics/teacher-lesson'],
  ['GET', 'plans/plan-1/topics/../teacher-lesson'],
])('does not forward %s %s', async (method, path) => {
  const handler = { GET, POST, PUT, DELETE }[method as 'GET']
  const response = await handler(new NextRequest(`https://web.test/api/learn/${path}`, { method, headers: { origin: 'https://web.test' }, body: method === 'GET' || method === 'DELETE' ? undefined : '{}' }), context(path))
  expect(response.status).toBe(404)
  expect(mocks.fetch).not.toHaveBeenCalled()
})
it('refuses a cross-origin answer check before any credential is read', async () => {
  const response = await POST(new NextRequest('https://web.test/api/learn/plans/plan-1/topics/topic-1/teacher-lesson/check', { method: 'POST', headers: { origin: 'https://elsewhere.test' }, body: '{}' }), context('plans/plan-1/topics/topic-1/teacher-lesson/check'))
  expect(response.status).toBe(403)
  expect(mocks.fetch).not.toHaveBeenCalled(); expect(mocks.auth).not.toHaveBeenCalled()
})
