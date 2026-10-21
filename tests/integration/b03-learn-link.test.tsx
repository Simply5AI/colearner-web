import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { z } from 'zod'
const mocks = vi.hoisted(() => ({ status: vi.fn(), home: vi.fn(), onboardingGet: vi.fn(), signOut: vi.fn(), fetch: vi.fn() }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { id: 'learner-a' } } }), signOut: mocks.signOut }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/learn/link', useSearchParams: () => new URLSearchParams() }))
vi.mock('@/lib/api/learn-link', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/api/learn-link')>(), learnLinkApi: { status: mocks.status } }))
vi.mock('@/lib/api/learn', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/api/learn')>(), learnApi: { home: mocks.home } }))
vi.mock('@/lib/api/onboarding', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/api/onboarding')>(), onboardingApi: { get: mocks.onboardingGet } }))
import { linkStages } from '@/lib/api/learn-link'
import { LearnApiError, LearnSessionError } from '@/lib/api/learn-request'
import { OnboardingError } from '@/lib/api/onboarding'
import { materialRequest } from '@/lib/api/material-request'
import { QueryProvider } from '@/lib/providers/query-provider'
import { LearnIdentityProvider } from '@/components/learn/learn-common'
import { LearnHomeScreen } from '@/components/learn/learn-home'
import { LearnLinkScreen, LearnLinkView } from '@/components/learn/learn-link'
import { LearnLinkHarness } from '@/components/learn/dev/learn-link-harness'
import { linkStatusFixture, pendingInvitationFixture } from '@/components/learn/dev/learn-link-fixtures'
import { MeetCoFlow } from '@/components/onboarding/meet-co/meet-co-flow'
import { MeetCoIdentityProvider } from '@/components/onboarding/meet-co/identity'
import { MaterialLoadState } from '@/components/materials/material-common'

beforeEach(() => { configure({ asyncUtilTimeout: 5000 }); vi.clearAllMocks(); vi.stubGlobal('fetch', mocks.fetch) })
afterEach(() => { cleanup(); configure({ asyncUtilTimeout: 1000 }) })

/** Runs a material request that must fail and returns the thrown error. */
async function materialFailure(): Promise<Error> {
  try { await materialRequest('/config', z.unknown()) } catch (caught) { return caught as Error }
  throw new Error('the request was expected to fail')
}
const bands = ['kids', 'tweens', 'teens'] as const
function Providers({ children, band = null }: { children: React.ReactNode; band?: (typeof bands)[number] | null }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return <QueryClientProvider client={client}><LearnIdentityProvider scope="account:learner-a:unselected" band={band}>{children}</LearnIdentityProvider></QueryClientProvider>
}
const screenWith = (band: (typeof bands)[number] | null = 'teens') => render(<Providers band={band}><LearnLinkScreen /></Providers>)

describe('B03 learner link: every stage in every band', () => {
  it.each(linkStages.flatMap(stage => bands.map(band => [stage, band] as const)))('%s / %s explains in plain words, names who acts and asks for nothing', (stage, band) => {
    const { container } = render(<LearnLinkView data={linkStatusFixture(stage)} band={band} onRefresh={vi.fn()} />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Who needs to act' })).toBeInTheDocument()
    expect(screen.getByTestId('waiting-on')).toHaveAttribute('data-waiting-on', linkStatusFixture(stage).waitingOn)
    expect(screen.getByText('Greenfield School')).toBeInTheDocument()
    // Nothing to type, bind or submit here, and no guardian detail of any kind.
    expect(container.querySelector('input, select, textarea, form')).toBeNull()
    expect(screen.getAllByRole('button').map(button => button.textContent)).toEqual(['Check again'])
    expect(container.textContent).not.toMatch(/@|\bemail\b|\bphone\b|\bguardian name\b/i)
    expect(container.textContent).not.toMatch(/\b(roster|binding|bind|RLS|profile id|JWT|membership)\b/i)
  })

  it('names who must act: school, grown-up or you', () => {
    const who = (stage: (typeof linkStages)[number], band: (typeof bands)[number] = 'teens') => {
      const { unmount } = render(<LearnLinkView data={linkStatusFixture(stage)} band={band} />)
      const text = within(screen.getByTestId('waiting-on')).getByText((_, element) => element?.tagName === 'P' && element.className.includes('text-lg')).textContent
      unmount(); return text
    }
    expect(who('NEEDS_ROSTER_LINK')).toBe('Your school')
    expect(who('NEEDS_GUARDIAN')).toBe('Your school')
    expect(who('PROFILE_NOT_BOUND')).toBe('Your school')
    expect(who('NEEDS_GUARDIAN_CONSENT', 'kids')).toBe('Your grown-up')
    expect(who('NEEDS_GUARDIAN_CONSENT', 'tweens')).toBe('Your parent')
    expect(who('NEEDS_GUARDIAN_CONSENT', 'teens')).toBe('Your parent or guardian')
    expect(who('CONSENT_WITHDRAWN')).toBe('Your parent or guardian')
    expect(who('READY')).toBe('Nobody. You are all set.')
    expect(who('AGE_OUT_OF_SCOPE')).toBe('Nothing you can do from here.')
  })

  it('shows the road to ready with the current step marked, earlier steps done and later steps next', () => {
    render(<LearnLinkView data={linkStatusFixture('NEEDS_GUARDIAN_CONSENT')} band="teens" />)
    const steps = within(screen.getByTestId('link-journey')).getAllByRole('listitem')
    expect(steps.map(step => step.getAttribute('data-status'))).toEqual(['done', 'done', 'current', 'todo', 'todo'])
    expect(steps[2]).toHaveAttribute('aria-current', 'step')
    expect(steps[2]).toHaveTextContent('Your parent or guardian says yes')
    expect(steps[2]).toHaveTextContent('(you are here)')
    expect(steps[0]).toHaveTextContent('(done)')
    expect(steps[4]).toHaveTextContent('(next)')
  })
  it('shows no road for the stages that are not steps on it', () => {
    for (const stage of ['CONSENT_WITHDRAWN', 'AGE_OUT_OF_SCOPE', 'SCHOOL_INACTIVE'] as const) {
      const { unmount } = render(<LearnLinkView data={linkStatusFixture(stage)} band="teens" />)
      expect(screen.queryByTestId('link-journey')).not.toBeInTheDocument()
      unmount()
    }
  })

  it('uses each band\'s own words for the grown-up', () => {
    const { rerender } = render(<LearnLinkView data={linkStatusFixture('NEEDS_GUARDIAN')} band="kids" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your school will ask your grown-up')
    rerender(<LearnLinkView data={linkStatusFixture('NEEDS_GUARDIAN')} band="tweens" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your school will ask your parent')
    rerender(<LearnLinkView data={linkStatusFixture('NEEDS_GUARDIAN')} band="teens" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('parent or guardian')
  })

  it('READY with canLearn offers one button to Home; every other stage offers none', () => {
    const { unmount } = render(<LearnLinkView data={linkStatusFixture('READY')} band="teens" />)
    expect(screen.getByRole('link', { name: 'Go to Home' })).toHaveAttribute('href', '/learn/home')
    expect(screen.queryByTestId('link-journey')?.querySelectorAll('[data-status="done"]')).toHaveLength(5)
    unmount()
    for (const stage of linkStages.filter(item => item !== 'READY')) {
      const view = render(<LearnLinkView data={linkStatusFixture(stage)} band="teens" />)
      expect(screen.queryByRole('link', { name: 'Go to Home' })).not.toBeInTheDocument()
      view.unmount()
    }
  })
  it('never offers Home unless the server also says canLearn', () => {
    render(<LearnLinkView data={{ ...linkStatusFixture('READY'), canLearn: false }} band="teens" />)
    expect(screen.queryByRole('link', { name: 'Go to Home' })).not.toBeInTheDocument()
  })

  it('links a pending student login to /student-invite and says who acts', () => {
    render(<LearnLinkView data={pendingInvitationFixture()} band="teens" />)
    expect(screen.getByRole('link', { name: 'Accept your student login' })).toHaveAttribute('href', '/student-invite')
    expect(screen.getByTestId('student-invitation')).toHaveTextContent('Accept it before')
    expect(within(screen.getByTestId('waiting-on')).getByText('You')).toBeInTheDocument()
    expect(screen.getByTestId('waiting-on')).toHaveTextContent('student login')
  })
  it('does not show the invitation when none is pending', () => {
    const { rerender } = render(<LearnLinkView data={linkStatusFixture('NEEDS_GUARDIAN_CONSENT')} band="teens" />)
    expect(screen.queryByRole('link', { name: 'Accept your student login' })).not.toBeInTheDocument()
    rerender(<LearnLinkView data={{ ...linkStatusFixture('NEEDS_GUARDIAN_CONSENT'), studentLoginInvitation: { pending: false, expiresAt: null } }} band="teens" />)
    expect(screen.queryByRole('link', { name: 'Accept your student login' })).not.toBeInTheDocument()
  })
  it('offers an informational age-check link only for the three waiting stages and only without a pending student login', () => {
    for (const stage of ['NEEDS_ROSTER_LINK', 'NEEDS_GUARDIAN', 'NEEDS_GUARDIAN_CONSENT'] as const) {
      const { unmount } = render(<LearnLinkView data={linkStatusFixture(stage)} band="teens" />)
      expect(screen.getByRole('link', { name: 'Start the age check' })).toHaveAttribute('href', '/age')
      unmount()
    }
    for (const stage of ['READY', 'PROFILE_NOT_BOUND', 'CONSENT_WITHDRAWN', 'AGE_OUT_OF_SCOPE', 'SCHOOL_INACTIVE'] as const) {
      const { unmount } = render(<LearnLinkView data={linkStatusFixture(stage)} band="teens" />)
      expect(screen.queryByRole('link', { name: 'Start the age check' })).not.toBeInTheDocument()
      unmount()
    }
    render(<LearnLinkView data={pendingInvitationFixture()} band="teens" />)
    expect(screen.queryByRole('link', { name: 'Start the age check' })).not.toBeInTheDocument()
  })
  it('works without a school name', () => {
    render(<LearnLinkView data={{ ...linkStatusFixture('NEEDS_ROSTER_LINK'), school: null }} band="teens" />)
    expect(screen.getByText('Your school link', { selector: 'p' })).toBeInTheDocument()
  })
})

describe('B03 learner link screen states', () => {
  it('loads, then shows the stage with focus on the heading', async () => {
    mocks.status.mockResolvedValue(linkStatusFixture('PROFILE_NOT_BOUND'))
    screenWith('tweens')
    expect(document.querySelector('[data-state="loading"]')).toBeInTheDocument()
    expect(screen.getByLabelText('Checking what is needed')).toBeInTheDocument()
    const heading = await screen.findByRole('heading', { level: 1, name: /One more step for your school/ })
    expect(heading).toHaveFocus()
  })
  it('falls back to neutral teen-readable wording when no band is known', async () => {
    mocks.status.mockResolvedValue(linkStatusFixture('NEEDS_GUARDIAN_CONSENT'))
    screenWith(null)
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('parent or guardian')
  })
  it('shows unavailable with a retry that works', async () => {
    mocks.status.mockRejectedValueOnce(new LearnApiError(503, 'Learning services are unavailable right now. Please try again.')).mockResolvedValue(linkStatusFixture('NEEDS_GUARDIAN'))
    screenWith()
    expect(await screen.findByText('This could not load')).toBeInTheDocument()
    expect(document.querySelector('[data-state="unavailable"]')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /See what.s needed/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { level: 1, name: /invite your parent or guardian/ })).toBeInTheDocument()
    expect(mocks.status).toHaveBeenCalledTimes(2)
  })
  it.each([403, 404])('shows denied (%i) with no retry, no detail and no link back to itself', async status => {
    mocks.status.mockRejectedValue(new LearnApiError(status, 'This learner, plan or action is not permitted by the current school and guardian settings.', 'CHILD_PROFILE_REQUIRED'))
    screenWith()
    expect(await screen.findByText('You cannot open this')).toBeInTheDocument()
    expect(document.querySelector('[data-state="denied"]')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /See what.s needed/ })).not.toBeInTheDocument()
  })
  it('shows session ended without signing an adult out', async () => {
    mocks.status.mockRejectedValue(new LearnSessionError('Your learning session has ended. Check learner access to continue.'))
    render(<QueryProvider><LearnIdentityProvider scope="child:school-a:profile-a" band="kids"><LearnLinkScreen /></LearnIdentityProvider></QueryProvider>)
    expect(await screen.findByText('Your learning session ended')).toBeInTheDocument()
    expect(document.querySelector('[data-state="session-ended"]')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Check learner access' })).toHaveAttribute('href', '/learner')
    expect(mocks.signOut).not.toHaveBeenCalled()
  })
  it('checks again on request and keeps the last answer if the recheck fails', async () => {
    mocks.status.mockResolvedValueOnce(linkStatusFixture('NEEDS_GUARDIAN_CONSENT')).mockResolvedValueOnce(linkStatusFixture('PROFILE_NOT_BOUND')).mockRejectedValueOnce(new LearnApiError(503, 'down'))
    screenWith()
    await screen.findByRole('heading', { level: 1, name: /needs to give consent/ })
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
    await screen.findByRole('heading', { level: 1, name: /needs to connect your account/ })
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('could not check again')
    expect(screen.getByRole('heading', { level: 1, name: /needs to connect your account/ })).toBeInTheDocument()
  })
  it('the development harness renders the real screen from the HTTP answer', async () => {
    mocks.status.mockResolvedValue(linkStatusFixture('SCHOOL_INACTIVE'))
    render(<QueryClientProvider client={new QueryClient()}><LearnLinkHarness /></QueryClientProvider>)
    expect(await screen.findByRole('heading', { level: 1, name: /school workspace is not active/ })).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('synthetic fixtures only')
  })
})

describe('"See what\'s needed" on CHILD_PROFILE_REQUIRED / CONSENT_REQUIRED denials', () => {
  it.each(['CHILD_PROFILE_REQUIRED', 'CONSENT_REQUIRED'])('learn: %s keeps its copy and offers the link, with no redirect and no retry loop', async code => {
    const message = code === 'CHILD_PROFILE_REQUIRED' ? 'Your school profile is not linked yet. Ask your school to finish setting it up, then come back.' : 'A grown-up needs to say yes before you can learn here. Ask them to check your settings.'
    mocks.home.mockRejectedValue(new LearnApiError(403, message, code))
    render(<Providers band="tweens"><LearnHomeScreen /></Providers>)
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /See what.s needed/ })).toHaveAttribute('href', '/learn/link')
    expect(mocks.home).toHaveBeenCalledTimes(1)
  })
  it('learn: other denials keep their state and do not get the link', async () => {
    mocks.home.mockRejectedValue(new LearnApiError(403, 'Learning here is not available for this age yet.', 'AGE_OUT_OF_SCOPE'))
    render(<Providers band="teens"><LearnHomeScreen /></Providers>)
    expect(await screen.findByText('Learning here is not available for this age yet.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /See what.s needed/ })).not.toBeInTheDocument()
  })

  it.each(['CHILD_PROFILE_REQUIRED', 'CONSENT_REQUIRED'])('onboarding (Meet Co): %s offers the link beside the existing copy', async code => {
    const message = code === 'CHILD_PROFILE_REQUIRED' ? 'Your school profile is not linked yet. Ask your school to finish setting it up, then come back.' : 'A grown-up needs to say yes before you can start. Ask them to check your settings.'
    mocks.onboardingGet.mockRejectedValue(new OnboardingError(403, message, code))
    render(<QueryClientProvider client={new QueryClient()}><MeetCoIdentityProvider value={{ scope: 'test:teens', learnerName: 'Rohan', kind: 'account' }}><MeetCoFlow /></MeetCoIdentityProvider></QueryClientProvider>)
    expect(await screen.findByText('Setup is not available for this learner')).toBeInTheDocument()
    expect(screen.getByText(message)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /See what.s needed/ })).toHaveAttribute('href', '/learn/link')
    expect(mocks.onboardingGet).toHaveBeenCalledTimes(1)
  })
  it('onboarding (Meet Co): an unrelated denial has no link', async () => {
    mocks.onboardingGet.mockRejectedValue(new OnboardingError(403, 'Setup is not available for this age yet.', 'AGE_OUT_OF_SCOPE'))
    render(<QueryClientProvider client={new QueryClient()}><MeetCoIdentityProvider value={{ scope: 'test:teens', learnerName: 'Rohan', kind: 'child' }}><MeetCoFlow /></MeetCoIdentityProvider></QueryClientProvider>)
    expect(await screen.findByText('Setup is not available for this learner')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /See what.s needed/ })).not.toBeInTheDocument()
  })

  it.each(['CHILD_PROFILE_REQUIRED', 'CONSENT_REQUIRED'])('materials: a %s 403 from the BFF keeps the existing copy and offers the link', async code => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ statusCode: 403, code, message: 'Forbidden' }), { status: 403 }))
    const error = await materialFailure()
    expect(error.message).toBe('This learner, source or action is not permitted by the current school and guardian policy.')
    expect(error).toMatchObject({ status: 403, code })
    render(<MaterialLoadState error={error} retry={vi.fn()} />)
    expect(screen.getByText('This learner, source or action is not permitted by the current school and guardian policy.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /See what.s needed/ })).toHaveAttribute('href', '/learn/link')
    expect(screen.getByRole('link', { name: 'Check learner access' })).toHaveAttribute('href', '/learner')
  })
  it('materials: other failures have no link, and the 401 path is unchanged', async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ code: 'POLICY_BLOCKED' }), { status: 403 }))
    const blocked = await materialFailure()
    render(<MaterialLoadState error={blocked} retry={vi.fn()} />)
    expect(screen.queryByRole('link', { name: /See what.s needed/ })).not.toBeInTheDocument()
    mocks.fetch.mockResolvedValue(new Response('not json', { status: 403 }))
    expect(await materialFailure()).toMatchObject({ status: 403, code: undefined })
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ code: 'CONSENT_REQUIRED' }), { status: 401 }))
    expect(await materialFailure()).toMatchObject({ name: 'Error', status: 401 })
    await waitFor(() => expect(mocks.signOut).not.toHaveBeenCalled())
  })
})
