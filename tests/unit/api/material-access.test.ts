import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), cookie: vi.fn(), family: vi.fn() }))
vi.mock('@/lib/auth/config', () => ({ auth: mocks.auth }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.cookie }) }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) } }))
vi.mock('@/lib/api/family', async original => ({ ...await original<typeof import('@/lib/api/family')>(), familyRequest: mocks.family }))
import { FamilyError } from '@/lib/api/family'
import { requireMaterialAccess } from '@/lib/auth/material-access'
beforeEach(() => { vi.clearAllMocks(); mocks.cookie.mockReturnValue(undefined); mocks.auth.mockResolvedValue({ accessToken: 'account-token', user: { id: 'learner-a', roles: ['STUDENT'], onboardingCompleted: true } }) })
describe('material route entry', () => {
  it('rechecks an opaque child and exposes only a nonsecret cache scope', async () => {
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: 'opaque-child' } : undefined)
    mocks.family.mockResolvedValue({ profileId: 'profile-a', schoolId: 'school-a', nickname: 'Aarav', ageBand: '6-9' })
    const access = await requireMaterialAccess()
    expect(access).toEqual({ kind: 'child', scope: 'child:school-a:profile-a', nickname: 'Aarav', band: 'kids' })
    expect(mocks.family).toHaveBeenCalledWith('opaque-child', '/family/child')
    expect(mocks.auth).not.toHaveBeenCalled()
    expect(JSON.stringify(access)).not.toContain('opaque-child')
  })
  it('never falls back to a parent when the selected child is empty or revoked', async () => {
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: '' } : undefined)
    await expect(requireMaterialAccess()).rejects.toThrow('REDIRECT:/profiles?denied=1')
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: 'revoked-child' } : undefined)
    mocks.family.mockRejectedValue(new FamilyError(403, 'Revoked'))
    await expect(requireMaterialAccess()).rejects.toThrow('REDIRECT:/profiles?denied=1')
    expect(mocks.auth).not.toHaveBeenCalled()
  })
  it('keeps current account gates and membership cache isolation', async () => {
    mocks.cookie.mockImplementation(name => name === 'colearner-school-membership' ? { value: 'membership-a' } : undefined)
    expect(await requireMaterialAccess()).toEqual({ kind: 'account', scope: 'account:learner-a:membership-a', profileSession: false })
    mocks.auth.mockResolvedValue(null)
    await expect(requireMaterialAccess()).rejects.toThrow('REDIRECT:/login?callbackUrl=/learn/library')
  })
})
