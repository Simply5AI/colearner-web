import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Session } from 'next-auth'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), school: vi.fn(), redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`) }) }))
vi.mock('@/lib/auth/config', () => ({ auth: mocks.auth }))
vi.mock('@/lib/auth/family-access',()=>({accountFamilyAccess:async()=>({next:'ADULT_ONBOARDING',ageBand:'ADULT'}),familyAccessRedirect:()=>null}))
vi.mock('@/lib/api/school', () => ({ schoolRequest: mocks.school }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, useRouter: () => ({}), useSearchParams: () => new URLSearchParams() }))
import HomePage from '@/app/page'
import PrivacyPage from '@/app/privacy/page'
import TermsPage from '@/app/terms/page'
import ContactPage from '@/app/contact/page'
beforeEach(() => { vi.clearAllMocks(); mocks.school.mockResolvedValue({ items: [], nextCursor: null }) })
function session(user: Partial<Session['user']>): Session { return { expires: '2099-01-01', accessToken: 'isolated-test-token', user: { id: 'test-user', name: 'Test', email: 'user@example.test', ...user } } }
describe('B01 public root and information routes', () => {
  it('renders school-first overview for anonymous visitors with all real information links', async () => {
    mocks.auth.mockResolvedValue(null); render(await HomePage())
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('More understanding.')
    expect(screen.getByRole('link', { name: 'Continue learning' })).toHaveAttribute('href', '/login')
    for (const [name, href] of [['Privacy', '/privacy'], ['Terms', '/terms'], ['Contact', '/contact']]) expect(screen.getByRole('link', { name })).toHaveAttribute('href', href)
    expect(screen.getByText(/commercial plans will follow product development/)).toBeInTheDocument()
    expect(screen.queryByText(/Start free|Free plan|Plus plan|Prototype/i)).not.toBeInTheDocument(); expect(mocks.redirect).not.toHaveBeenCalled()
  })
  it.each([
    ['student', { onboardingCompleted: true }, '/dashboard'], ['teacher', { roles: ['TEACHER'] }, '/teacher/dashboard'], ['admin', { systemRole: 'SUPER_ADMIN' }, '/admin/login'], ['onboarding', { onboardingCompleted: false }, '/onboarding/profile'],
  ])('preserves verified %s root routing', async (_label, user, path) => { mocks.auth.mockResolvedValue(session(user)); await expect(HomePage()).rejects.toThrow(`REDIRECT:${path}`); expect(mocks.redirect).toHaveBeenCalledWith(path) })
  it('does not route a profile without a backend access token into a role shell', async () => { mocks.auth.mockResolvedValue({ user: { id: 'test-user', roles: ['TEACHER'] } }); render(await HomePage()); expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument(); expect(mocks.redirect).not.toHaveBeenCalled() })
  it.each(['SCHOOL_ADMIN', 'PARENT'])('routes verified %s school members to chooser before personal entry', async (role) => { mocks.auth.mockResolvedValue(session({ onboardingCompleted: true })); mocks.school.mockResolvedValue({ items: [{ role, status: 'ACTIVE' }], nextCursor: null }); await expect(HomePage()).rejects.toThrow('REDIRECT:/workspaces'); expect(mocks.school).toHaveBeenCalledWith('isolated-test-token', '/school-identity/workspaces') })
  it('fails closed when authenticated school membership lookup is unavailable', async () => { mocks.auth.mockResolvedValue(session({ onboardingCompleted: true })); mocks.school.mockRejectedValue(new Error('Membership unavailable')); await expect(HomePage()).rejects.toThrow('Membership unavailable'); expect(mocks.redirect).not.toHaveBeenCalled() })
  it('publishes truthful review notices instead of unsupported legal or local-model guarantees', () => { render(<PrivacyPage />); expect(screen.getByRole('heading', { name: 'Policy review is pending' })).toBeInTheDocument(); expect(screen.getByText(/not a finalized privacy policy/)).toBeInTheDocument() })
  it('keeps commercial terms visibly pending', () => { render(<TermsPage />); expect(screen.getByRole('heading', { name: 'Commercial terms are pending' })).toBeInTheDocument() })
  it('provides school support instructions without an unconfigured message form', () => { render(<ContactPage />); expect(screen.getByRole('link', { name: 'Request reset instructions' })).toHaveAttribute('href', '/forgot-password'); expect(screen.queryByRole('textbox')).not.toBeInTheDocument(); expect(screen.getByText(/public enquiry channel.*not been configured/)).toBeInTheDocument() })
})
