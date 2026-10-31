import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
const mocks = vi.hoisted(() => ({ home: vi.fn(), overview: vi.fn(), plan: vi.fn(), join: vi.fn() }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { id: 'learner-a' } } }) }))
vi.mock('@/lib/hooks/use-profile', () => ({ useProfile: () => ({ data: { dateOfBirth: '2012-01-01' } }) }))
vi.mock('@/lib/api/learn', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/api/learn')>(), learnApi: mocks }))
import type { LearnHome, LearnOverview, PlanDetail } from '@/lib/api/learn'
import { LearnApiError, LearnSessionError } from '@/lib/api/learn-request'
import { LearnIdentityProvider } from '@/components/learn/learn-common'
import { LearnHomeScreen, LearnHomeView } from '@/components/learn/learn-home'
import { LearnOverviewScreen, LearnOverviewView } from '@/components/learn/learn-overview'
import { LearnPlanScreen, PlanDetailView } from '@/components/learn/learn-plan'
import { LearnBrowserHarness } from '@/components/learn/dev/learn-browser-harness'
import { homeFixture, overviewFixture as rawOverviewFixture, planFixture as rawPlanFixture } from '@/components/learn/dev/learn-fixtures'

// The fixtures derive exam dates from Date.now(). Build them at a fixed instant (noon UTC, so the calendar date
// is the same in every timezone from UTC-11 to UTC+11) so the asserted exam date never depends on the run day or zone.
const pinned = <A extends unknown[], R>(make: (...args: A) => R) => (...args: A): R => {
  const spy = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-21T12:00:00Z'))
  try { return make(...args) } finally { spy.mockRestore() }
}
const overviewFixture = pinned(rawOverviewFixture)
const planFixture = pinned(rawPlanFixture)
import { dueLabel } from '@/components/learn/learn-format'
import { matchesNavItem, studentNavigation } from '@/components/roles/role-config'

beforeEach(() => { configure({ asyncUtilTimeout: 5000 }); vi.clearAllMocks() })
afterEach(() => { cleanup(); configure({ asyncUtilTimeout: 1000 }) })

const harnessParams = vi.hoisted(() => ({ value: '' }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/learn', useSearchParams: () => new URLSearchParams(harnessParams.value) }))

function Providers({ children, scope = 'account:learner-a:unselected', band = null }: { children: React.ReactNode; scope?: string; band?: 'kids' | 'tweens' | 'teens' | null }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return <QueryClientProvider client={client}><LearnIdentityProvider scope={scope} band={band}>{children}</LearnIdentityProvider></QueryClientProvider>
}
const noJoin = vi.fn()
const overviewView = (overview: LearnOverview, extra: Partial<React.ComponentProps<typeof LearnOverviewView>> = {}) => render(<LearnOverviewView overview={overview} filters={{}} onFiltersChange={vi.fn()} onJoin={noJoin} {...extra} />)

describe('L1 home by band', () => {
  it('kids: picture-first, one dominant step shown as stepping stones, time pill, no percentages or dense stats', () => {
    const { container } = render(<LearnHomeView data={homeFixture('kids')} />)
    expect(screen.getByText(/Hi Aarav! Let.s finish Parts of a plant!/)).toBeInTheDocument()
    expect(screen.getByTestId('time-left')).toHaveTextContent('20 minutes left today')
    const card = screen.getByTestId('next-action')
    expect(within(card).getByRole('heading', { name: 'Parts of a plant' })).toBeInTheDocument()
    expect(within(card).getByRole('img', { name: '2 of 5 steps done' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Snap something new' })).toHaveAttribute('href', '/learn/snap')
    expect(screen.getByRole('link', { name: 'Play' })).toHaveAttribute('href', '/learn/practice')
    expect(container.textContent).not.toMatch(/%/)
    expect(screen.queryByTestId('due-reviews')).not.toBeInTheDocument()
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/XP|league|quest/i)).not.toBeInTheDocument()
  })
  it('tweens: next step, today plan, tutor assignment and streak; no XP, quest or level widgets', () => {
    render(<LearnHomeView data={homeFixture('tweens')} />)
    expect(screen.getByTestId('next-action')).toHaveTextContent('Adding fractions')
    const plan = screen.getByRole('region', { name: /Today.s plan/ })
    expect(within(plan).getAllByRole('listitem')).toHaveLength(3)
    expect(plan).toHaveTextContent('about 15 minutes')
    const assignment = screen.getByTestId('assignment')
    expect(assignment).toHaveTextContent('Fractions worksheet')
    expect(assignment).toHaveTextContent('From Mr. Thomas · Class 6A')
    expect(within(assignment).getByRole('link', { name: 'Open assignment' })).toHaveAttribute('href', '/learn/plans/plan-assigned')
    expect(screen.getByText('5 day streak')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/\bXP\b|quest|Level \d/i)
  })
  it('teens: exam countdown, subject cards from measured progress, mastery only when non-null', () => {
    render(<LearnHomeView data={homeFixture('teens')} />)
    expect(screen.getByTestId('exam-countdown')).toHaveTextContent('Board exams in 142 days')
    expect(screen.getAllByTestId('subject-progress')).toHaveLength(4)
    expect(screen.getAllByTestId('mastery').map(node => node.textContent)).toEqual(['Mastery 62%', 'Mastery 71%'])
    expect(screen.getByText('Nothing planned yet')).toBeInTheDocument()
    expect(screen.getByTestId('due-reviews')).toHaveTextContent('5 reviews due')
    expect(document.body.textContent).not.toMatch(/ready for Chemistry|league|\bXP\b/i)
  })
  it('hides exam, subjects, streak and time budget when the server sends null or empty', () => {
    render(<LearnHomeView data={{ ...homeFixture('teens'), examCountdown: null, subjectProgress: [], streak: null, timeBudget: null, dueReviewCount: 0, todayPlan: null }} />)
    for (const test of ['exam-countdown', 'subject-progress', 'due-reviews', 'time-left']) expect(screen.queryByTestId(test)).not.toBeInTheDocument()
    expect(screen.queryByText(/streak/)).not.toBeInTheDocument()
  })
  it('separates Co suggestions from measured progress and shows them only when AVAILABLE', () => {
    const { rerender } = render(<LearnHomeView data={homeFixture('teens')} />)
    const suggestion = screen.getByTestId('recommendation')
    expect(within(suggestion).getByText(/Co.s suggestion/)).toBeInTheDocument()
    expect(suggestion).toHaveTextContent('A suggestion from Co, not a score')
    expect(screen.getByText('Measured progress')).toBeInTheDocument()
    rerender(<LearnHomeView data={{ ...homeFixture('teens'), recommendation: { status: 'UNAVAILABLE', reason: 'off' } }} />)
    expect(screen.queryByTestId('recommendation')).not.toBeInTheDocument()
    rerender(<LearnHomeView data={{ ...homeFixture('teens'), recommendation: { status: 'AVAILABLE', items: [], generatedAt: '2026-10-19T00:00:00Z', promptRelease: 'x' } }} />)
    expect(screen.queryByTestId('recommendation')).not.toBeInTheDocument()
  })
  it('never renders a disabled lesson or review as a working link and shows the server reason', () => {
    render(<LearnHomeView data={homeFixture('tweens')} />)
    const next = screen.getByTestId('next-action')
    expect(within(next).queryByRole('link', { name: 'Continue' })).not.toBeInTheDocument()
    expect(within(next).getByRole('button', { name: 'Continue' })).toBeDisabled()
    expect(within(next).getByText('Lessons open when the lesson player ships. Your plan is saved.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Start' }).every(button => (button as HTMLButtonElement).disabled)).toBe(true)
    expect(screen.getByText('Reviews open when practice ships.')).toBeInTheDocument()
  })
  it('does not trust enabled:true for a practice link the web cannot open (no scope), but opens a scoped one (B09)', () => {
    const data = homeFixture('teens')
    render(<LearnHomeView data={{ ...data, nextAction: { ...data.nextAction!, link: { route: 'PRACTICE', id: 'p-1' }, enabled: true, disabledReason: null } }} />)
    expect(screen.queryByRole('link', { name: 'Continue' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    expect(screen.getByText('This part of CoLearner is still being built.')).toBeInTheDocument()
    cleanup()
    render(<LearnHomeView data={{ ...data, nextAction: { ...data.nextAction!, kind: 'DUE_REVIEW', link: { route: 'PRACTICE', id: null, scope: 'DUE' }, enabled: true, disabledReason: null } }} />)
    expect(screen.getByRole('link', { name: 'Start review' })).toHaveAttribute('href', '/learn/practice')
  })
  it('B08: an enabled lesson link is a real link to the lesson start page, and a disabled one still shows the server reason', () => {
    const data = homeFixture('teens')
    render(<LearnHomeView data={{ ...data, nextAction: { ...data.nextAction!, link: { route: 'LESSON', id: 'material-9', planItemId: 'item-2' }, enabled: true, disabledReason: null } }} />)
    expect(screen.getByRole('link', { name: 'Continue' })).toHaveAttribute('href', '/learn/lesson/new?materialId=material-9&planItemId=item-2')
  })
  it('turns a real enabled plan link into a working link', () => {
    const data = homeFixture('teens')
    render(<LearnHomeView data={{ ...data, nextAction: { ...data.nextAction!, kind: 'START_PLAN', link: { route: 'PLAN', id: 'plan-7' }, enabled: true, disabledReason: null } }} />)
    expect(screen.getByRole('link', { name: 'Start plan' })).toHaveAttribute('href', '/learn/plans/plan-7')
  })
  it.each(['kids', 'tweens', 'teens'] as const)('%s first time: Co and one call to action, no empty widgets', band => {
    render(<LearnHomeView data={homeFixture(band, 'first-time')} />)
    expect(screen.getByRole('heading', { name: 'Bring something to learn' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: band === 'kids' ? 'Snap a page from your book!' : 'Bring something to learn' })).toBeInTheDocument()
    for (const heading of [/Today.s plan/, /Assigned/, /subjects/i, /Recent/]) expect(screen.queryByRole('heading', { name: heading })).not.toBeInTheDocument()
  })
  it('limit reached: says so, rests Co and keeps lessons unavailable', () => {
    render(<LearnHomeView data={homeFixture('tweens', 'limit-reached')} />)
    expect(screen.getByText(/reached today.s learning time/)).toBeInTheDocument()
    expect(screen.getByTestId('time-left')).toHaveTextContent('No time left today')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })
  it('formats due dates in friendly language and flags overdue without shaming kids', () => {
    const now = new Date('2026-10-19T09:00:00Z')
    expect(dueLabel('2026-10-22T12:00:00Z', 'tweens', now)?.text).toMatch(/^Due [A-Z][a-z]+day$/)
    expect(dueLabel('2026-10-19T20:00:00Z', 'tweens', now)?.text).toBe('Due today')
    expect(dueLabel('2026-10-10T12:00:00Z', 'kids', now)).toEqual({ text: 'Waiting for you', overdue: true })
    expect(dueLabel('2026-10-10T12:00:00Z', 'teens', now)?.text).toMatch(/^Was due/)
    expect(dueLabel(null, 'teens', now)).toBeNull()
  })
})

describe('L1 server-backed states', () => {
  it('shows a skeleton with Co thinking, then the home', async () => {
    let finish: (value: LearnHome) => void = () => undefined
    mocks.home.mockReturnValue(new Promise<LearnHome>(resolve => { finish = resolve }))
    render(<Providers band="kids"><LearnHomeScreen /></Providers>)
    expect(screen.getByRole('status', { name: 'Loading your home' })).toBeInTheDocument()
    finish(homeFixture('kids'))
    expect(await screen.findByTestId('next-action')).toBeInTheDocument()
  })
  it('denied (403) offers no retry and leaks no detail', async () => {
    mocks.home.mockRejectedValue(new LearnApiError(403, 'This learner, plan or action is not permitted by the current school and guardian settings.'))
    render(<Providers><LearnHomeScreen /></Providers>)
    expect(await screen.findByText('You cannot open this')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Learn' })).toHaveAttribute('href', '/learn')
  })
  it('unavailable offers retry that fetches again and recovers', async () => {
    mocks.home.mockRejectedValueOnce(new LearnApiError(503, 'Learning services are unavailable right now. Please try again.')).mockResolvedValue(homeFixture('teens'))
    render(<Providers><LearnHomeScreen /></Providers>)
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByTestId('next-action')).toBeInTheDocument()
    expect(mocks.home).toHaveBeenCalledTimes(2)
  })
  it('an ended session points at learner access instead of retrying', async () => {
    mocks.home.mockRejectedValue(new LearnSessionError('Your learning session has ended. Check learner access to continue.'))
    render(<Providers><LearnHomeScreen /></Providers>)
    expect(await screen.findByRole('link', { name: 'Check learner access' })).toHaveAttribute('href', '/learner')
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })
})

describe('L2 learn: subjects and plans', () => {
  it('kids: adventure cards with stepping stones, no filters or percentages', () => {
    const { container } = overviewView(overviewFixture('kids'))
    expect(screen.getByRole('heading', { name: 'My adventures' })).toBeInTheDocument()
    expect(screen.getByText('Pick an adventure!')).toBeInTheDocument()
    expect(screen.getAllByTestId('plan-card')).toHaveLength(2)
    expect(screen.getAllByRole('img', { name: /steps done/ }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('search')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Join with a code' })).not.toBeInTheDocument()
    expect(container.textContent).not.toMatch(/%/)
  })
  it('tweens: merges personal and teacher plans, attributes the teacher and marks structure locked', () => {
    overviewView(overviewFixture('tweens'))
    const cards = screen.getAllByTestId('plan-card')
    const assigned = cards.find(card => card.getAttribute('data-kind') === 'ASSIGNED')!
    const personal = cards.find(card => card.getAttribute('data-kind') === 'PERSONAL')!
    expect(assigned).toHaveTextContent('From Mr. Thomas · Class 6A')
    expect(assigned).toHaveTextContent('Set by your teacher')
    expect(assigned).toHaveTextContent(/[Dd]ue /)
    expect(personal).toHaveTextContent('My plan')
    expect(personal).not.toHaveTextContent('Set by your teacher')
    expect(within(assigned).getByRole('link', { name: 'Open Fractions' })).toHaveAttribute('href', '/learn/plans/plan-assigned')
    expect(screen.getByRole('link', { name: 'New plan' })).toBeInTheDocument()
  })
  it('teens: exam prep card with exam date and next item', () => {
    overviewView(overviewFixture('teens'))
    const exam = screen.getAllByTestId('plan-card').find(card => card.textContent?.includes('Exam prep: Board exams'))!
    expect(exam).toHaveTextContent('Next: Algebra revision')
    expect(exam).toHaveTextContent(/Exam (?:12 Mar 2027|Mar 12, 2027)/)
  })
  it('shows the server reason instead of controls it does not allow', () => {
    overviewView({ ...overviewFixture('tweens'), canJoinWithCode: false, canCreatePersonalPlan: false, unavailableReason: 'Your school has not turned on joining with a code yet.' })
    expect(screen.queryByRole('button', { name: 'Join with a code' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'New plan' })).not.toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('Your school has not turned on joining with a code yet.')
  })
  it('empty: Co invites the learner to import, with no empty widgets', () => {
    overviewView(overviewFixture('tweens', 'empty'))
    expect(screen.getByRole('heading', { name: 'Nothing here yet' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Bring something to learn' })).toHaveAttribute('href', '/learn/import')
    expect(screen.queryByTestId('plan-card')).not.toBeInTheDocument()
  })
  it('approval pending: lists waiting requests with age-appropriate copy', () => {
    const { unmount } = overviewView(overviewFixture('tweens', 'approval-pending'))
    expect(screen.getByRole('heading', { name: 'Waiting for your parent to say yes' })).toBeInTheDocument()
    expect(screen.getByTestId('pending-enrollment')).toHaveTextContent('Fractions')
    unmount()
    overviewView(overviewFixture('teens', 'approval-pending'))
    expect(screen.getByRole('heading', { name: 'Waiting for your parent or guardian to approve' })).toBeInTheDocument()
  })
  it('search, subject, whose-plan and status filters report the server query', async () => {
    const onFiltersChange = vi.fn()
    overviewView(overviewFixture('teens'), { onFiltersChange })
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 's1' } })
    expect(onFiltersChange).toHaveBeenLastCalledWith({ subjectId: 's1' })
    fireEvent.change(screen.getByLabelText('Whose plan'), { target: { value: 'ASSIGNED' } })
    expect(onFiltersChange).toHaveBeenLastCalledWith({ kind: 'ASSIGNED' })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'COMPLETED' } })
    expect(onFiltersChange).toHaveBeenLastCalledWith({ status: 'COMPLETED' })
    fireEvent.change(screen.getByLabelText('Search plans or classes'), { target: { value: 'Kapoor' } })
    await waitFor(() => expect(onFiltersChange).toHaveBeenLastCalledWith({ q: 'Kapoor' }))
  })
  it('a subject card toggles its filter and no matches can be cleared', () => {
    const onFiltersChange = vi.fn()
    const { unmount } = overviewView(overviewFixture('teens'), { onFiltersChange })
    fireEvent.click(screen.getAllByTestId('subject-card')[0]!)
    expect(onFiltersChange).toHaveBeenCalledWith({ subjectId: 's1' })
    unmount()
    overviewView({ ...overviewFixture('teens'), plans: [] }, { filters: { q: 'zzz' }, onFiltersChange })
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(onFiltersChange).toHaveBeenLastCalledWith({})
  })
})

describe('L2 join with a code and pending guardian approval', () => {
  const open = () => fireEvent.click(screen.getByRole('button', { name: 'Join with a code' }))
  it('minor: shows the waiting state, never retries the decided code, and never claims enrolment', async () => {
    const onJoin = vi.fn().mockResolvedValue({ status: 'PENDING_GUARDIAN_APPROVAL', enrollmentId: 'e1', planId: null })
    overviewView(overviewFixture('tweens'), { onJoin })
    open()
    const dialog = await screen.findByRole('dialog', { name: 'Join with a code' })
    fireEvent.change(within(dialog).getByLabelText('Class code'), { target: { value: ' ABC123 ' } })
    fireEvent.submit(within(dialog).getByLabelText('Class code').closest('form')!)
    expect(await within(dialog).findByText('Waiting for your parent to say yes')).toBeInTheDocument()
    expect(within(dialog).queryByText('You are in!')).not.toBeInTheDocument()
    expect(onJoin).toHaveBeenCalledTimes(1)
    expect(onJoin).toHaveBeenCalledWith('ABC123')
  })
  it('a double press sends one request', async () => {
    let finish: (value: unknown) => void = () => undefined
    const onJoin = vi.fn().mockReturnValue(new Promise(resolve => { finish = resolve }))
    overviewView(overviewFixture('teens'), { onJoin })
    open()
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Class code'), { target: { value: 'ABC' } })
    const form = within(dialog).getByLabelText('Class code').closest('form')!
    fireEvent.submit(form); fireEvent.submit(form)
    expect(onJoin).toHaveBeenCalledTimes(1)
    finish({ status: 'ENROLLED', enrollmentId: 'e1', planId: 'plan-9' })
    expect(await within(dialog).findByText('You are in!')).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: 'Open the plan' })).toHaveAttribute('href', '/learn/plans/plan-9')
  })
  it('a failed code keeps what was typed, shows a safe message, and can be tried again', async () => {
    const onJoin = vi.fn().mockRejectedValueOnce(new LearnApiError(410, 'That code has expired. Ask your teacher for a new one.', 'CODE_EXPIRED')).mockResolvedValue({ status: 'PENDING_GUARDIAN_APPROVAL', enrollmentId: 'e1', planId: null })
    overviewView(overviewFixture('teens'), { onJoin })
    open()
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Class code'), { target: { value: 'OLD1' } })
    fireEvent.submit(within(dialog).getByLabelText('Class code').closest('form')!)
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('That code has expired. Ask your teacher for a new one.')
    expect(within(dialog).getByLabelText('Class code')).toHaveValue('OLD1')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try again' }))
    expect(await within(dialog).findByText('Waiting for your parent or guardian to approve')).toBeInTheDocument()
    expect(onJoin).toHaveBeenCalledTimes(2)
  })
  it('does not submit an empty code and closes with Escape', async () => {
    const onJoin = vi.fn()
    overviewView(overviewFixture('tweens'), { onJoin, initialJoinOpen: true })
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Join' })).toBeDisabled()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onJoin).not.toHaveBeenCalled()
  })
})

describe('L2 server-backed screen', () => {
  it('loads, shows more pages with the cursor and refreshes after a join', async () => {
    mocks.overview.mockResolvedValueOnce({ ...overviewFixture('tweens'), nextCursor: 'cursor-2' }).mockResolvedValueOnce({ ...overviewFixture('tweens'), plans: [{ ...overviewFixture('tweens').plans[0]!, id: 'plan-3', title: 'Third plan' }], nextCursor: null }).mockResolvedValue(overviewFixture('tweens'))
    mocks.join.mockResolvedValue({ status: 'PENDING_GUARDIAN_APPROVAL', enrollmentId: 'e1', planId: null })
    render(<Providers><LearnOverviewScreen /></Providers>)
    expect(await screen.findAllByTestId('plan-card')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }))
    await waitFor(() => expect(screen.getAllByTestId('plan-card')).toHaveLength(3))
    expect(mocks.overview).toHaveBeenLastCalledWith({}, 'cursor-2')
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Join with a code' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Class code'), { target: { value: 'ABC' } })
    fireEvent.submit(within(dialog).getByLabelText('Class code').closest('form')!)
    await within(dialog).findByText('Waiting for your parent to say yes')
    expect(mocks.join).toHaveBeenCalledWith('ABC')
    await waitFor(() => expect(mocks.overview.mock.calls.length).toBeGreaterThanOrEqual(3))
  })
  it('unavailable shows retry and denied shows no retry', async () => {
    mocks.overview.mockRejectedValueOnce(new LearnApiError(503, 'Learning services are unavailable right now. Please try again.')).mockResolvedValue(overviewFixture('teens'))
    render(<Providers><LearnOverviewScreen /></Providers>)
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Learn' })).toBeInTheDocument()
    cleanup()
    mocks.overview.mockReset().mockRejectedValue(new LearnApiError(403, 'not permitted'))
    render(<Providers><LearnOverviewScreen /></Providers>)
    expect(await screen.findByText('You cannot open this')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })
})

