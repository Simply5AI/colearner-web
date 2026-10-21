import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), cookie: vi.fn(), family: vi.fn(), access: vi.fn(), redirectFor: vi.fn() }))
vi.mock('@/lib/auth/config', () => ({ auth: mocks.auth }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.cookie }) }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) } }))
vi.mock('@/lib/api/family', async original => ({ ...await original<typeof import('@/lib/api/family')>(), familyRequest: mocks.family }))
vi.mock('@/lib/auth/family-access', () => ({ accountFamilyAccess: mocks.access, familyAccessRedirect: mocks.redirectFor }))
vi.mock('@/components/shared/AppSidebar', () => ({ StudentShell: ({ children }: { children: React.ReactNode }) => <div data-testid="student-shell">{children}</div> }))
vi.mock('@/components/learn/child-learn-shell', () => ({ ChildLearnShell: ({ children, band }: { children: React.ReactNode; band: string }) => <div data-testid="child-shell" data-band={band}>{children}</div> }))
import { FamilyError } from '@/lib/api/family'
import { requireLinkAccess } from '@/lib/auth/learner-access'
import LearnLinkLayout from '@/app/(learn-link)/layout'

const session = (user: Record<string, unknown> = {}) => ({ accessToken: 'account-token', user: { id: 'learner-a', roles: ['STUDENT'], onboardingCompleted: false, ...user } })
beforeEach(() => {
  vi.clearAllMocks(); mocks.cookie.mockReturnValue(undefined)
  mocks.auth.mockResolvedValue(session())
  // If the family gate were consulted it would send this student away; the link gate must not care.
  mocks.access.mockResolvedValue({ next: 'AGE_CHECK', ageBand: null }); mocks.redirectFor.mockReturnValue('/age')
})
describe('requireLinkAccess', () => {
  it('lets an account-only student through without consulting family status or onboarding', async () => {
    mocks.cookie.mockImplementation(name => name === 'colearner-school-membership' ? { value: 'membership-a' } : undefined)
    expect(await requireLinkAccess()).toEqual({ kind: 'account', scope: 'account:learner-a:membership-a' })
    mocks.cookie.mockReturnValue(undefined)
    expect(await requireLinkAccess()).toEqual({ kind: 'account', scope: 'account:learner-a:unselected' })
    expect(mocks.access).not.toHaveBeenCalled(); expect(mocks.redirectFor).not.toHaveBeenCalled(); expect(mocks.family).not.toHaveBeenCalled()
  })
  it('verifies a selected child exactly like the learner gate and never falls back to an adult', async () => {
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: 'opaque-child' } : undefined)
    mocks.family.mockResolvedValue({ profileId: 'profile-a', schoolId: 'school-a', nickname: 'Aarav', ageBand: '10-13' })
    expect(await requireLinkAccess()).toEqual({ kind: 'child', scope: 'child:school-a:profile-a', nickname: 'Aarav', band: 'tweens' })
    expect(mocks.family).toHaveBeenCalledWith('opaque-child', '/family/child')
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: '' } : undefined)
    await expect(requireLinkAccess()).rejects.toThrow('REDIRECT:/profiles?denied=1')
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: 'revoked' } : undefined)
    mocks.family.mockRejectedValue(new FamilyError(403, 'Revoked'))
    await expect(requireLinkAccess()).rejects.toThrow('REDIRECT:/profiles?denied=1')
    mocks.family.mockResolvedValue({ profileId: 'p', schoolId: 's', nickname: 'N', ageBand: 'adult' })
    await expect(requireLinkAccess()).rejects.toThrow('REDIRECT:/profiles?denied=1')
    mocks.family.mockRejectedValue(new FamilyError(503, 'down'))
    await expect(requireLinkAccess()).rejects.toThrow('workspace is unavailable')
    expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.access).not.toHaveBeenCalled()
  })
  it('sends anonymous visitors to sign in and keeps admins and teachers out', async () => {
    mocks.auth.mockResolvedValue(null)
    await expect(requireLinkAccess()).rejects.toThrow('REDIRECT:/login?callbackUrl=/learn/link')
    mocks.auth.mockResolvedValue({ ...session(), accessToken: undefined })
    await expect(requireLinkAccess()).rejects.toThrow('REDIRECT:/login?callbackUrl=/learn/link')
    mocks.auth.mockResolvedValue({ accessToken: 't', user: {} })
    await expect(requireLinkAccess()).rejects.toThrow('REDIRECT:/login?callbackUrl=/learn/link')
    for (const [user, destination] of [[{ systemRole: 'SUPER_ADMIN' }, '/admin/login'], [{ roles: ['TEACHER'] }, '/teacher/dashboard']] as const) {
      mocks.auth.mockResolvedValue(session(user))
      await expect(requireLinkAccess()).rejects.toThrow(`REDIRECT:${destination}`)
    }
    expect(mocks.access).not.toHaveBeenCalled()
  })
})
describe('learn-link route-group layout', () => {
  it('mounts the child shell for a child and the student shell for an account, without the family gate', async () => {
    mocks.cookie.mockImplementation(name => name === 'colearner-family-child' ? { value: 'opaque-child' } : undefined)
    mocks.family.mockResolvedValue({ profileId: 'p', schoolId: 's', nickname: 'Aarav', ageBand: '6-9' })
    const { unmount } = render(await LearnLinkLayout({ children: <h1>Link</h1> }))
    expect(screen.getByTestId('child-shell')).toHaveAttribute('data-band', 'kids')
    unmount()
    mocks.cookie.mockReturnValue(undefined)
    render(await LearnLinkLayout({ children: <h1>Link</h1> }))
    expect(screen.getByTestId('student-shell')).toContainElement(screen.getByRole('heading', { name: 'Link' }))
    expect(mocks.access).not.toHaveBeenCalled()
  })
  it('rejects anonymous visitors before mounting any shell', async () => {
    mocks.auth.mockResolvedValue(null)
    await expect(LearnLinkLayout({ children: <h1>Link</h1> })).rejects.toThrow('REDIRECT:/login?callbackUrl=/learn/link')
  })
})
