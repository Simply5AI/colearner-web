import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { id: 'learner-a' } } }) }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => '/learn/practice',
  useSearchParams: () => new URLSearchParams(),
}))

import { LearnIdentityProvider } from '@/components/learn/learn-common'
import { HubView, type HubHistory } from '@/components/practice/hub'
import { HubScreen } from '@/components/practice/hub-screen'
import { StartScreen, forgetClientSessionId, stableClientSessionId } from '@/components/practice/start-screen'
import { SummaryScreen } from '@/components/practice/summary-screen'
import { SummaryView } from '@/components/practice/summary'
import { AnswerSheetScreen } from '@/components/practice/answer-sheet-screen'
import { AnswerSheetView, markFor } from '@/components/practice/answer-sheet'
import { durationLabel, reviewEstimate, scoreText } from '@/components/practice/hub-model'
import { answerSheetFixture, fixtureSessionId, hubFixture, practiceBands, sessionRows, summaryFixture } from '@/components/practice/dev/practice-fixtures'
import { createPracticeMock, type PracticeMockOptions } from '@/components/practice/dev/practice-mock'
import type { LearnBand } from '@/lib/api/learn'

vi.setConfig({ testTimeout: 30000 })
beforeEach(() => { configure({ asyncUtilTimeout: 5000 }); vi.clearAllMocks(); window.sessionStorage.clear() })
afterEach(() => { cleanup(); configure({ asyncUtilTimeout: 1000 }); vi.unstubAllGlobals() })

const noHistory: HubHistory = { rows: [], loading: false, error: null, hasMore: false, loadingMore: false, onMore: vi.fn(), onRetry: vi.fn() }
const forbidden = /\bXP\b|sticker|league|\bquests?\b|readiness|\blevel\b/i

function setup(options: Partial<PracticeMockOptions> & { band: LearnBand }, ui: React.ReactNode, strict = false) {
  const server = createPracticeMock(options)
  const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => server.fetch(input, init))
  vi.stubGlobal('fetch', fetcher)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const tree = <QueryClientProvider client={client}><LearnIdentityProvider scope="account:learner-a:unselected" band={options.band}>{ui}</LearnIdentityProvider></QueryClientProvider>
  const view = render(strict ? <StrictMode>{tree}</StrictMode> : tree)
  return { server, fetcher, view }
}
const calls = (server: ReturnType<typeof createPracticeMock>, method: string, path: string) => server.calls.filter(call => call.method === method && call.path === path)

