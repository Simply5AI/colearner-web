import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), cookie: vi.fn(), family: vi.fn() }))
vi.mock('@/lib/auth/config', () => ({ auth: mocks.auth }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.cookie }) }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) } }))
vi.mock('@/lib/api/family', async original => ({ ...await original<typeof import('@/lib/api/family')>(), familyRequest: mocks.family }))
import { FamilyError } from '@/lib/api/family'
import { requireOnboardingAccess } from '@/lib/auth/onboarding-access'

const session = { accessToken: 'account-token', user: { id: 'learner-a', name: 'Mariam Khan', roles: ['STUDENT'], onboardingCompleted: false } }
beforeEach(() => {
  vi.clearAllMocks(); mocks.cookie.mockReturnValue(undefined); mocks.auth.mockResolvedValue(session)
  mocks.family.mockImplementation(async (_token: string, path: string) => path === '/family/access-status' ? { next: 'ADULT_ONBOARDING', ageBand: 'ADULT' } : { profileId: 'profile-a', schoolId: 'school-a', nickname: 'Aarav Singh', ageBand: '6-9' })
})

describe('A6 route entry', () => {
  it('prefers an opaque child, exposing only a nonsecret scope and first name', async () => {
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: 'opaque-child' } : undefined)
    const access = await requireOnboardingAccess()
    expect(access).toEqual({ kind: 'child', scope: 'child:school-a:profile-a', learnerName: 'Aarav', band: 'kids' })
    expect(mocks.family).toHaveBeenCalledWith('opaque-child', '/family/child')
    expect(mocks.auth).not.toHaveBeenCalled()
    expect(JSON.stringify(access)).not.toContain('opaque-child')
  })
  it('never falls back to an adult account for an empty or revoked child', async () => {
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: '' } : undefined)
    await expect(requireOnboardingAccess()).rejects.toThrow('REDIRECT:/profiles?denied=1')
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: 'revoked' } : undefined)
    mocks.family.mockRejectedValue(new FamilyError(403, 'Revoked'))
    await expect(requireOnboardingAccess()).rejects.toThrow('REDIRECT:/profiles?denied=1')
    expect(mocks.auth).not.toHaveBeenCalled()
  })
  it('does not reroute an account to the legacy onboarding, and isolates the cache per membership', async () => {
    mocks.cookie.mockImplementation(name => name === 'colearner-school-membership' ? { value: 'membership-a' } : undefined)
    expect(await requireOnboardingAccess()).toEqual({ kind: 'account', scope: 'account:learner-a:membership-a', learnerName: 'Mariam', band: null })
  })
  it('keeps account, age and role gates', async () => {
    mocks.auth.mockResolvedValue(null)
    await expect(requireOnboardingAccess()).rejects.toThrow('REDIRECT:/login?callbackUrl=/onboarding/meet-co')
    mocks.auth.mockResolvedValue({ ...session, user: { ...session.user, systemRole: 'SUPER_ADMIN' } })
    await expect(requireOnboardingAccess()).rejects.toThrow('REDIRECT:/admin/login')
    mocks.auth.mockResolvedValue({ ...session, user: { ...session.user, roles: ['TEACHER'] } })
    await expect(requireOnboardingAccess()).rejects.toThrow('REDIRECT:/teacher/dashboard')
    mocks.auth.mockResolvedValue(session)
    mocks.family.mockResolvedValue({ next: 'AGE_CHECK', ageBand: null })
    await expect(requireOnboardingAccess()).rejects.toThrow('REDIRECT:/age')
    mocks.family.mockResolvedValue({ next: 'CHILD_PROFILE', ageBand: 'KIDS' })
    await expect(requireOnboardingAccess()).rejects.toThrow('REDIRECT:/learner')
    mocks.family.mockRejectedValue(new FamilyError(503, 'down'))
    await expect(requireOnboardingAccess()).rejects.toThrow('could not be checked')
  })
})
