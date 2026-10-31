import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), cookie: vi.fn(), family: vi.fn(), access: vi.fn(), redirectFor: vi.fn() }))
vi.mock('@/lib/auth/config', () => ({ auth: mocks.auth }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.cookie }) }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) } }))
vi.mock('@/lib/api/family', async original => ({ ...await original<typeof import('@/lib/api/family')>(), familyRequest: mocks.family }))
vi.mock('@/lib/auth/family-access', () => ({ accountFamilyAccess: mocks.access, familyAccessRedirect: mocks.redirectFor }))
vi.mock('@/components/shared/AppSidebar', () => ({ StudentShell: ({ children }: { children: React.ReactNode }) => <div data-testid="student-shell">{children}</div> }))
vi.mock('@/components/learn/child-learn-shell', () => ({ ChildLearnShell: ({ children, band, nickname }: { children: React.ReactNode; band: string; nickname: string }) => <div data-testid="child-shell" data-band={band} data-nickname={nickname}>{children}</div> }))
import { FamilyError } from '@/lib/api/family'
import { requireLearnerAccess } from '@/lib/auth/learner-access'
import LearnLayout from '@/app/(learn)/layout'

const session = (user: Record<string, unknown> = {}) => ({ accessToken: 'account-token', user: { id: 'learner-a', roles: ['STUDENT'], onboardingCompleted: true, ...user } })
beforeEach(() => {
  vi.clearAllMocks(); mocks.cookie.mockReturnValue(undefined)
  mocks.auth.mockResolvedValue(session()); mocks.access.mockResolvedValue({ next: 'ADULT_ONBOARDING', ageBand: 'ADULT' }); mocks.redirectFor.mockReturnValue(null)
})
describe('learner route entry', () => {
  it('rechecks an opaque child and exposes only a nonsecret cache scope', async () => {
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: 'opaque-child' } : undefined)
    mocks.family.mockResolvedValue({ profileId: 'profile-a', schoolId: 'school-a', nickname: 'Aarav', ageBand: '6-9' })
    const access = await requireLearnerAccess()
    expect(access).toEqual({ kind: 'child', scope: 'child:school-a:profile-a', nickname: 'Aarav', band: 'kids' })
    expect(mocks.family).toHaveBeenCalledWith('opaque-child', '/family/child')
    expect(mocks.auth).not.toHaveBeenCalled()
    expect(JSON.stringify(access)).not.toContain('opaque-child')
  })
  it.each([['10-13', 'tweens'], ['14-17', 'teens']])('maps %s to %s', async (ageBand, band) => {
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: 'opaque-child' } : undefined)
    mocks.family.mockResolvedValue({ profileId: 'p', schoolId: 's', nickname: 'N', ageBand })
    expect((await requireLearnerAccess()).band).toBe(band)
  })
  it('never falls back to a parent when the selected child is empty, revoked or malformed', async () => {
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: '' } : undefined)
    await expect(requireLearnerAccess()).rejects.toThrow('REDIRECT:/profiles?denied=1')
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: 'revoked-child' } : undefined)
    mocks.family.mockRejectedValue(new FamilyError(403, 'Revoked'))
    await expect(requireLearnerAccess()).rejects.toThrow('REDIRECT:/profiles?denied=1')
    mocks.family.mockResolvedValue({ profileId: 'p', schoolId: 's', nickname: 'N', ageBand: 'adult' })
    await expect(requireLearnerAccess()).rejects.toThrow('REDIRECT:/profiles?denied=1')
    mocks.family.mockRejectedValue(new FamilyError(503, 'down'))
    await expect(requireLearnerAccess()).rejects.toThrow('workspace is unavailable')
    expect(mocks.auth).not.toHaveBeenCalled()
  })
  it('keeps every account gate and membership cache isolation', async () => {
    mocks.cookie.mockImplementation(name => name === 'colearner-school-membership' ? { value: 'membership-a' } : undefined)
    expect(await requireLearnerAccess()).toEqual({ kind: 'account', scope: 'account:learner-a:membership-a', profileSession: false })
    mocks.cookie.mockReturnValue(undefined)
    expect(await requireLearnerAccess()).toEqual({ kind: 'account', scope: 'account:learner-a:unselected', profileSession: false })
    mocks.auth.mockResolvedValue(null)
    await expect(requireLearnerAccess()).rejects.toThrow('REDIRECT:/login?callbackUrl=/learn/home')
    mocks.auth.mockResolvedValue({ ...session(), accessToken: undefined })
    await expect(requireLearnerAccess('/learn')).rejects.toThrow('REDIRECT:/login?callbackUrl=/learn')
    for (const [user, destination] of [[{ systemRole: 'SUPER_ADMIN' }, '/admin/login'], [{ roles: ['TEACHER'] }, '/teacher/dashboard'], [{ onboardingCompleted: false }, '/onboarding/profile']] as const) {
      mocks.auth.mockResolvedValue(session(user))
      await expect(requireLearnerAccess()).rejects.toThrow(`REDIRECT:${destination}`)
    }
  })
  it('applies the family age/child-profile gate and fails closed when it cannot be checked', async () => {
    mocks.redirectFor.mockReturnValue('/age')
    await expect(requireLearnerAccess()).rejects.toThrow('REDIRECT:/age')
    mocks.redirectFor.mockReturnValue(null); mocks.access.mockRejectedValue(new FamilyError(503, 'down'))
    await expect(requireLearnerAccess()).rejects.toThrow('could not be checked')
  })
})
describe('learn route-group layout', () => {
  it('mounts the child shell for a selected child and the student shell for an account', async () => {
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: 'opaque-child' } : undefined)
    mocks.family.mockResolvedValue({ profileId: 'p', schoolId: 's', nickname: 'Aarav', ageBand: '6-9' })
    const { unmount } = render(await LearnLayout({ children: <h1>Home</h1> }))
    expect(screen.getByTestId('child-shell')).toHaveAttribute('data-band', 'kids')
    expect(screen.queryByTestId('student-shell')).not.toBeInTheDocument()
    unmount()
    mocks.cookie.mockReturnValue(undefined)
    render(await LearnLayout({ children: <h1>Home</h1> }))
    expect(screen.getByTestId('student-shell')).toContainElement(screen.getByRole('heading', { name: 'Home' }))
  })
  it('rejects anonymous visitors before mounting any shell', async () => {
    mocks.auth.mockResolvedValue(null)
    await expect(LearnLayout({ children: <h1>Home</h1> })).rejects.toThrow('REDIRECT:/login?callbackUrl=/learn/home')
  })
})
