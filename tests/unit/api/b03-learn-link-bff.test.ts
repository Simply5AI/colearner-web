import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), cookie: vi.fn(), fetch: vi.fn() }))
vi.mock('@/lib/auth/config', () => ({ auth: mocks.auth }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.cookie }) }))
vi.mock('@/lib/api/platform-client', () => ({ platformApiBaseUrl: () => 'https://platform.test/api/v1' }))
import { GET, POST } from '@/app/api/learn/[[...path]]/route'
const context = (path?: string[]) => ({ params: Promise.resolve({ path }) })
const membership = '11111111-1111-4111-8111-111111111111'
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('fetch', mocks.fetch)
  mocks.auth.mockResolvedValue({ accessToken: 'server-session-token', user: { id: 'learner-a' } })
  mocks.cookie.mockImplementation(name => name === 'colearner-school-membership' ? { value: membership } : undefined)
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ data: { stage: 'READY' } }), { status: 200 }))
})
describe('learn BFF link-status', () => {
  it('allows GET link-status with server credentials, the selected membership and no client authority', async () => {
    const response = await GET(new NextRequest('https://web.test/api/learn/link-status?learnerId=other&email=x'), context(['link-status']))
    expect(response.status).toBe(200)
    const [url, request] = mocks.fetch.mock.calls[0]!
    expect(url).toBe('https://platform.test/api/v1/learn/link-status')
    expect(request.method).toBe('GET')
    expect(request.headers).toMatchObject({ Authorization: 'Bearer server-session-token', 'X-School-Membership-Id': membership })
    expect(request.redirect).toBe('error')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
  it('refuses a write to link-status before any credential is read (the student can never bind themselves)', async () => {
    const request = new NextRequest('https://web.test/api/learn/link-status', { method: 'POST', headers: { origin: 'https://web.test', 'content-type': 'application/json' }, body: '{"profileId":"p"}' })
    expect((await POST(request, context(['link-status']))).status).toBe(404)
    expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it('keeps the allowlist exact: no sub-paths, no neighbours', async () => {
    for (const path of [['link-status', 'extra'], ['link'], ['link-status', '..'], ['link-statuses'], ['link-status', 'bind']]) {
      expect((await GET(new NextRequest('https://web.test/api/learn/x'), context(path))).status, path.join('/')).toBe(404)
    }
    expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it('lets a selected child cookie win (opaque credential, no school selector, no adult session) and relays a 401 without the adult session', async () => {
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: 'opaque-child-session' } : { value: membership })
    await GET(new NextRequest('https://web.test/api/learn/link-status'), context(['link-status']))
    expect(mocks.auth).not.toHaveBeenCalled()
    expect(mocks.fetch.mock.calls[0]?.[1].headers).toMatchObject({ Authorization: 'Bearer opaque-child-session' })
    expect(mocks.fetch.mock.calls[0]?.[1].headers).not.toHaveProperty('X-School-Membership-Id')
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ message: 'Expired child session' }), { status: 401 }))
    expect((await GET(new NextRequest('https://web.test/api/learn/link-status'), context(['link-status']))).status).toBe(401)
    expect(mocks.auth).not.toHaveBeenCalled()
  })
  it('requires an authenticated session and hides backend exceptions', async () => {
    mocks.auth.mockResolvedValue(null)
    expect((await GET(new NextRequest('https://web.test/api/learn/link-status'), context(['link-status']))).status).toBe(401)
    expect(mocks.fetch).not.toHaveBeenCalled()
    mocks.auth.mockResolvedValue({ accessToken: 'token', user: { id: 'u' } }); mocks.fetch.mockRejectedValue(new Error('private connection string'))
    const response = await GET(new NextRequest('https://web.test/api/learn/link-status'), context(['link-status']))
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('private connection string')
  })
})
