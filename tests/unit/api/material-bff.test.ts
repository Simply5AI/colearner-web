import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), cookie: vi.fn(), fetch: vi.fn() }))
vi.mock('@/lib/auth/config', () => ({ auth: mocks.auth }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.cookie }) }))
vi.mock('@/lib/api/platform-client', () => ({ platformApiBaseUrl: () => 'https://platform.test/api/v1' }))
import { GET, POST } from '@/app/api/materials/[[...path]]/route'
const context = (path?: string[]) => ({ params: Promise.resolve({ path }) })
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('fetch', mocks.fetch)
  mocks.auth.mockResolvedValue({ accessToken: 'server-session-token', user: { id: 'learner-a' } })
  mocks.cookie.mockImplementation(name => name === 'colearner-school-membership' ? { value: '11111111-1111-4111-8111-111111111111' } : undefined)
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ data: { enabled: true } }), { status: 200 }))
})
describe('material selected-school forwarding', () => {
  it('forwards the selected HTTP-only membership with fresh server credentials and no client authority', async () => {
    const response = await GET(new NextRequest('https://web.test/api/materials/config'), context(['config']))
    const [url, request] = mocks.fetch.mock.calls[0]!
    expect(url).toBe('https://platform.test/api/v1/materials/config')
    expect(request.headers).toMatchObject({ Authorization: 'Bearer server-session-token', 'X-School-Membership-Id': '11111111-1111-4111-8111-111111111111' })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
  it('keeps the backend as authority when no membership is selected', async () => {
    mocks.cookie.mockReturnValue(undefined)
    await GET(new NextRequest('https://web.test/api/materials?status=ready'), context())
    expect(mocks.fetch.mock.calls[0]?.[0]).toBe('https://platform.test/api/v1/materials?status=ready')
    expect(mocks.fetch.mock.calls[0]?.[1].headers).not.toHaveProperty('X-School-Membership-Id')
  })
  it('forwards a selected opaque child credential without a school selector or adult fallback', async () => {
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: 'opaque-child-session' } : { value: '11111111-1111-4111-8111-111111111111' })
    await GET(new NextRequest('https://web.test/api/materials/config'), context(['config']))
    expect(mocks.auth).not.toHaveBeenCalled()
    expect(mocks.fetch.mock.calls[0]?.[1].headers).toMatchObject({ Authorization: 'Bearer opaque-child-session' })
    expect(mocks.fetch.mock.calls[0]?.[1].headers).not.toHaveProperty('X-School-Membership-Id')
  })
  it('fails closed for an empty or revoked selected child even if an adult session exists', async () => {
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: '' } : undefined)
    expect((await GET(new NextRequest('https://web.test/api/materials/config'), context(['config']))).status).toBe(401)
    expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled()
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: 'revoked-child' } : undefined)
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ message: 'Expired child session' }), { status: 401 }))
    expect((await GET(new NextRequest('https://web.test/api/materials/config'), context(['config']))).status).toBe(401)
    expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })
  it('refuses cross-origin writes, unknown operations and missing session', async () => {
    const cross = await POST(new NextRequest('https://web.test/api/materials/import', { method: 'POST', headers: { origin: 'https://other.test' } }), context(['import']))
    expect(cross.status).toBe(403)
    const unknown = await POST(new NextRequest('https://web.test/api/materials/anything/execute', { method: 'POST' }), context(['anything', 'execute']))
    expect(unknown.status).toBe(404)
    mocks.auth.mockResolvedValue(null)
    expect((await GET(new NextRequest('https://web.test/api/materials/config'), context(['config']))).status).toBe(401)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it('streams multipart bytes without rewriting file order or the boundary', async () => {
    await POST(new NextRequest('https://web.test/api/materials/import', { method: 'POST', headers: { origin: 'https://web.test', 'content-type': 'multipart/form-data; boundary=fixture-boundary' }, body: '--fixture-boundary\r\nsynthetic file bytes' }), context(['import']))
    const request = mocks.fetch.mock.calls[0]?.[1]
    expect(request.headers['Content-Type']).toBe('multipart/form-data; boundary=fixture-boundary')
    expect(request.duplex).toBe('half')
    expect(await new Response(request.body).text()).toBe('--fixture-boundary\r\nsynthetic file bytes')
  })
  it('fails closed on an invalid selection or unavailable backend without leaking exceptions', async () => {
    mocks.cookie.mockImplementation(name => name === 'colearner-school-membership' ? { value: 'invalid-selected-membership' } : undefined)
    expect((await GET(new NextRequest('https://web.test/api/materials/config'), context(['config']))).status).toBe(403)
    mocks.cookie.mockReturnValue(undefined); mocks.fetch.mockRejectedValue(new Error('private connection string'))
    const response = await GET(new NextRequest('https://web.test/api/materials/config'), context(['config']))
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('private connection string')
  })
})
