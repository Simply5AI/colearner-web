vi.mock('@/lib/auth/family-access',()=>({accountFamilyAccess:async()=>({next:'ADULT_ONBOARDING',ageBand:'ADULT'}),familyAccessRedirect:()=>null}))
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from 'next-auth'
import DashboardLayout from '@/app/(dashboard)/layout'

const authMock = vi.hoisted(() => vi.fn<() => Promise<Session | null>>())
vi.mock('@/lib/auth/config', () => ({ auth: authMock }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`) } }))
vi.mock('@/components/shared/AppSidebar', () => ({ StudentShell: ({ children }: { children: React.ReactNode }) => <div data-testid="student-shell">{children}</div> }))
vi.mock('@/components/shared/global-gamification-events', () => ({ GlobalGamificationEvents: () => <div data-testid="gamification-events" /> }))

function session(overrides: Partial<Session['user']> = {}): Session {
  return { expires: '2030-01-01T00:00:00Z', accessToken: 'session-token', user: { id: 'student-1', name: 'Student', email: 'student@example.com', onboardingCompleted: true, ...overrides } }
}

describe('Student route-group layout gates', () => {
  beforeEach(() => { authMock.mockReset() })

  it('rejects anonymous descendants before mounting a role shell', async () => {
    authMock.mockResolvedValue(null)
    await expect(DashboardLayout({ children: <h1>Plans</h1> })).rejects.toThrow('redirect:/login?callbackUrl=/dashboard')
  })
  it('rejects a session without an API access token', async () => {
    authMock.mockResolvedValue({ ...session(), accessToken: undefined })
    await expect(DashboardLayout({ children: <h1>Practice</h1> })).rejects.toThrow('redirect:/login?callbackUrl=/dashboard')
  })
  it.each<[Partial<Session['user']>, string]>([
    [{ systemRole: 'SUPER_ADMIN' }, '/admin/login'],
    [{ roles: ['TEACHER'] }, '/teacher/dashboard'],
    [{ onboardingCompleted: false }, '/onboarding/profile'],
  ])('retains existing role/onboarding redirects %j', async (overrides, destination) => {
    authMock.mockResolvedValue(session(overrides))
    await expect(DashboardLayout({ children: <h1>Plans</h1> })).rejects.toThrow(`redirect:${destination}`)
  })
  it('mounts the authorized student shell and existing gamification adapter', async () => {
    authMock.mockResolvedValue(session())
    render(await DashboardLayout({ children: <h1>Plans</h1> }))
    expect(screen.getByTestId('student-shell')).toContainElement(screen.getByRole('heading', { name: 'Plans' }))
    expect(screen.getAllByTestId('gamification-events')).toHaveLength(1)
  })
})
