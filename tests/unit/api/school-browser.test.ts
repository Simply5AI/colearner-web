import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ session: vi.fn(), request: vi.fn() }))
vi.mock('next-auth/react', () => ({ getSession: mocks.session }))
vi.mock('@/lib/api/school', () => ({ schoolRequest: mocks.request }))
import { schoolBrowserRequest } from '@/lib/api/school-browser'
describe('school browser credentials before dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.session.mockResolvedValue({
      accessToken: 'fresh-verified-token',
      user: { id: 'verified-user' },
    })
    mocks.request.mockResolvedValue({ saved: true })
  })
  it('uses current verified Auth.js session instead of a captured provider token', async () => {
    await schoolBrowserRequest('/schools/a/classes')
    expect(mocks.session).toHaveBeenCalledWith({ broadcast: false })
    expect(mocks.request).toHaveBeenCalledWith(
      'fresh-verified-token',
      '/schools/a/classes',
      'GET',
      undefined,
    )
  })
  it('resolves credentials again before a later mutation and does not replay', async () => {
    await schoolBrowserRequest('/schools/a/classes')
    mocks.session.mockResolvedValue({
      accessToken: 'new-rotated-token',
      user: { id: 'verified-user' },
    })
    await schoolBrowserRequest('/schools/a/classes', 'POST', { grade: 1 })
    expect(mocks.request).toHaveBeenLastCalledWith(
      'new-rotated-token',
      '/schools/a/classes',
      'POST',
      { grade: 1 },
    )
    expect(mocks.request).toHaveBeenCalledTimes(2)
  })
  it.each([
    null,
    { user: { id: 'verified-user' } },
    { accessToken: 'a', user: {} },
  ])('missing verified session blocks API dispatch: %s', async (session) => {
    mocks.session.mockResolvedValue(session)
    await expect(
      schoolBrowserRequest('/schools/a/classes', 'POST', { grade: 1 }),
    ).rejects.toMatchObject({ status: 401 })
    expect(mocks.request).not.toHaveBeenCalled()
  })
  it('session lookup failure blocks dispatch and preserves retryable failure', async () => {
    mocks.session.mockRejectedValue(new Error('Cookie unavailable'))
    await expect(
      schoolBrowserRequest('/schools/a/classes', 'POST', {}),
    ).rejects.toMatchObject({ status: 503 })
    expect(mocks.request).not.toHaveBeenCalled()
  })
  it('does not repeat an API mutation after rejection', async () => {
    mocks.request.mockRejectedValue(new Error('Rejected'))
    await expect(
      schoolBrowserRequest('/schools/a/classes', 'POST', {}),
    ).rejects.toThrow('Rejected')
    expect(mocks.session).toHaveBeenCalledTimes(1)
    expect(mocks.request).toHaveBeenCalledTimes(1)
  })
})