describe('L3 plan detail', () => {
  const show = (band: 'kids' | 'tweens' | 'teens', state: 'default' | 'topic-expanded' | 'no-sources' | 'locked' = 'default', edit?: (detail: PlanDetail) => PlanDetail) => {
    const { detail, expandedTopicId } = planFixture(band, state)
    return render(<PlanDetailView detail={edit ? edit(detail) : detail} band={band} initialExpandedTopicId={expandedTopicId} />)
  }
  it('kids: adventure map of stepping stones with the current stone and Co, and tapping opens its lesson', () => {
    show('kids')
    const stones = screen.getAllByRole('button', { name: /,/ }).filter(button => button.hasAttribute('data-stone'))
    expect(stones.map(stone => stone.getAttribute('data-stone'))).toEqual(['done', 'done', 'todo', 'current', 'todo'])
    expect(screen.getByTestId('next-stone')).toHaveTextContent('Next: Leaves!')
    expect(screen.getByRole('button', { name: 'Seeds, done' })).toBeInTheDocument()
    expect(screen.queryByTestId('topic-panel')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Leaves, next up' }))
    const panel = screen.getByTestId('topic-panel')
    expect(within(panel).getByText('Leaves make food')).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Start lesson' })).toBeDisabled()
    expect(document.body.textContent).not.toMatch(/%/)
  })
  it('tweens: levels with lessons and a quiz, due date, and the teacher note on a locked assignment', () => {
    show('tweens')
    expect(screen.getAllByTestId('phase')).toHaveLength(4)
    expect(screen.getByRole('heading', { name: 'Level 3: Adding fractions' })).toBeInTheDocument()
    expect(screen.getByTestId('teacher-note')).toHaveTextContent('A note from Mr. Thomas')
    expect(screen.getAllByTestId('plan-item')).toHaveLength(8)
    expect(screen.getByText('What is a fraction: lesson')).toBeInTheDocument()
    expect(screen.getByText('Fractions in real life: quiz')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Fraction worksheet' }).length).toBeGreaterThan(0)
    expect(document.body.textContent).toMatch(/[Dd]ue /)
  })
  it('locked assignment shows who controls it and offers no edit, attach, reorder or remove affordance', () => {
    show('tweens')
    const note = screen.getByRole('note')
    expect(note).toHaveTextContent('Mr. Thomas controls the levels of this plan.')
    expect(screen.getAllByText('Set by your teacher').length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: /Import a source|Bring material/ })).not.toBeInTheDocument()
    for (const name of [/edit/i, /rename/i, /delete/i, /remove/i, /reorder|move/i, /add (a )?(step|topic|level)/i]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument()
    }
  })
  it.each(['kids', 'teens'] as const)('%s locked state is the same even for a plan that was personal-shaped', band => {
    show(band, 'locked')
    expect(screen.getByRole('note')).toHaveTextContent('controls the steps of this plan')
    expect(screen.getByTestId('teacher-note')).toHaveTextContent('Work through the steps in order.')
    expect(screen.queryByRole('link', { name: /Import a source/ })).not.toBeInTheDocument()
  })
  it('teens: chapters with measured mastery only when non-null, mock test, weak concepts and materials', () => {
    show('teens')
    expect(screen.getAllByTestId('topic-mastery').map(node => node.textContent?.replace(/Measured$/, ''))).toEqual(['Mastery 78%', 'Mastery 55%'])
    expect(screen.getByRole('button', { name: 'Take a mock test' })).toBeDisabled()
    expect(screen.getAllByText('Mock tests open when practice ships.').length).toBeGreaterThan(0)
    expect(screen.getByTestId('weak-concepts')).toHaveTextContent('Indicators')
    expect(screen.getByTestId('weak-concepts')).toHaveTextContent('Measured from your practice')
    expect(screen.getAllByTestId('plan-material')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Class notes: indicators' })).toHaveAttribute('href', '/learn/library/m-1')
    expect(screen.getByText(/Exam (?:12 Mar 2027|Mar 12, 2027)/)).toBeInTheDocument()
  })
  it('hides weak concepts when empty (measured mastery does not exist yet)', () => {
    show('teens', 'default', detail => ({ ...detail, weakConcepts: [] }))
    expect(screen.queryByTestId('weak-concepts')).not.toBeInTheDocument()
  })
  it('topic expanded: only the chosen chapter topic is open and items show server reasons', () => {
    show('teens', 'topic-expanded')
    const toggles = screen.getAllByRole('button', { expanded: true })
    expect(toggles).toHaveLength(1)
    expect(toggles[0]).toHaveTextContent('Acids and bases')
    expect(screen.getAllByRole('button', { expanded: false }).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Lessons open when the lesson player ships. Your plan is saved.').length).toBeGreaterThan(0)
    fireEvent.click(toggles[0]!)
    expect(screen.queryByText('pH practice')).not.toBeInTheDocument()
  })
  it('start next is the dominant action and honest about being unavailable', () => {
    show('teens')
    const start = within(screen.getByTestId('start-next'))
    expect(start.getByRole('button', { name: 'Start next: Indicators' })).toBeDisabled()
    expect(start.getByText('Lessons open when the lesson player ships. Your plan is saved.')).toBeInTheDocument()
  })
  it('start next is absent when the server does not permit it', () => {
    show('teens', 'default', detail => ({ ...detail, permissions: { ...detail.permissions, canStartNext: false } }))
    expect(screen.queryByTestId('start-next')).not.toBeInTheDocument()
  })
  it('no sources: asks for material with an import action and shows Co suggestions only when AVAILABLE', () => {
    const { unmount } = show('teens', 'no-sources')
    expect(screen.getAllByText('Bring material for this topic').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'No sources yet' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Bring material' })).toHaveAttribute('href', '/learn/import')
    expect(screen.getByTestId('suggested-resources')).toHaveTextContent('A beginner overview to start with')
    unmount()
    show('teens', 'no-sources', detail => ({ ...detail, suggestedResources: { status: 'UNAVAILABLE', reason: 'off' } }))
    expect(screen.queryByTestId('suggested-resources')).not.toBeInTheDocument()
  })
  it('no sources on a locked plan has no import action', () => {
    show('tweens', 'no-sources')
    expect(screen.queryByRole('link', { name: /Bring material|Import a source/ })).not.toBeInTheDocument()
    expect(screen.getByText('No sources have been added to this plan yet.')).toBeInTheDocument()
  })
  it('suggested resources are labelled as Co suggestions and only safe links leave the app', () => {
    show('teens', 'default', detail => ({ ...detail, suggestedResources: { status: 'AVAILABLE', generatedAt: '2026-10-19T00:00:00Z', promptRelease: 'x', items: [{ title: 'Safe link', url: 'https://example.org/a', reason: 'Because.' }, { title: 'Unsafe link', url: 'javascript:alert(1)', reason: 'Nope.' }] } }))
    const panel = screen.getByTestId('suggested-resources')
    expect(within(panel).getByText(/Co.s suggestion/)).toBeInTheDocument()
    const safe = within(panel).getByRole('link', { name: /Safe link/ })
    expect(safe).toHaveAttribute('href', 'https://example.org/a')
    expect(safe).toHaveAttribute('rel', 'noopener noreferrer')
    expect(safe).toHaveAttribute('target', '_blank')
    expect(within(panel).queryByRole('link', { name: /Unsafe link/ })).not.toBeInTheDocument()
    expect(within(panel).getByText('Unsafe link')).toBeInTheDocument()
  })
})

describe('L3 server-backed screen', () => {
  it('opens a plan in the band the server resolved, not the profile date of birth or the child scope', async () => {
    // The mocked profile is 2012-01-01 (tweens) and the child scope says kids; the server says 14-17.
    mocks.plan.mockResolvedValue({ ...planFixture('tweens').detail, band: '14-17' })
    const { container } = render(<Providers scope="child:s:p" band="kids"><LearnPlanScreen planId="plan-assigned" /></Providers>)
    expect(await screen.findByRole('heading', { name: 'Fractions', level: 1 })).toBeInTheDocument()
    expect(mocks.plan).toHaveBeenCalledWith('plan-assigned')
    expect(container.querySelector('[data-age-band="teens"]')).not.toBeNull()
    expect(container.querySelector('[data-age-band="kids"]')).toBeNull()
    expect(container.querySelector('[data-age-band="tweens"]')).toBeNull()
  })
  it('a child identity supplies the band while loading', async () => {
    mocks.plan.mockReturnValue(new Promise(() => undefined))
    const { container } = render(<Providers scope="child:s:p" band="kids"><LearnPlanScreen planId="plan-1" /></Providers>)
    expect(screen.getByRole('status', { name: 'Loading your plan' })).toBeInTheDocument()
    expect(container.querySelector('[data-age-band="kids"]')).not.toBeNull()
  })
  it('another learner or missing plan looks identical: denied, no retry, no detail', async () => {
    mocks.plan.mockRejectedValue(new LearnApiError(404, 'This is unavailable, or you no longer have access to it.'))
    render(<Providers><LearnPlanScreen planId="plan-x" /></Providers>)
    expect(await screen.findByText('You cannot open this')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Learn' })).toHaveAttribute('href', '/learn')
  })
  it('unavailable retries', async () => {
    mocks.plan.mockRejectedValueOnce(new LearnApiError(503, 'Learning services are unavailable right now. Please try again.')).mockResolvedValue(planFixture('teens').detail)
    render(<Providers><LearnPlanScreen planId="plan-chem" /></Providers>)
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: /Chemistry/, level: 1 })).toBeInTheDocument()
  })
})

describe('development harness', () => {
  const open = (query: string) => { harnessParams.value = query; return render(<LearnBrowserHarness />) }
  it('labels itself as synthetic and renders each band and state without a request', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    open('screen=home&band=kids')
    expect(screen.getByRole('note')).toHaveTextContent('synthetic fixtures only')
    cleanup(); open('screen=home&band=tweens&state=loading')
    expect(screen.getByRole('status', { name: 'Loading your home' })).toBeInTheDocument()
    cleanup(); open('screen=learn&band=teens&state=join-code')
    expect(screen.getByRole('dialog', { name: 'Join with a code' })).toBeInTheDocument()
    cleanup(); open('screen=plan&band=kids&state=topic-expanded')
    expect(screen.getByTestId('topic-panel')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('student navigation points at the B07 routes', () => {
  const items = (band: 'kids' | 'teens') => studentNavigation(band, true).flatMap(group => group.items)
  const active = (band: 'kids' | 'teens', path: string) => items(band).filter(item => matchesNavItem(path, item)).map(item => item.href)
  it('Home is /learn/home and Learn is /learn for tweens and teens, without swallowing the library tools', () => {
    const teens = items('teens')
    expect(teens.find(item => item.label === 'Home')?.href).toBe('/learn/home')
    expect(teens.find(item => item.label === 'Learn')?.href).toBe('/learn')
    expect(active('teens', '/learn/home')).toEqual(['/learn/home'])
    expect(active('teens', '/learn')).toEqual(['/learn'])
    expect(active('teens', '/learn/plans/plan-1')).toEqual(['/learn'])
    expect(active('teens', '/learn/library')).toEqual(['/learn/library'])
    expect(active('teens', '/learn/import')).toEqual(['/learn/library'])
  })
  it('keeps the retained legacy dashboard and roadmaps highlighted', () => {
    expect(active('teens', '/dashboard')).toEqual(['/learn/home'])
    expect(active('teens', '/roadmaps/abc')).toEqual(['/learn'])
  })
  it('B09: Practice and Play open /learn/practice and stay lit on every practice route, including the retained legacy ones', () => {
    expect(items('teens').find(item => item.label === 'Practice')?.href).toBe('/learn/practice')
    expect(items('kids').find(item => item.label === 'Play')?.href).toBe('/learn/practice')
    for (const path of ['/learn/practice', '/learn/practice/start', '/learn/practice/session/s-1', '/learn/practice/summary/s-1', '/learn/practice/answer-sheet/s-1', '/practice', '/recall/x']) {
      expect(active('teens', path), path).toEqual(['/learn/practice'])
      expect(active('kids', path), path).toEqual(['/learn/practice'])
    }
    expect(active('teens', '/learn/practicefoo')).toEqual([])
    expect(active('teens', '/learn')).toEqual(['/learn'])
  })
  it('kids Adventures opens /learn and their Home entry opens /learn/home', () => {
    expect(items('kids').find(item => item.label === 'Adventures')?.href).toBe('/learn')
    expect(items('kids').find(item => item.label === 'Home')?.href).toBe('/learn/home')
  })
})