describe.each(practiceBands)('F-L9 hub, %s band', band => {
  const kids = band === 'kids'
  const view = (state: Parameters<typeof hubFixture>[1] = 'default', extra: Partial<React.ComponentProps<typeof HubView>> = {}) =>
    render(<HubView hub={hubFixture(band, state)} tab="today" onTab={vi.fn()} subjectId={null} onSubject={vi.fn()} history={noHistory} {...extra} />)

  it('shows the band layout from the server data, starts through real routes and invents no reward', () => {
    const { container } = view()
    expect(screen.getByRole('heading', { level: 1, name: kids ? 'Play' : 'Practice' })).toBeInTheDocument()
    expect(within(screen.getByTestId('due-card')).getByRole('link')).toHaveAttribute('href', '/learn/practice/start?scope=DUE')
    const set = screen.getAllByTestId('practice-set')[0]!
    expect(within(set).getByRole('link', { name: kids ? 'Play!' : 'Practise' })).toHaveAttribute('href', '/learn/practice/start?scope=SET&id=set-fractions')
    expect(within(screen.getByTestId('teacher-practice')).getByRole('link')).toHaveAttribute('href', '/learn/practice/start?scope=TOPIC&id=topic-1&planId=plan-6a')
    expect(within(screen.getByTestId('exam-card')).getByRole('link')).toHaveAttribute('href', '/learn/practice/start?scope=PLAN_EXAM&id=plan-exam')
    expect(container.textContent).not.toMatch(forbidden)
    expect(screen.getByTestId('unavailable-kinds')).toHaveTextContent('Code questions')
    expect(screen.getByTestId('unavailable-kinds')).toHaveTextContent('Spoken answers')
  })
  it('F-L9-08: the timed mock test reads differently from practice and review', () => {
    view()
    const exam = screen.getByTestId('exam-card')
    expect(exam).toHaveAttribute('data-mode', 'EXAM')
    expect(exam).toHaveTextContent(kids ? 'Big test' : 'Mock test')
    expect(exam).toHaveTextContent(/Timed/)
    expect(exam).toHaveTextContent(/no hints/)
    expect(exam).toHaveTextContent('30 minutes')
    expect(screen.getAllByTestId('practice-set')[0]).not.toHaveTextContent(/no hints|Timed/)
    expect(screen.getByTestId('due-card')).toHaveTextContent(kids ? 'Remember' : 'Review')
  })
  it('F-L9-07: all caught up shows Co and an optional way to learn something new, without a made-up date', () => {
    view('caught-up')
    expect(screen.getByRole('heading', { name: 'All caught up!' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Learn something new' })).toHaveAttribute('href', kids ? '/learn/snap' : '/learn/import')
    expect(screen.queryByTestId('due-card')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/tomorrow/i)
    expect(screen.getAllByTestId('practice-set').length).toBeGreaterThan(0)
  })
  it('no content: says so and points at the library, never at a fake game', () => {
    view('no-content')
    expect(screen.getByText(kids ? 'Nothing to play yet' : 'Nothing to practise yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: kids ? 'My pages' : 'Open my library' })).toHaveAttribute('href', '/learn/library')
    expect(screen.queryByTestId('practice-set')).not.toBeInTheDocument()
  })
  it('a set that is still being made or failed shows its state and a link to the start page, never a start button', () => {
    view('sets-pending')
    const waiting = document.querySelector('[data-set="set-queued"]')!
    expect(within(waiting as HTMLElement).getByRole('status')).toHaveTextContent(/getting these/)
    expect(within(waiting as HTMLElement).getByRole('link', { name: 'Check on it' })).toHaveAttribute('href', '/learn/practice/start?scope=SET&id=set-queued')
    const failed = document.querySelector('[data-set="set-failed"]') as HTMLElement
    expect(within(failed).getByRole('status')).toHaveTextContent('Co could not make these questions.')
    expect(within(failed).queryByRole('link', { name: kids ? 'Play!' : 'Practise' })).not.toBeInTheDocument()
  })
  it('F-L9-06: past sessions are a star timeline for kids, a list for tweens and a table with answer sheets for teens', () => {
    const rows = sessionRows(band)
    view('default', { tab: 'past', history: { ...noHistory, rows } })
    if (kids) {
      const timeline = screen.getByTestId('kids-history')
      expect(timeline.textContent).not.toMatch(/\d+ of \d+|right|wrong|missed|answer sheet|sticker/i)
      expect(within(timeline).getAllByRole('img', { name: /of 3 stars/ }).length).toBeGreaterThan(0)
      expect(screen.queryByRole('link', { name: 'Answer sheet' })).not.toBeInTheDocument()
    } else if (band === 'tweens') {
      expect(screen.getByTestId('session-list')).toHaveTextContent('7 of 8 right')
      expect(screen.getAllByRole('link', { name: 'Answer sheet' })[0]).toHaveAttribute('href', '/learn/practice/answer-sheet/session-1')
    } else {
      const table = screen.getByTestId('session-table')
      expect(within(table).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(['Date', 'Session', 'Score', 'Duration', 'Answers'])
      expect(within(table).getAllByRole('link', { name: 'Answer sheet' })[0]).toHaveAttribute('href', '/learn/practice/answer-sheet/session-1')
    }
    // A running session offers to continue in W1's player; a stopped one offers nothing.
    expect(screen.getByRole('link', { name: kids ? 'Keep playing' : 'Continue' })).toHaveAttribute('href', '/learn/practice/session/session-3')
  })
  it('past sessions: empty, error and loading states, and a Show more control', () => {
    const { rerender } = view('default', { tab: 'past', history: { ...noHistory, loading: true } })
    expect(screen.getByRole('status', { name: 'Loading past sessions' })).toBeInTheDocument()
    rerender(<HubView hub={hubFixture(band)} tab="past" onTab={vi.fn()} subjectId={null} onSubject={vi.fn()} history={noHistory} />)
    expect(screen.getByText(kids ? 'No rounds yet' : 'No past sessions yet')).toBeInTheDocument()
    const retry = vi.fn()
    rerender(<HubView hub={hubFixture(band)} tab="past" onTab={vi.fn()} subjectId={null} onSubject={vi.fn()} history={{ ...noHistory, error: new Error('Learning services are unavailable right now. Please try again.'), onRetry: retry }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalled()
    const more = vi.fn()
    rerender(<HubView hub={hubFixture(band)} tab="past" onTab={vi.fn()} subjectId={null} onSubject={vi.fn()} history={{ ...noHistory, rows: sessionRows(band), hasMore: true, onMore: more }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }))
    expect(more).toHaveBeenCalled()
  })
  it('tabs are toggle buttons that report the choice', () => {
    const onTab = vi.fn()
    view('default', { onTab })
    expect(screen.getByRole('button', { name: kids ? 'Games' : 'Today' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: kids ? /^My rounds$/ : /^Past sessions$/ }))
    expect(onTab).toHaveBeenCalledWith('past')
  })
})

describe('F-L9-03/04 band specifics', () => {
  it('tweens: review estimate from the server and subject filter over the sets', () => {
    const onSubject = vi.fn()
    render(<HubView hub={hubFixture('tweens')} tab="today" onTab={vi.fn()} subjectId={null} onSubject={onSubject} history={noHistory} />)
    expect(screen.getByTestId('due-estimate')).toHaveTextContent('5 cards, about 4 minutes')
    fireEvent.click(screen.getByRole('button', { name: 'Science' }))
    expect(onSubject).toHaveBeenCalledWith('s-sci')
  })
  it('tweens: a chosen subject hides the other subjects sets', () => {
    render(<HubView hub={hubFixture('tweens')} tab="today" onTab={vi.fn()} subjectId="s-sci" onSubject={vi.fn()} history={noHistory} />)
    expect(screen.getAllByTestId('practice-set')).toHaveLength(1)
    expect(screen.getByTestId('practice-set')).toHaveTextContent('The water cycle')
  })
  it('teens: weak spots are empty until measured, and listed when the server sends them', () => {
    const { rerender } = render(<HubView hub={hubFixture('teens')} tab="today" onTab={vi.fn()} subjectId={null} onSubject={vi.fn()} history={noHistory} />)
    expect(screen.getByTestId('weak-spots')).toHaveTextContent('will show here once Co can measure them')
    rerender(<HubView hub={hubFixture('teens', 'weak-spots')} tab="today" onTab={vi.fn()} subjectId={null} onSubject={vi.fn()} history={noHistory} />)
    expect(screen.getByTestId('weak-spots')).toHaveTextContent('Indicators')
    expect(screen.getByTestId('weak-spots')).toHaveTextContent('Measured from your practice')
  })
  it('kids: stars only, and no counts of anything that went wrong', () => {
    const { container } = render(<HubView hub={hubFixture('kids')} tab="today" onTab={vi.fn()} subjectId={null} onSubject={vi.fn()} history={noHistory} />)
    expect(within(screen.getAllByTestId('practice-set')[0]!).getByRole('img', { name: '2 of 3 stars' })).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/wrong|missed|failed|incorrect|%/i)
  })
  it('a disabled start shows the server reason and is not a link', () => {
    const hub = hubFixture('teens')
    hub.exams[0] = { ...hub.exams[0]!, start: { link: { route: 'PRACTICE', id: 'plan-exam', scope: 'PLAN_EXAM' }, enabled: false, disabledReason: 'Mock tests are paused until the teacher opens them.' } }
    render(<HubView hub={hub} tab="today" onTab={vi.fn()} subjectId={null} onSubject={vi.fn()} history={noHistory} />)
    const exam = screen.getByTestId('exam-card')
    expect(within(exam).queryByRole('link')).not.toBeInTheDocument()
    expect(within(exam).getByRole('button', { name: 'Start mock test' })).toBeDisabled()
    expect(within(exam).getByText('Mock tests are paused until the teacher opens them.')).toBeInTheDocument()
  })
  it('model helpers', () => {
    expect(durationLabel(45)).toBe('45 sec'); expect(durationLabel(252)).toBe('4 min 12 sec'); expect(durationLabel(1180)).toBe('19 min'); expect(durationLabel(null)).toBeNull()
    expect(reviewEstimate(1, 1)).toBe('1 card, about 1 minute'); expect(reviewEstimate(3, null)).toBe('3 cards')
    expect(scoreText({ correct: 7, itemCount: 8 })).toBe('7 of 8'); expect(scoreText({ correct: null, itemCount: 8 })).toBeNull()
  })
})

describe('HubScreen: loading, denied, unavailable and the history tab', () => {
  it('loads the hub with one request and shows the band layout', async () => {
    const { server } = setup({ band: 'tweens' }, <HubScreen />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Practice' })).toBeInTheDocument()
    expect(calls(server, 'GET', '/practice/hub')).toHaveLength(1)
    expect(calls(server, 'GET', '/practice/sessions?limit=20')).toHaveLength(0)
  })
  it('forwards a valid plan filter only', async () => {
    const { server } = setup({ band: 'teens' }, <HubScreen planId="plan-9" />)
    await screen.findByRole('heading', { level: 1, name: 'Practice' })
    expect(server.calls[0]!.path).toBe('/practice/hub?planId=plan-9')
    cleanup()
    const other = setup({ band: 'teens' }, <HubScreen planId="../x" />)
    await screen.findByRole('heading', { level: 1, name: 'Practice' })
    expect(other.server.calls[0]!.path).toBe('/practice/hub')
  })
  it('shows a loading state while the server answers', () => {
    setup({ band: 'kids', loading: true }, <HubScreen />)
    expect(screen.getByRole('status', { name: 'Getting your practice ready' })).toBeInTheDocument()
  })
  it('denied (403) has no retry and no detail; unavailable (503) offers Try again', async () => {
    setup({ band: 'teens', hubStatus: 403 }, <HubScreen />)
    expect(await screen.findByText('You cannot open this')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    cleanup()
    setup({ band: 'teens', hubStatus: 503 }, <HubScreen />)
    expect(await screen.findByText('This could not load')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
  it('the past tab loads the history with a cursor and pages it', async () => {
    const { server } = setup({ band: 'teens' }, <HubScreen initialTab="past" onTabChange={vi.fn()} />)
    expect(await screen.findByTestId('session-table')).toBeInTheDocument()
    expect(calls(server, 'GET', '/practice/sessions?limit=20')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }))
    expect(await screen.findByText('Older practice')).toBeInTheDocument()
    expect(calls(server, 'GET', '/practice/sessions?limit=20&cursor=cursor-2')).toHaveLength(1)
  })
  it('switching to Past sessions asks the router to update the address', async () => {
    setup({ band: 'teens' }, <HubScreen />)
    fireEvent.click(await screen.findByRole('button', { name: /^Past sessions$/ }))
    expect(nav.replace).toHaveBeenCalledWith('/learn/practice?tab=past', { scroll: false })
    expect(await screen.findByTestId('session-table')).toBeInTheDocument()
  })
})

describe('start flow (F-L9-01, F-L10-08 client side)', () => {
  const start = (props: Partial<React.ComponentProps<typeof StartScreen>> & { scope: string }) => <StartScreen pollBaseMs={10} {...props} />

  it('SET: creates one session with a stable client id and moves to the player, even under StrictMode', async () => {
    const { server } = setup({ band: 'tweens' }, start({ scope: 'SET', id: 'set-fractions' }), true)
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/learn/practice/session/session-1'))
    const posts = calls(server, 'POST', '/practice/sessions')
    expect(posts).toHaveLength(1)
    expect(posts[0]!.body).toMatchObject({ mode: 'PRACTICE', scope: { kind: 'SET', id: 'set-fractions' } })
    expect(calls(server, 'POST', '/practice/sets')).toHaveLength(0)
    expect(nav.replace).toHaveBeenCalledTimes(1)
    expect(Object.keys(window.sessionStorage).filter(key => key.startsWith('colearner.practice-start'))).toEqual([])
  })
  it('MATERIAL: gets or creates the set once, polls while it is made, then creates the session for that set', async () => {
    const { server } = setup({ band: 'kids', start: 'generating', generatingPolls: 3 }, start({ scope: 'MATERIAL', id: 'material-fractions' }), true)
    expect(await screen.findByText('Co is making your game!')).toBeInTheDocument()
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/learn/practice/session/session-1'))
    expect(calls(server, 'POST', '/practice/sets')).toHaveLength(1)
    expect(calls(server, 'POST', '/practice/sets')[0]!.body).toEqual({ materialId: 'material-fractions' })
    expect(calls(server, 'GET', '/practice/sets/set-fractions').length).toBeGreaterThanOrEqual(2)
    expect(calls(server, 'POST', '/practice/sessions')).toHaveLength(1)
    expect(calls(server, 'POST', '/practice/sessions')[0]!.body).toMatchObject({ scope: { kind: 'SET', id: 'set-fractions' } })
  })
  it('LESSON sends the lesson id; DUE is a review with no id; PLAN_EXAM is a timed test; TOPIC carries its plan', async () => {
    let s = setup({ band: 'teens' }, start({ scope: 'LESSON', id: 'lesson-1' }))
    await waitFor(() => expect(nav.replace).toHaveBeenCalled())
    expect(calls(s.server, 'POST', '/practice/sets')[0]!.body).toEqual({ lessonId: 'lesson-1' })
    cleanup(); window.sessionStorage.clear(); nav.replace.mockClear()
    s = setup({ band: 'teens' }, start({ scope: 'DUE' }))
    await waitFor(() => expect(nav.replace).toHaveBeenCalled())
    expect(calls(s.server, 'POST', '/practice/sessions')[0]!.body).toMatchObject({ mode: 'REVIEW', scope: { kind: 'DUE' } })
    expect(calls(s.server, 'POST', '/practice/sets')).toHaveLength(0)
    cleanup(); window.sessionStorage.clear(); nav.replace.mockClear()
    s = setup({ band: 'teens' }, start({ scope: 'PLAN_EXAM', id: 'plan-exam' }))
    await waitFor(() => expect(nav.replace).toHaveBeenCalled())
    expect(calls(s.server, 'POST', '/practice/sessions')[0]!.body).toMatchObject({ mode: 'EXAM', scope: { kind: 'PLAN_EXAM', id: 'plan-exam', planId: 'plan-exam' } })
    cleanup(); window.sessionStorage.clear(); nav.replace.mockClear()
    s = setup({ band: 'teens' }, start({ scope: 'TOPIC', id: 'topic-1', planId: 'plan-6a' }))
    await waitFor(() => expect(nav.replace).toHaveBeenCalled())
    expect(calls(s.server, 'POST', '/practice/sessions')[0]!.body).toMatchObject({ mode: 'PRACTICE', scope: { kind: 'TOPIC', id: 'topic-1', planId: 'plan-6a' } })
  })
  it('a lost create request is retried with the SAME client session id after a refresh (remount)', async () => {
    const server = createPracticeMock({ band: 'tweens' })
    const ids: string[] = []
    let first = true
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/practice/sessions') && init?.method === 'POST') {
        ids.push(JSON.parse(String(init.body)).clientSessionId)
        if (first) { first = false; throw new TypeError('network down') }
      }
      return server.fetch(input, init)
    }))
    const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><LearnIdentityProvider scope="account:learner-a:unselected" band="tweens">{start({ scope: 'SET', id: 'set-fractions' })}</LearnIdentityProvider></QueryClientProvider>)
    const view = mount()
    expect(await screen.findByText('This could not load')).toBeInTheDocument()
    view.unmount()
    mount()
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/learn/practice/session/session-1'))
    expect(ids).toHaveLength(2)
    expect(ids[1]).toBe(ids[0])
  })
  it('stableClientSessionId reuses a fresh id, replaces an old or broken one, and survives blocked storage', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value), removeItem: (key: string) => void store.delete(key) }
    const first = stableClientSessionId('k', 1000, storage)
    expect(stableClientSessionId('k', 2000, storage)).toBe(first)
    expect(stableClientSessionId('k', 1000 + 31 * 60 * 1000, storage)).not.toBe(first)
    store.set('k', '{not json')
    expect(stableClientSessionId('k', 5000, storage)).toMatch(/^s-/)
    forgetClientSessionId('k', storage)
    expect(store.has('k')).toBe(false)
    const blocked = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(stableClientSessionId('k', 1, blocked)).toMatch(/^s-/)
  })
  it('failed: retryable offers Try again once (double press is one request) and follows the new set', async () => {
    const { server } = setup({ band: 'tweens', start: 'failed' }, start({ scope: 'LESSON', id: 'lesson-1' }))
    expect(await screen.findByText('Co could not make these questions')).toBeInTheDocument()
    const retry = screen.getByRole('button', { name: 'Try again' })
    fireEvent.click(retry); fireEvent.click(retry)
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/learn/practice/session/session-1'))
    expect(calls(server, 'POST', '/practice/sets/set-fractions/retry')).toHaveLength(1)
    expect(calls(server, 'POST', '/practice/sessions')).toHaveLength(1)
    expect(calls(server, 'POST', '/practice/sessions')[0]!.body).toMatchObject({ scope: { kind: 'SET', id: 'set-fractions-v2' } })
  })
  it('a final failure says why in plain words and offers no retry', async () => {
    setup({ band: 'teens', start: 'failed-final' }, start({ scope: 'MATERIAL', id: 'material-fractions' }))
    expect(await screen.findByText(/not enough in this material/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to practice' })).toHaveAttribute('href', '/learn/practice')
  })
  it('generating can be stopped; a stopped set can be made again', async () => {
    const { server } = setup({ band: 'teens', start: 'generating', generatingPolls: 400 }, start({ scope: 'MATERIAL', id: 'material-fractions', pollBaseMs: 1000 }))
    fireEvent.click(await screen.findByRole('button', { name: 'Stop making these' }))
    expect(await screen.findByText('These questions were stopped')).toBeInTheDocument()
    expect(calls(server, 'POST', '/practice/sets/set-fractions/cancel')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Make them again' }))
    await waitFor(() => expect(screen.getByText(/Co is making your questions/)).toBeInTheDocument())
    expect(calls(server, 'POST', '/practice/sets')).toHaveLength(2)
  })
  it.each([
    ['POLICY_BLOCKED', 'Not right now', 'paused until tomorrow'], ['DAILY_PRACTICE_LIMIT', 'That is enough question sets for today', 'tomorrow'],
    ['DAILY_PRACTICE_SET_LIMIT', 'That is enough question sets for today', 'tomorrow'],
    ['CONSENT_REQUIRED', 'A grown-up needs to help first', 'say yes'], ['PRACTICE_UNAVAILABLE', 'Practice is not ready yet', 'not switched on'],
  ])('set creation refused with %s shows a plain refusal', async (code, title, text) => {
    setup({ band: 'kids', setError: code }, start({ scope: 'MATERIAL', id: 'material-fractions' }))
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
    expect(document.body.textContent).toContain(text)
    expect(nav.replace).not.toHaveBeenCalled()
  })
  it('a TOPIC link without its plan is not startable: no request is made', async () => {
    const s = setup({ band: 'teens' }, start({ scope: 'TOPIC', id: 'topic-1' }))
    expect(await screen.findByText('Choose what to practise')).toBeInTheDocument()
    expect(calls(s.server, 'POST', '/practice/sessions')).toHaveLength(0)
    expect(nav.replace).not.toHaveBeenCalled()
  })
  it('session creation refused with NO_QUESTIONS_AVAILABLE shows nothing-to-practise and no retry', async () => {
    setup({ band: 'tweens', sessionError: 'NO_QUESTIONS_AVAILABLE' }, start({ scope: 'DUE' }))
    expect(await screen.findByRole('heading', { name: 'Nothing to practise right now' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })
  it('an unknown scope or a missing id sends no request', () => {
    const { fetcher } = setup({ band: 'tweens' }, start({ scope: 'EVERYTHING', id: 'x' }))
    expect(screen.getByText('Choose what to practise')).toBeInTheDocument()
    cleanup()
    const other = setup({ band: 'tweens' }, start({ scope: 'SET', id: '../admin' }))
    expect(screen.getByText('Choose what to practise')).toBeInTheDocument()
    expect(fetcher).not.toHaveBeenCalled(); expect(other.fetcher).not.toHaveBeenCalled()
  })
})

describe.each(practiceBands)('F-L11 summary, %s band', band => {
  const kids = band === 'kids'
  it('Great: warm celebration, stars from the server, reward exactly as returned, real next steps', () => {
    const summary = summaryFixture(band, 'great')
    const { container } = render(<SummaryView summary={summary} band={band} />)
    const great = container.querySelector('[data-state="great"]')!
    expect(great).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
    expect(screen.getByRole('img', { name: '3 of 3 stars' })).toBeInTheDocument()
    expect(screen.getByTestId('reward')).toHaveTextContent(kids ? 'You collected 3 stars!' : 'Reward: 3 stars')
    expect(container.textContent).not.toMatch(forbidden)
    expect(screen.getByRole('link', { name: kids ? 'Play again' : 'Practise again' })).toHaveAttribute('href', '/learn/practice/start?scope=SET&id=set-fractions')
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/learn/home')
  })
  it('Tough: encouraging, never negative; quick recap goes to the lesson; try again later goes home', () => {
    const { container } = render(<SummaryView summary={summaryFixture(band, 'tough')} band={band} />)
    expect(container.querySelector('[data-state="tough"]')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: kids ? 'Look again' : 'Quick recap' })).toHaveAttribute('href', '/learn/lesson/new?materialId=material-fractions')
    expect(screen.getByRole('link', { name: kids ? 'Later' : 'Try again later' })).toHaveAttribute('href', '/learn/home')
    expect(screen.getByRole('img', { name: '1 of 3 stars' })).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/fail|bad|poor|wrong/i)
  })
})

describe('F-L11 band content', () => {
  it('kids: stars only, no score, no miss list, no teach-back, no accuracy', () => {
    const { container } = render(<SummaryView summary={summaryFixture('kids', 'tough')} band="kids" />)
    expect(container.textContent).not.toMatch(/\b\d+ of \d+\b|missed|score|accuracy|%|To look at again|Teach/i)
    expect(screen.queryByTestId('missed')).not.toBeInTheDocument()
    expect(screen.queryByTestId('teach-back')).not.toBeInTheDocument()
  })
  it('tweens: score and the missed question with Review it (the lesson when it has a source, otherwise the answer sheet)', () => {
    render(<SummaryView summary={summaryFixture('tweens', 'tough')} band="tweens" />)
    expect(screen.getByText('2 of 8')).toBeInTheDocument()
    const links = within(screen.getByTestId('missed')).getAllByRole('link', { name: 'Review it' })
    expect(links[0]).toHaveAttribute('href', '/learn/lesson/new?materialId=material-fractions')
    expect(links[1]).toHaveAttribute('href', '/learn/practice/answer-sheet/session-1#item-4')
    expect(screen.queryByText(/Accuracy/)).not.toBeInTheDocument()
  })
  it('teens: accuracy, time, first try, concepts to revise and the next review date from the server', () => {
    render(<SummaryView summary={summaryFixture('teens', 'great')} band="teens" />)
    expect(screen.getByText('88%')).toBeInTheDocument()
    expect(screen.getByText('7 of 8')).toBeInTheDocument()
    expect(screen.getByText('6 of 8')).toBeInTheDocument()
    expect(screen.getByText('4 min 12 sec')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Concepts to revise' })).toBeInTheDocument()
    expect(screen.getByText('Next review')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Answer sheet' })).toHaveAttribute('href', '/learn/practice/answer-sheet/session-1')
    cleanup()
    render(<SummaryView summary={{ ...summaryFixture('teens', 'great'), nextReviewAt: null }} band="teens" />)
    expect(screen.queryByText('Next review')).not.toBeInTheDocument()
  })
  it('F-L11-05: teach-back is shown, disabled, with the server reason', () => {
    render(<SummaryView summary={summaryFixture('teens', 'great')} band="teens" />)
    const card = screen.getByTestId('teach-back')
    expect(within(card).getByRole('button', { name: 'Teach it back to Co' })).toBeDisabled()
    expect(within(card).getByText('Teach it back to Co opens with the progress release.')).toBeInTheDocument()
    cleanup()
    const enabled = summaryFixture('teens', 'great')
    enabled.next.teachBack = { link: { route: 'TEACH', id: 'session-1' }, enabled: true, disabledReason: null }
    render(<SummaryView summary={enabled} band="teens" />)
    expect(within(screen.getByTestId('teach-back')).getByRole('link', { name: 'Teach it back to Co' })).toHaveAttribute('href', '/learn/teach?practiceSessionId=session-1')
    cleanup()
    const wrong = summaryFixture('teens', 'great')
    wrong.next.teachBack = { link: { route: 'PRACTICE', id: 'x', scope: 'SET' }, enabled: true, disabledReason: null }
    render(<SummaryView summary={wrong} band="teens" />)
    expect(within(screen.getByTestId('teach-back')).getByRole('button', { name: 'Teach it back to Co' })).toBeDisabled()
    expect(within(screen.getByTestId('teach-back')).queryByRole('link')).not.toBeInTheDocument()
  })
  it('F-L11-07: unavailable grading is said plainly, kids get no number, and nothing claims it was scored', () => {
    render(<SummaryView summary={summaryFixture('teens', 'feedback-unavailable')} band="teens" />)
    const note = screen.getByRole('status')
    expect(note).toHaveTextContent('Some written answers could not be checked')
    expect(note).toHaveTextContent('2 written answers')
    expect(note).toHaveTextContent('not in your score')
    cleanup()
    render(<SummaryView summary={summaryFixture('kids', 'feedback-unavailable')} band="kids" />)
    expect(screen.getByRole('status')).not.toHaveTextContent(/\d/)
    expect(screen.getByRole('status')).toHaveTextContent('They do not count')
  })
  it('F-L11-07: the reward is drawn exactly as returned, so a repeated view shows the same stars and no second reward', () => {
    const summary = summaryFixture('tweens', 'great')
    const { container, rerender } = render(<SummaryView summary={summary} band="tweens" />)
    const first = container.textContent
    rerender(<SummaryView summary={{ ...summary }} band="tweens" />)
    expect(container.textContent).toBe(first)
    expect(screen.getAllByTestId('reward')).toHaveLength(1)
    cleanup()
    render(<SummaryView summary={{ ...summary, reward: null }} band="tweens" />)
    expect(screen.queryByTestId('reward')).not.toBeInTheDocument()
  })
  it('XP, level and readiness appear only when the server sends a number', () => {
    render(<SummaryView summary={summaryFixture('teens', 'later-release')} band="teens" />)
    expect(document.querySelector('[data-stat="xp"]')).toHaveTextContent('+80')
    expect(document.querySelector('[data-stat="level"]')).toHaveTextContent('7')
    expect(document.querySelector('[data-stat="readiness"]')).toHaveTextContent('65%')
    cleanup()
    render(<SummaryView summary={summaryFixture('teens', 'great')} band="teens" />)
    expect(document.querySelector('[data-stat="xp"]')).toBeNull()
    expect(document.querySelector('[data-stat="readiness"]')).toBeNull()
  })
  it('a mock test summary is labelled as a mock test', () => {
    const exam = summaryFixture('teens', 'great')
    exam.session = { ...exam.session, mode: 'EXAM' }
    render(<SummaryView summary={exam} band="teens" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mock test finished')
    expect(document.querySelector('[data-mode="EXAM"]')).toHaveTextContent('Mock test')
  })
})

describe('SummaryScreen and AnswerSheetScreen data states', () => {
  it('loads the summary, using the band the server resolved', async () => {
    const { server } = setup({ band: 'kids' }, <SummaryScreen sessionId={fixtureSessionId} />)
    expect(screen.getByRole('status', { name: 'Co is counting your stars' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 1, name: 'You did it!' })).toBeInTheDocument()
    expect(calls(server, 'GET', '/practice/sessions/session-1/summary')).toHaveLength(1)
  })
  it('a session that is still running (409) offers to keep going; denied and unavailable behave like the hub', async () => {
    setup({ band: 'tweens', summaryStatus: 409 }, <SummaryScreen sessionId="s-5" />)
    expect(await screen.findByText('This practice is not finished yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Keep going' })).toHaveAttribute('href', '/learn/practice/session/s-5')
    cleanup()
    setup({ band: 'tweens', summaryStatus: 404 }, <SummaryScreen sessionId="s-5" />)
    expect(await screen.findByText('You cannot open this')).toBeInTheDocument()
    cleanup()
    setup({ band: 'tweens', summaryStatus: 503 }, <SummaryScreen sessionId="s-5" />)
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
  it('the answer sheet loads and a regrade is asked once per attempt (double press is one request)', async () => {
    const { server } = setup({ band: 'teens' }, <AnswerSheetScreen sessionId={fixtureSessionId} />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Answer sheet' })).toBeInTheDocument()
    const ask = screen.getByRole('button', { name: 'Ask Co to check again' })
    fireEvent.click(ask); fireEvent.click(ask)
    expect(await screen.findByText(/Asked\. Co will check it again/)).toBeInTheDocument()
    expect(calls(server, 'POST', '/practice/attempts/attempt-9/regrade')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Ask Co to check again' })).not.toBeInTheDocument()
  })
  it('a refused regrade shows the safe message', async () => {
    setup({ band: 'teens', regradeLimit: true }, <AnswerSheetScreen sessionId={fixtureSessionId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ask Co to check again' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Co has already checked this answer again')
  })
})

describe.each(practiceBands)('answer sheet view, %s band', band => {
  it('writes every mark, shows the answer only where the server revealed it, labels Co feedback and the grading gap', () => {
    const { container } = render(<AnswerSheetView sheet={answerSheetFixture(band)} band={band} />)
    const items = screen.getAllByTestId('answer-item')
    expect(items).toHaveLength(5)
    expect(items.map(item => item.getAttribute('data-mark'))).toEqual(['correct', 'tried', 'partial', 'unchecked', 'correct'])
    expect(within(items[0]!).getAllByText(band === 'kids' ? 'Yes!' : 'Correct').length).toBeGreaterThan(0)
    expect(within(items[3]!).queryByTestId('correct-answer')).not.toBeInTheDocument()
    expect(within(items[1]!).getByTestId('correct-answer')).toHaveTextContent('red')
    expect(within(items[4]!).getByText(/Co says/)).toBeInTheDocument()
    expect(within(items[3]!).getByText(/Co could not check/)).toBeInTheDocument()
    expect(within(items[1]!).getByRole('link', { name: 'Look at where this comes from' })).toHaveAttribute('href', '/learn/lesson/new?materialId=material-fractions')
    expect(container.textContent).not.toMatch(forbidden)
    if (band === 'kids') expect(container.textContent).not.toMatch(/Wrong|Incorrect|Not right yet|\d+ of \d+ right/)
  })
  it('an empty sheet says so', () => {
    render(<AnswerSheetView sheet={{ ...answerSheetFixture(band), items: [] }} band={band} />)
    expect(screen.getByText('There are no answers to show for this session.')).toBeInTheDocument()
  })
})

describe('answer sheet marks', () => {
  it('derive from grading status first, then correctness', () => {
    expect(markFor({ correct: null, partial: false, gradingStatus: 'FEEDBACK_UNAVAILABLE', yourAnswer: 'x' })).toBe('unchecked')
    expect(markFor({ correct: null, partial: false, gradingStatus: 'PENDING', yourAnswer: 'x' })).toBe('checking')
    expect(markFor({ correct: false, partial: true, gradingStatus: 'GRADED', yourAnswer: 'x' })).toBe('partial')
    expect(markFor({ correct: false, partial: false, gradingStatus: 'NOT_NEEDED', yourAnswer: null })).toBe('skipped')
  })
})
