// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { acceptSessionPair, clearSession, refreshSession } from '@/lib/auth/session-tokens'
const api = vi.hoisted(() => ({ validateSession: vi.fn(), refresh: vi.fn() }))
vi.mock('@/lib/api/platform-client', () => ({ platformClient: () => api }))
const operationId = '50718cc5-c43f-4d19-9a31-748c2f18ef95'

describe('web backend session boundary', () => {
  beforeEach(() => { vi.clearAllMocks(); api.validateSession.mockResolvedValue({ userId: 'user-1', orgId: 'school', sessionId: 'device', refreshRequestId: operationId }) })
  it('binds initial identity to server verification and uses its lifetime/private retry id', async () => {
    const pair = { accessToken: 'a', refreshToken: 'r', expiresIn: 60 }
    const accepted = await acceptSessionPair({}, pair)
    expect(accepted).toMatchObject({ backendUserId: 'user-1', accessToken: 'a', refreshRequestId: operationId })
    expect((accepted as { accessTokenExpires: number }).accessTokenExpires - Date.now()).toBeLessThanOrEqual(60000)
  })
  it('rejects browser-supplied pairs belonging to a different backend user and clears stale authorization on failure', async () => {
    api.validateSession.mockResolvedValue({ userId: 'other-user', orgId: 'school', sessionId: 'other-device' })
    await expect(acceptSessionPair({ backendUserId: 'user-1' }, { accessToken: 'a', refreshToken: 'r' })).rejects.toThrow('Session identity change rejected')
    expect(clearSession({ backendUserId: 'user-1', accessToken: 'a', refreshToken: 'r', roles: ['SUPER_ADMIN'], systemRole: 'SUPER_ADMIN' })).toMatchObject({ accessToken: undefined, backendUserId: undefined, roles: undefined, systemRole: undefined })
  })
  it('single-flights legitimate concurrent refresh and gives all responses the same next operation id', async () => {
    api.refresh.mockResolvedValue({ accessToken: 'new-a', refreshToken: 'new-r', expiresIn: 900 })
    const original = { backendUserId: 'user-1', accessToken: 'old-a', refreshToken: 'old-r', refreshRequestId: operationId }
    const results = await Promise.all(Array.from({ length: 20 }, () => refreshSession(original)))
    expect(api.refresh).toHaveBeenCalledTimes(1)
    expect(api.refresh).toHaveBeenCalledWith({ refreshToken: 'old-r', requestId: operationId })
    expect(results.every(result => result.refreshRequestId === operationId && result.refreshToken === 'new-r')).toBe(true)
  })
  it('requires re-login for old unscoped cookies and clears sessions after replay/store/provider failures', async () => {
    await expect(refreshSession({ accessToken: 'old', refreshToken: 'legacy' })).resolves.toMatchObject({ accessToken: undefined, refreshToken: undefined })
    expect(api.refresh).not.toHaveBeenCalled()
    api.refresh.mockRejectedValue(new Error('replay-or-store-failure'))
    await expect(refreshSession({ backendUserId: 'user-1', refreshToken: 'r', refreshRequestId: operationId })).resolves.toMatchObject({ accessToken: undefined, refreshToken: undefined, error: 'RefreshTokenExpired' })
  })
})
