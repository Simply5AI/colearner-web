import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), fetch: vi.fn() }))
vi.mock('@/lib/auth/config', () => ({ auth: mocks.auth }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock('@/lib/api/platform-client', () => ({ platformApiBaseUrl: () => 'https://platform.test/api/v1' }))
import { GET, POST } from '@/app/api/learn/[[...path]]/route'
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', mocks.fetch); mocks.auth.mockResolvedValue({ accessToken: 'server-token', user: { id: 'learner-fixture' } }); mocks.fetch.mockResolvedValue(new Response('subject,concept,mastery,evidence,attempts,successRate', { headers: { 'Content-Type': 'text/csv' } })) })
afterEach(() => vi.unstubAllGlobals())
it.each(['teach/context', 'teach/sessions/session-a', 'teach/sessions/session-a/turns/turn-a', 'progress', 'progress/export.csv'])('forwards contracted read %s', async path => {
  const response = await GET(new NextRequest(`https://web.test/api/learn/${path}`), { params: Promise.resolve({ path: path.split('/') }) })
  expect(response.status).toBe(200)
  expect(mocks.fetch).toHaveBeenCalledOnce()
  if (path.endsWith('.csv')) { expect(response.headers.get('content-type')).toBe('text/csv'); expect(response.headers.get('content-disposition')).toContain('progress.csv') }
})
it('blocks internal jobs and cross-origin session writes', async () => {
  const internal = await GET(new NextRequest('https://web.test/api/learn/internal/teach-back-jobs/dispatch'), { params: Promise.resolve({ path: ['internal', 'teach-back-jobs', 'dispatch'] }) })
  expect(internal.status).toBe(404)
  const response = await POST(new NextRequest('https://web.test/api/learn/teach/sessions', { method: 'POST', headers: { origin: 'https://elsewhere.test' }, body: '{}' }), { params: Promise.resolve({ path: ['teach', 'sessions'] }) })
  expect(response.status).toBe(403)
  expect(mocks.fetch).not.toHaveBeenCalled()
})
