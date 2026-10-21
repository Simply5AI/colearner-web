import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { id: 'learner-a' } } }) }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => '/learn/homework',
  useSearchParams: () => new URLSearchParams(),
}))

import { LearnIdentityProvider } from '@/components/learn/learn-common'
import { LearnHomeView } from '@/components/learn/learn-home'
import { homeFixture } from '@/components/learn/dev/learn-fixtures'
import { installFakeSpeech, removeSpeech, type FakeSpeech } from '@/components/lesson/dev/fake-speech'
import { HomeworkEntryScreen, PHOTO_FALLBACK_REASON } from '@/components/homework/homework-entry'
import { HomeworkSessionScreen } from '@/components/homework/homework-session-screen'
import { resetActionIds } from '@/components/homework/homework-ids'
import { parentNotices, problemLimit } from '@/components/homework/homework-model'
import { homeworkBands, safetyGuidance, scripts } from '@/components/homework/dev/homework-fixtures'
import { createHomeworkMock, type HomeworkMockOptions } from '@/components/homework/dev/homework-mock'
import type { LearnBand } from '@/lib/api/learn'

vi.setConfig({ testTimeout: 30000 })
let speech: FakeSpeech | null = null
let restoreNone: (() => void) | null = null
beforeEach(() => { configure({ asyncUtilTimeout: 5000 }); vi.clearAllMocks(); document.documentElement.dir = 'ltr'; try { sessionStorage.clear() } catch { /* none */ } resetActionIds() })
afterEach(() => {
  cleanup(); configure({ asyncUtilTimeout: 1000 })
  speech?.restore(); speech = null
  restoreNone?.(); restoreNone = null
  vi.unstubAllGlobals()
  document.documentElement.dir = 'ltr'
})

type Setup = Partial<HomeworkMockOptions> & { band: LearnBand }
const navigate = vi.fn()
const delay = vi.fn(() => 5)
function wire(options: Setup) {
  const server = createHomeworkMock(options)
  const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => server.fetch(input, init))
  vi.stubGlobal('fetch', fetcher)
  return { server, fetcher }
}
function shell(options: Setup, ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return <QueryClientProvider client={client}><LearnIdentityProvider scope="account:learner-a:unselected" band={options.band}>{ui}</LearnIdentityProvider></QueryClientProvider>
}
function entry(options: Setup) {
  const wired = wire({ seed: 'new', ...options })
  const view = render(shell(options, <HomeworkEntryScreen navigate={navigate} />))
  return { ...wired, view }
}
function session(options: Setup) {
  const wired = wire({ seed: 'steps', ...options })
  const view = render(shell(options, <HomeworkSessionScreen sessionId="hw-1" navigate={navigate} pollTiming={{ delay }} />))
  return { ...wired, view }
}
const posts = (server: ReturnType<typeof createHomeworkMock>, suffix: string) => server.calls.filter(call => call.method === 'POST' && call.path.endsWith(suffix))
const type = (element: HTMLElement, value: string) => fireEvent.change(element, { target: { value } })
const bodyText = () => document.body.textContent ?? ''
const settled = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 60)) }) }

describe('L18 entry page (F-L18-01, F-L18-07)', () => {
  it.each(homeworkBands)('%s: typed problem with the band limit and count, AI label, parent notice and a disabled Snap card with the server reason', async band => {
    entry({ band })
    expect(await screen.findByRole('heading', { level: 1, name: 'Homework help' })).toBeInTheDocument()
    const input = screen.getByTestId('problem-input') as HTMLTextAreaElement
    expect(input.maxLength).toBe(problemLimit[band])
    type(input, 'x'.repeat(problemLimit[band] + 50))
    expect(input.value.length).toBe(problemLimit[band])
    expect(screen.getByTestId('char-count')).toHaveTextContent(`${problemLimit[band]} / ${problemLimit[band]} characters`)
    expect(screen.getByTestId('ai-label')).toHaveTextContent('Co is an AI helper')
    expect(screen.getByTestId('snap-reason')).toHaveTextContent(PHOTO_FALLBACK_REASON)
    expect(screen.getByRole('button', { name: 'Snap the problem' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Snap the problem' })).toHaveAccessibleDescription(PHOTO_FALLBACK_REASON)
    expect(screen.getByTestId('parent-notice')).toHaveTextContent(band === 'kids' ? parentNotices.kids : band === 'tweens' ? parentNotices.tweens : parentNotices.teens)
  })
  it('never calls the context endpoint: the platform answers 400 without a lessonId or materialId, so the photo reason and the parent notice are the truthful defaults', async () => {
    const { server } = entry({ band: 'teens' })
    expect(await screen.findByRole('button', { name: 'Help me with this' })).toBeDisabled()
    await waitFor(() => expect(server.calls.some(call => call.path.startsWith('/homework/sessions'))).toBe(true))
    expect(server.calls.some(call => call.path.startsWith('/co/context'))).toBe(false)
    expect(screen.getByTestId('snap-reason')).toHaveTextContent(PHOTO_FALLBACK_REASON)
    expect(screen.getByTestId('parent-notice')).toHaveTextContent(parentNotices.teens)
  })
  it('lists earlier homework sessions from the list endpoint, opens each where it was left, and loads more', async () => {
    const { server } = entry({ band: 'tweens' })
    const rows = await screen.findAllByTestId('earlier-session')
    expect(rows).toHaveLength(3)
    expect(within(rows[0]!).getByRole('link')).toHaveAttribute('href', '/learn/homework/hw-old-1')
    expect(within(rows[0]!).getByRole('link')).toHaveTextContent('Look')
    expect(rows[0]).toHaveTextContent('Worked out')
    expect(within(rows[1]!).getByRole('link')).toHaveTextContent('Carry on')
    expect(rows[1]).toHaveTextContent('On step 2')
    expect(rows[2]).toHaveTextContent('Closed')
    expect(server.calls.some(call => call.path.startsWith('/co/conversations'))).toBe(false)
    expect(server.calls.find(call => call.path.startsWith('/homework/sessions'))!.path).toBe('/homework/sessions?limit=20')
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }))
    await waitFor(() => expect(screen.getAllByTestId('earlier-session')).toHaveLength(4))
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
  })
  it('shows an empty list and a retryable error for the history', async () => {
    entry({ band: 'kids', historyCount: 0 })
    expect(await screen.findByText(/Nothing here yet/)).toBeInTheDocument()
    cleanup()
    const { server } = entry({ band: 'tweens', historyStatus: 503 })
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Co is not available right now')
    expect(screen.getByTestId('help-me')).toBeInTheDocument()
    expect(server.calls.filter(call => call.method === 'GET' && call.path.startsWith('/homework/sessions?'))).toHaveLength(1)
  })
  it('creates the session once with a client id, keeps the text and reuses the id when the reply is lost', async () => {
    const { server } = entry({ band: 'tweens', dropCreateReplies: 1 })
    const input = await screen.findByTestId('problem-input')
    type(input, '3/4 + 1/8 = ?')
    fireEvent.click(screen.getByTestId('help-me'))
    expect(await screen.findByTestId('create-error')).toHaveTextContent('Co is not available right now')
    expect((screen.getByTestId('problem-input') as HTMLTextAreaElement).value).toBe('3/4 + 1/8 = ?')
    expect(navigate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('help-me'))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/learn/homework/hw-1'))
    const sent = posts(server, '/homework/sessions').map(call => call.body as { problem: string; clientSessionId: string })
    expect(sent).toHaveLength(2)
    expect(sent[0]!.clientSessionId).toBe(sent[1]!.clientSessionId)
    expect(sent[0]!.clientSessionId).toMatch(/^[0-9a-f-]{36}$/)
    expect(sent[0]!.problem).toBe('3/4 + 1/8 = ?')
    expect(server.sessions.size).toBe(1)
  })
  it('keeps the draft through a refresh and a double press sends one request', async () => {
    const first = entry({ band: 'tweens' })
    type(await screen.findByTestId('problem-input'), 'A draft problem')
    first.view.unmount()
    entry({ band: 'tweens' })
    await waitFor(() => expect((screen.getByTestId('problem-input') as HTMLTextAreaElement).value).toBe('A draft problem'))
    const { server } = { server: createHomeworkMock({ band: 'tweens' }) }
    void server
    const button = screen.getByTestId('help-me')
    fireEvent.click(button); fireEvent.click(button)
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1))
  })
  it.each([
    ['PROBLEM_INVALID', 'Co could not use that problem'], ['HOMEWORK_UNAVAILABLE', 'Homework help is not switched on'], ['CO_DISABLED_BY_POLICY', 'switched this off'],
    ['POLICY_BLOCKED', 'Homework help is paused until tomorrow because today’s learning time is used up.'], ['TURN_LIMIT_REACHED', 'asked Co a lot today'],
  ])('shows the safe copy for %s and keeps the text', async (code, text) => {
    entry({ band: 'teens', createError: code })
    type(await screen.findByTestId('problem-input'), 'Some problem')
    fireEvent.click(screen.getByTestId('help-me'))
    expect(await screen.findByTestId('create-error')).toHaveTextContent(text)
    expect((screen.getByTestId('problem-input') as HTMLTextAreaElement).value).toBe('Some problem')
  })
})

describe('L18 Restate (F-L18-01)', () => {
  it.each(homeworkBands)('%s: Co restates the problem and asks Yes / Not quite, with the AI label, the parent notice and the problem', async band => {
    session({ band, seed: 'restate' })
    expect(await screen.findByTestId('restatement')).toHaveTextContent(scripts[band].restatement)
    expect(screen.getByTestId('restate-question')).toHaveTextContent('Is that right?')
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Not quite' })).toBeInTheDocument()
    expect(screen.getByTestId('problem-card')).toHaveTextContent(scripts[band].problem)
    expect(screen.getByTestId('ai-label')).toHaveTextContent('Co is an AI helper')
    expect(screen.getByTestId('parent-notice')).toHaveTextContent(band === 'kids' ? parentNotices.kids : band === 'tweens' ? parentNotices.tweens : parentNotices.teens)
    expect(document.querySelector('[data-lesson-frame]')).not.toBeNull()
    expect(screen.getByTestId('journey')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Check that Co understood' })).toHaveFocus()
  })
  it('shows Co thinking while the first restatement is made, never a partial restatement, then the restatement', async () => {
    const { server } = session({ band: 'tweens', seed: 'restate-pending', pendingPolls: 3 })
    expect(await screen.findByTestId('thinking-title')).toHaveTextContent('Co is thinking')
    expect(screen.getByText('Co is reading your problem.')).toBeInTheDocument()
    expect(screen.queryByTestId('restatement')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument()
    expect(await screen.findByTestId('restatement')).toHaveTextContent('So we need to add 3/4 and 1/8.')
    expect(server.calls.filter(call => call.method === 'GET' && call.path === '/homework/sessions/hw-1').length).toBeGreaterThan(2)
  })
  it('Yes asks for the first step once and shows Co thinking, then step 1', async () => {
    const { server } = session({ band: 'tweens', seed: 'restate', pendingPolls: 2 })
    fireEvent.click(await screen.findByRole('button', { name: 'Yes' }))
    expect(await screen.findByTestId('thinking-title')).toBeInTheDocument()
    expect(await screen.findByTestId('step-title')).toHaveTextContent('Step 1')
    expect(screen.getByTestId('step-prompt')).toHaveTextContent(scripts.tweens.steps[0]!.prompt)
    expect(posts(server, '/restatement')).toHaveLength(1)
    expect(posts(server, '/restatement')[0]!.body).toMatchObject({ confirmed: true, clientTurnId: expect.stringMatching(/^[0-9a-f-]{36}$/) })
    expect(screen.getByTestId('step-title')).toHaveFocus()
  })
  it('Not quite only goes back to the problem (no model call); the new text replaces it with a PUT and Co restates again', async () => {
    const { server } = session({ band: 'tweens', seed: 'restate' })
    fireEvent.click(await screen.findByRole('button', { name: 'Not quite' }))
    await screen.findByRole('heading', { name: 'Let us fix the problem' })
    expect(posts(server, '/restatement')[0]!.body).toMatchObject({ confirmed: false, clientTurnId: expect.stringMatching(/^[0-9a-f-]{36}$/) })
    expect(server.sessions.get('hw-1')!.turns.filter(turn => turn.kind === 'HW_RESTATE')).toHaveLength(1)
    const box = screen.getByRole('textbox', { name: 'The problem' })
    expect((box as HTMLTextAreaElement).value).toBe(scripts.tweens.problem)
    type(box, '3/4 + 1/8, add the fractions')
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
    expect(await screen.findByTestId('thinking-title')).toBeInTheDocument()
    expect(await screen.findByTestId('restatement')).toHaveTextContent(scripts.tweens.restatement)
    const puts = server.calls.filter(call => call.method === 'PUT')
    expect(puts).toHaveLength(1)
    expect(puts[0]!.path).toBe('/homework/sessions/hw-1/problem')
    expect(puts[0]!.body).toMatchObject({ problem: '3/4 + 1/8, add the fractions', clientTurnId: expect.stringMatching(/^[0-9a-f-]{36}$/) })
    // The same session is kept: no new session, no abandon, no navigation.
    expect(posts(server, '/homework/sessions')).toHaveLength(0)
    expect(posts(server, '/abandon')).toHaveLength(0)
    expect(navigate).not.toHaveBeenCalled()
    expect(server.sessions.get('hw-1')!.problem).toBe('3/4 + 1/8, add the fractions')
    expect(screen.getByTestId('problem-card')).toHaveTextContent('add the fractions')
    expect(server.sessions.get('hw-1')!.turns.filter(turn => turn.kind === 'HW_RESTATE')).toHaveLength(2)
  })
  it('a lost reply on the new problem is not a second restate: the same client id goes out again', async () => {
    const { server } = session({ band: 'tweens', seed: 'capture', dropReplies: 1 })
    type(await screen.findByRole('textbox', { name: 'The problem' }), 'Add 3/4 and 1/8')
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
    await screen.findByTestId('restatement')
    const put = server.calls.filter(call => call.method === 'PUT')
    expect(put).toHaveLength(1)
    const again = server.handle('PUT', '/api/learn/homework/sessions/hw-1/problem', put[0]!.body)
    expect(again.status).toBe(202)
    expect(server.sessions.get('hw-1')!.turns.filter(turn => turn.kind === 'HW_RESTATE')).toHaveLength(2)
    expect(server.handle('PUT', '/api/learn/homework/sessions/hw-1/problem', { ...(put[0]!.body as object), problem: 'another text' }).status).toBe(409)
  })
  it('confirming the restatement carries a client id too: a lost reply moves on once, never twice', async () => {
    const { server } = session({ band: 'tweens', seed: 'restate', dropReplies: 1 })
    fireEvent.click(await screen.findByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(screen.getByTestId('step-title')).toHaveTextContent('Step 1'))
    const sent = posts(server, '/restatement')
    expect(sent).toHaveLength(1)
    expect(server.handle('POST', '/api/learn/homework/sessions/hw-1/restatement', sent[0]!.body).status).toBe(202)
    expect(server.sessions.get('hw-1')!.turns.filter(turn => turn.kind === 'HW_STEP')).toHaveLength(1)
  })
})

describe('L18 Steps (F-L18-02, F-L18-05)', () => {
  it.each(homeworkBands)('%s: one guiding step at a time with an answer box, an AI label and no answer anywhere', async band => {
    session({ band, seed: 'steps' })
    expect(await screen.findByTestId('step-prompt')).toHaveTextContent(scripts[band].steps[0]!.prompt)
    expect(screen.getByLabelText('Your answer to this step')).toBeInTheDocument()
    expect(screen.queryByTestId('step-trail')).not.toBeInTheDocument()
    expect(screen.queryByText(scripts[band].steps[1]!.prompt)).not.toBeInTheDocument()
    expect(screen.getByTestId('ai-label')).toBeInTheDocument()
    for (const answer of scripts[band].expected.all) expect(bodyText().replace(scripts[band].problem, '').toLowerCase()).not.toContain(answer.toLowerCase())
    expect(screen.getByTestId('hint-ladder')).toHaveAttribute('data-hints-shown', '0')
  })
  it('sends the typed step response with a client id, shows Co thinking, then the next step with an empty box and the trail', async () => {
    const { server } = session({ band: 'tweens', seed: 'steps', pendingPolls: 2 })
    const box = await screen.findByLabelText('Your answer to this step')
    expect(screen.getByTestId('step-send')).toBeDisabled()
    type(box, 'Make the bottoms the same')
    fireEvent.click(screen.getByTestId('step-send'))
    expect(await screen.findByTestId('thinking-title')).toBeInTheDocument()
    // The answered step moves into the trail while Co thinks; no box is offered until the next step arrives.
    expect(within(screen.getByTestId('step-trail')).getByText('Make the bottoms the same')).toBeInTheDocument()
    expect(screen.queryByLabelText('Your answer to this step')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('step-title')).toHaveTextContent('Step 2'))
    expect(screen.getByTestId('step-prompt')).toHaveTextContent(scripts.tweens.steps[1]!.prompt)
    expect((screen.getByLabelText('Your answer to this step') as HTMLTextAreaElement).value).toBe('')
    expect(within(screen.getByTestId('step-trail')).getByText('Make the bottoms the same')).toBeInTheDocument()
    const sent = posts(server, '/steps')
    expect(sent).toHaveLength(1)
    expect(sent[0]!.body).toMatchObject({ learnerResponse: 'Make the bottoms the same' })
    expect((sent[0]!.body as { clientTurnId: string }).clientTurnId).toMatch(/^[0-9a-f-]{36}$/)
  })
  it('polls with the backoff: the attempt counter starts again for every new turn', async () => {
    session({ band: 'tweens', seed: 'steps', pendingPolls: 3 })
    fireEvent.change(await screen.findByLabelText('Your answer to this step'), { target: { value: 'Add the tops' } })
    fireEvent.click(screen.getByTestId('step-send'))
    await waitFor(() => expect(screen.getByTestId('step-title')).toHaveTextContent('Step 2'))
    const first = delay.mock.calls.map(call => (call as unknown as [number])[0])
    expect(first[0]).toBe(0)
    expect(first.slice(0, 3)).toEqual([0, 1, 2])
    delay.mockClear()
    fireEvent.change(screen.getByLabelText('Your answer to this step'), { target: { value: 'Multiply by 2' } })
    fireEvent.click(screen.getByTestId('step-send'))
    await waitFor(() => expect(screen.getByTestId('step-title')).toHaveTextContent('Step 3'))
    expect(delay.mock.calls[0]).toEqual([0])
  })
  it('a lost reply is not a second step: the same client id is sent again, with the text kept, even after a reload', async () => {
    const { server, view } = session({ band: 'tweens', seed: 'steps', dropReplies: 1 })
    type(await screen.findByLabelText('Your answer to this step'), 'Make the bottoms the same')
    fireEvent.click(screen.getByTestId('step-send'))
    expect(await screen.findByTestId('action-error')).toHaveTextContent('Co is not available right now')
    // The server took the first request. A reload (new page, same sessionStorage) shows what it holds.
    view.unmount()
    render(shell({ band: 'tweens' }, <HomeworkSessionScreen sessionId="hw-1" navigate={navigate} pollTiming={{ delay }} />))
    await waitFor(() => expect(screen.getByTestId('step-title')).toHaveTextContent('Step 2'))
    expect(server.sessions.get('hw-1')!.steps).toHaveLength(2)
    // A repeat of the SAME send (here forced by the mock) returns the same turn and never a third step.
    const first = posts(server, '/steps')[0]!.body as { clientTurnId: string; learnerResponse: string }
    const again = server.handle('POST', '/api/learn/homework/sessions/hw-1/steps', first)
    expect(again.status).toBe(202)
    expect(server.sessions.get('hw-1')!.steps).toHaveLength(2)
    expect(server.sessions.get('hw-1')!.turns.filter(turn => turn.kind === 'HW_STEP')).toHaveLength(2)
    expect(server.handle('POST', '/api/learn/homework/sessions/hw-1/steps', { ...first, learnerResponse: 'something else' }).status).toBe(409)
  })
  it('retrying after a lost reply on the same page reuses the client id and sends the same text', async () => {
    const { server } = session({ band: 'tweens', seed: 'steps', dropReplies: 1 })
    type(await screen.findByLabelText('Your answer to this step'), 'Make the bottoms the same')
    fireEvent.click(screen.getByTestId('step-send'))
    await screen.findByTestId('action-error')
    // The session has moved on at the server (the first request was processed), so the page now shows the next step.
    await waitFor(() => expect(screen.getByTestId('step-title')).toHaveTextContent('Step 2'))
    const sent = posts(server, '/steps')
    expect(sent).toHaveLength(1)
  })
  it('refuses to send an empty or blank step response', async () => {
    const { server } = session({ band: 'kids', seed: 'steps' })
    const box = await screen.findByLabelText('Your answer to this step')
    expect(screen.getByRole('button', { name: 'Done!' })).toBeDisabled()
    type(box, '    ')
    expect(screen.getByRole('button', { name: 'Done!' })).toBeDisabled()
    expect(posts(server, '/steps')).toHaveLength(0)
  })
  it('keeps the band limits on the step response', async () => {
    session({ band: 'kids', seed: 'steps' })
    const box = (await screen.findByLabelText('Your answer to this step')) as HTMLTextAreaElement
    expect(box.maxLength).toBe(300)
    type(box, 'y'.repeat(400)); expect(box.value.length).toBe(300)
  })
  it('lets the learner go to their own answer when ready', async () => {
    const { server } = session({ band: 'tweens', seed: 'steps' })
    fireEvent.click(await screen.findByTestId('go-final'))
    expect(await screen.findByTestId('final-line')).toBeInTheDocument()
    expect(posts(server, '/final-phase')).toHaveLength(1)
  })
})

describe('L18 hint ladder (F-L18-02)', () => {
  const hintCalls = (server: ReturnType<typeof createHomeworkMock>) => posts(server, '/hint').map(call => (call.body as { level: number }).level)
  it.each(homeworkBands)('%s: nothing is fetched ahead; the three rungs are asked for one at a time in order with the band labels', async band => {
    const { server } = session({ band, seed: 'steps' })
    await screen.findByTestId('hint-ladder')
    await settled()
    expect(hintCalls(server)).toEqual([])
    const labels = { kids: ['A little help', 'More help', 'Look at this'], tweens: ['A small nudge', 'A bigger hint', 'A similar example'], teens: ['Nudge', 'Hint', 'Similar example'] }[band]
    for (let level = 1; level <= 3; level++) {
      fireEvent.click(await screen.findByTestId('hint-button'))
      await waitFor(() => expect(screen.getByTestId('hint-ladder')).toHaveAttribute('data-hints-shown', String(level)))
      expect(hintCalls(server)).toEqual([1, 2, 3].slice(0, level))
      const rung = screen.getByTestId('hint-ladder').querySelector(`[data-hint-level="${level}"]`)!
      expect(within(rung as HTMLElement).getByRole('heading', { level: 3 })).toHaveTextContent(labels[level - 1]!)
      expect(rung).toHaveTextContent(scripts[band].steps[0]!.hints[level - 1]!)
    }
    expect(screen.queryByTestId('hint-button')).not.toBeInTheDocument()
    expect(screen.getByTestId('hint-unavailable')).toHaveTextContent('You have seen all three hints for this step.')
    expect(within(screen.getByTestId('hint-unavailable')).getByRole('button')).toBeDisabled()
  })
  it('the button label names the next rung', async () => {
    session({ band: 'kids', seed: 'steps' })
    expect(await screen.findByTestId('hint-button')).toHaveTextContent('Need a hint?')
    fireEvent.click(screen.getByTestId('hint-button'))
    await waitFor(() => expect(screen.getByTestId('hint-button')).toHaveTextContent('More help'))
    fireEvent.click(screen.getByTestId('hint-button'))
    await waitFor(() => expect(screen.getByTestId('hint-button')).toHaveTextContent('Look at this'))
  })
  it('a double press asks for one rung, and the next step starts a new ladder', async () => {
    const { server } = session({ band: 'tweens', seed: 'steps' })
    const button = await screen.findByTestId('hint-button')
    fireEvent.click(button); fireEvent.click(button)
    await waitFor(() => expect(screen.getByTestId('hint-ladder')).toHaveAttribute('data-hints-shown', '1'))
    expect(hintCalls(server)).toEqual([1])
    type(screen.getByLabelText('Your answer to this step'), 'Make the bottoms the same')
    fireEvent.click(screen.getByTestId('step-send'))
    await waitFor(() => expect(screen.getByTestId('step-title')).toHaveTextContent('Step 2'))
    expect(screen.getByTestId('hint-ladder')).toHaveAttribute('data-hints-shown', '0')
    expect(screen.getByTestId('hint-button')).toHaveTextContent('Need a hint?')
  })
  it('is disabled with the reason when the school switched hints off, and sends nothing', async () => {
    const { server } = session({ band: 'tweens', seed: 'steps', hintsMax: 0 })
    const off = await screen.findByTestId('hint-unavailable')
    expect(off).toHaveTextContent('Hints are switched off for your homework help.')
    expect(within(off).getByRole('button')).toBeDisabled()
    expect(hintCalls(server)).toEqual([])
  })
  it('is disabled with the reason when the cap is reached', async () => {
    session({ band: 'tweens', seed: 'steps-hint2', hintsMax: 2 })
    const off = await screen.findByTestId('hint-unavailable')
    expect(off).toHaveTextContent('the hints your school allows')
    expect(screen.getByTestId('hint-ladder')).toHaveAttribute('data-hints-shown', '2')
  })
  it('resumes the rungs already used (from the hint turns) and then asks only for the next one', async () => {
    const { server } = session({ band: 'tweens', seed: 'steps-hint2' })
    await waitFor(() => expect(screen.getByTestId('hint-ladder')).toHaveAttribute('data-hints-shown', '2'))
    expect(screen.getByTestId('hint-ladder')).toHaveTextContent(scripts.tweens.steps[0]!.hints[1]!)
    fireEvent.click(screen.getByTestId('hint-button'))
    await waitFor(() => expect(screen.getByTestId('hint-ladder')).toHaveAttribute('data-hints-shown', '3'))
    expect(hintCalls(server)).toEqual([3])
  })
  it('an out-of-order request is refused by the server with safe copy and the ladder stays put', async () => {
    const { server } = session({ band: 'tweens', seed: 'steps' })
    await screen.findByTestId('hint-button')
    const refused = server.handle('POST', '/api/learn/homework/sessions/hw-1/hint', { clientTurnId: 'out-of-order-0001', level: 2 })
    expect(refused.status).toBe(409); expect((refused.body as { code: string }).code).toBe('HINT_OUT_OF_ORDER')
  })
  it('a hint that fails never blocks the step; the learner can ask again', async () => {
    session({ band: 'tweens', seed: 'steps', failTurns: 1, failKind: 'HW_HINT' })
    fireEvent.click(await screen.findByTestId('hint-button'))
    expect(await screen.findByTestId('hint-error')).toHaveTextContent('Co could not find a hint just now')
    expect(screen.getByLabelText('Your answer to this step')).toBeEnabled()
    fireEvent.click(screen.getByTestId('hint-button'))
    await waitFor(() => expect(screen.getByTestId('hint-ladder')).toHaveAttribute('data-hints-shown', '1'))
  })
})

describe('L18 Final answer and Checked (F-L18-03, F-L18-04, F-L18-05)', () => {
  it.each(homeworkBands)('%s: the learner types their own short answer (max 200), with big buttons and no pictures', async band => {
    session({ band, seed: 'final' })
    const input = (await screen.findByTestId('final-input')) as HTMLInputElement
    expect(input.maxLength).toBe(200)
    type(input, 'z'.repeat(250)); expect(input.value.length).toBe(200)
    expect(screen.getByTestId('char-count')).toHaveTextContent('200 / 200 characters')
    expect(document.querySelectorAll('img, picture, svg[role="img"]:not([data-co-state])').length).toBe(0)
    expect(screen.getByTestId('final-line').textContent).toMatch(/not tell|not give/)
    expect(screen.getByTestId('final-check')).toBeEnabled()
    expect(bodyText()).not.toMatch(/the answer is/i)
  })
  it('checks the answer with a thinking state, then celebrates an on-track answer and offers a new problem (never shows the correct answer)', async () => {
    const { server } = session({ band: 'tweens', seed: 'final', pendingPolls: 2 })
    type(await screen.findByTestId('final-input'), '7/8')
    fireEvent.click(screen.getByTestId('final-check'))
    expect(await screen.findByTestId('thinking-title')).toBeInTheDocument()
    const done = await screen.findByTestId('done-title')
    expect(done).toHaveTextContent('You did it!')
    expect(screen.getByTestId('your-answer')).toHaveTextContent('7/8')
    expect(screen.getByTestId('check-feedback')).toHaveTextContent(scripts.tweens.feedback.onTrack)
    expect(posts(server, '/final')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'New problem' }))
    expect(navigate).toHaveBeenCalledWith('/learn/homework')
    fireEvent.click(screen.getByRole('button', { name: 'Back home' }))
    expect(navigate).toHaveBeenCalledWith('/learn/home')
  })
  it('not yet: says check the last step again, offers another try and never shows or asks for the correct answer', async () => {
    session({ band: 'tweens', seed: 'checked-not-yet' })
    expect(await screen.findByTestId('checked-title')).toHaveTextContent('Not quite yet. Check the last step again.')
    expect(screen.getByTestId('check-feedback')).toHaveTextContent(scripts.tweens.feedback.notYet)
    expect(bodyText().replace(scripts.tweens.problem, '')).not.toContain('7/8')
    expect(bodyText()).not.toMatch(/correct answer|the answer is|solution/i)
    expect(screen.getByTestId('try-again')).toBeInTheDocument()
    expect(screen.getByText(/Try 2 of 3 next/)).toBeInTheDocument()
  })
  it('unclear: says it could not tell and lets the learner write it another way', async () => {
    session({ band: 'tweens', seed: 'checked-unclear' })
    expect(await screen.findByTestId('checked-title')).toHaveTextContent('I could not tell what you meant')
    fireEvent.click(screen.getByTestId('try-again'))
    expect(await screen.findByTestId('final-input')).toBeEnabled()
  })
  it('a second try sends a new client id, up to three tries, then an honest neutral end', async () => {
    const { server } = session({ band: 'tweens', seed: 'checked-not-yet' })
    for (const text of ['5/8', '4/12']) {
      fireEvent.click(await screen.findByTestId('try-again'))
      type(await screen.findByTestId('final-input'), text)
      fireEvent.click(screen.getByTestId('final-check'))
      await waitFor(() => expect(screen.getByTestId('your-answer')).toHaveTextContent(text))
    }
    const ids = posts(server, '/final').map(call => (call.body as { clientTurnId: string }).clientTurnId)
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
    expect(await screen.findByTestId('done-neutral')).toHaveTextContent('Co could not confirm your answer this time')
    expect(screen.queryByTestId('try-again')).not.toBeInTheDocument()
    expect(bodyText()).not.toContain('Well done')
    expect(screen.getByRole('button', { name: 'New problem' })).toBeInTheDocument()
  })
  it('when the tries are used up (finalAttempts is 3) the answer box is not offered again, and Finish ends the session', async () => {
    const { server } = session({ band: 'tweens', seed: 'checked-exhausted' })
    expect(await screen.findByTestId('tries-used')).toHaveTextContent('used all your tries')
    expect(screen.queryByTestId('try-again')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('finish'))
    expect(await screen.findByTestId('done-neutral')).toBeInTheDocument()
    expect(posts(server, '/finish')).toHaveLength(1)
    expect(server.sessions.get('hw-1')!.phase).toBe('DONE')
  })
  it('Finish for now ends a checked session after a not-yet answer without a worked solution', async () => {
    const { server } = session({ band: 'teens', seed: 'checked-not-yet' })
    fireEvent.click(await screen.findByTestId('finish'))
    expect(await screen.findByTestId('done-neutral')).toBeInTheDocument()
    expect(posts(server, '/finish')[0]!.body).toEqual({})
    expect(bodyText()).not.toMatch(/worked solution|full solution/i)
  })
  it('when the server says FINAL_ATTEMPTS_EXHAUSTED (a try raced ahead) the page shows the tries-used ending', async () => {
    const server = createHomeworkMock({ band: 'tweens', seed: 'checked-not-yet' })
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => String(input).endsWith('/final') && init?.method === 'POST'
      ? new Response(JSON.stringify({ code: 'FINAL_ATTEMPTS_EXHAUSTED', message: 'private' }), { status: 409 })
      : server.fetch(input, init)))
    render(shell({ band: 'tweens' }, <HomeworkSessionScreen sessionId="hw-1" navigate={navigate} pollTiming={{ delay }} />))
    fireEvent.click(await screen.findByTestId('try-again'))
    type(await screen.findByTestId('final-input'), '5/8')
    fireEvent.click(screen.getByTestId('final-check'))
    expect(await screen.findByTestId('tries-used')).toBeInTheDocument()
  })
  it('a finished session with an unconfirmed answer is neutral and has no worked solution', async () => {
    session({ band: 'teens', seed: 'done-neutral' })
    expect(await screen.findByTestId('done-neutral')).toBeInTheDocument()
    expect(bodyText()).not.toMatch(/worked solution|show (me )?the (full )?(solution|answer)/i)
    expect(screen.queryByRole('button', { name: /worked|solution/i })).not.toBeInTheDocument()
  })
  it('a lost reply on the final answer is not a second check: the same id is sent again', async () => {
    const { server } = session({ band: 'tweens', seed: 'final', dropReplies: 1 })
    type(await screen.findByTestId('final-input'), '7/8')
    fireEvent.click(screen.getByTestId('final-check'))
    await screen.findByTestId('action-error').catch(() => undefined)
    await settled()
    expect(server.sessions.get('hw-1')!.turns.filter(turn => turn.kind === 'HW_CHECK')).toHaveLength(1)
    expect(server.sessions.get('hw-1')!.finalTries).toBe(1)
  })
  it('F-L18-05: the learner view never gets the correct answer in any payload of a whole session', async () => {
    const { server } = session({ band: 'tweens', seed: 'restate' })
    fireEvent.click(await screen.findByRole('button', { name: 'Yes' }))
    for (let step = 1; step <= 3; step++) {
      await waitFor(() => expect(screen.getByTestId('step-title')).toHaveTextContent(`Step ${step}`))
      fireEvent.click(screen.getByTestId('hint-button'))
      await waitFor(() => expect(screen.getByTestId('hint-ladder')).toHaveAttribute('data-hints-shown', '1'))
      type(screen.getByLabelText('Your answer to this step'), `my idea ${step}`)
      fireEvent.click(screen.getByTestId('step-send'))
    }
    type(await screen.findByTestId('final-input'), '4/12')
    fireEvent.click(screen.getByTestId('final-check'))
    await screen.findByTestId('checked-title')
    const payloads = JSON.stringify([...server.sessions.values()].map(s => ({ steps: s.steps, turns: s.turns.map(t => t.reply), restatement: s.restatement, final: s.final })))
    expect(payloads).not.toContain('7/8')
    expect(bodyText().replace(scripts.tweens.problem, '')).not.toContain('7/8')
  })
})

describe('L18 safety redirect', () => {
  it.each(homeworkBands)('%s: a SAFE_REDIRECT turn shows the shield, "Safety check" and the code-owned guidance verbatim, and the session pauses', async band => {
    session({ band, seed: 'safety' })
    const heading = await screen.findByRole('heading', { level: 2, name: 'Safety check' })
    expect(heading).toHaveFocus()
    expect(screen.getByTestId('safety-guidance').textContent).toBe(safetyGuidance.SAFE_REDIRECT[band])
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByTestId('hint-ladder')).not.toBeInTheDocument()
    expect(screen.queryByTestId('problem-card')).not.toBeInTheDocument()
    expect(screen.getByTestId('homework-announcer')).toHaveTextContent('Safety check')
    fireEvent.click(screen.getByRole('button', { name: 'Back to homework help' }))
    expect(navigate).toHaveBeenCalledWith('/learn/homework')
  })
  it('lets the learner choose to go back to the problem after a SAFE_REDIRECT, but not after TRUSTED_ADULT', async () => {
    session({ band: 'tweens', seed: 'safety' })
    fireEvent.click(await screen.findByRole('button', { name: 'Go back to my problem' }))
    expect(await screen.findByLabelText('Your answer to this step')).toBeEnabled()
    expect(screen.queryByText('Safety check')).not.toBeInTheDocument()
    cleanup()
    session({ band: 'tweens', seed: 'safety-trusted' })
    expect(await screen.findByTestId('safety-guidance')).toHaveTextContent(safetyGuidance.TRUSTED_ADULT.tweens)
    expect(screen.queryByRole('button', { name: 'Go back to my problem' })).not.toBeInTheDocument()
  })
  it('the redirected message was never recorded as a step answer, so the step is still open', async () => {
    const { server } = session({ band: 'tweens', seed: 'safety' })
    await screen.findByTestId('safety-guidance')
    expect(server.sessions.get('hw-1')!.steps[0]!.learnerResponse).toBeNull()
  })
  it('a safety redirect from a typed step arrives as a READY turn without ever showing Co thinking text first', async () => {
    const { server } = session({ band: 'teens', seed: 'steps' })
    type(await screen.findByLabelText('Your answer to this step'), 'I want to hurt myself')
    fireEvent.click(screen.getByTestId('step-send'))
    expect(await screen.findByTestId('safety-guidance')).toHaveTextContent(safetyGuidance.SAFE_REDIRECT.teens)
    expect(server.sessions.get('hw-1')!.turns.at(-1)!.reply!.generatedBy).toEqual({ kind: 'CODE' })
  })
})

describe('L18 failures, pending and resume', () => {
  it('shows a failed turn with Try again, retries through the homework retry endpoint and then continues', async () => {
    const { server } = session({ band: 'tweens', seed: 'failed' })
    expect(await screen.findByRole('heading', { level: 2, name: 'Co could not finish that' })).toBeInTheDocument()
    expect(bodyText()).not.toMatch(/generation_failed/)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByTestId('restatement')).toHaveTextContent(scripts.tweens.restatement)
    // A homework turn is retried through the homework route (the shared turn retry refuses a homework conversation with 409).
    expect(server.calls.filter(call => call.path.endsWith('/retry'))).toHaveLength(1)
    expect(server.calls.find(call => call.path.endsWith('/retry'))).toMatchObject({ method: 'POST', path: '/homework/sessions/hw-1/retry', body: {} })
    expect(server.calls.some(call => call.path.startsWith('/co/'))).toBe(false)
  })
  it('a final failure offers no retry, only the way back', async () => {
    session({ band: 'tweens', seed: 'failed-final' })
    await screen.findByRole('heading', { name: 'Co could not finish that' })
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back to homework help' }))
    expect(navigate).toHaveBeenCalledWith('/learn/homework')
  })
  it('keeps Co thinking while a turn is held pending, disables the inputs and never shows partial text, then continues when it finishes', async () => {
    const { server } = session({ band: 'tweens', seed: 'thinking' })
    expect(await screen.findByTestId('thinking-title')).toBeInTheDocument()
    expect(screen.queryByLabelText('Your answer to this step')).not.toBeInTheDocument()
    expect(screen.queryByTestId('step-send')).not.toBeInTheDocument()
    await settled()
    expect(screen.getByTestId('thinking-title')).toBeInTheDocument()
    expect(screen.queryByText(scripts.tweens.steps[1]!.prompt)).not.toBeInTheDocument()
    act(() => server.release())
    await waitFor(() => expect(screen.getByTestId('step-title')).toHaveTextContent('Step 2'))
  })
  it.each([
    ['restate', 'restatement'], ['steps', 'step-prompt'], ['final', 'final-line'], ['checked-not-yet', 'checked-title'], ['done', 'done-title'],
  ])('resumes the %s phase after a refresh', async (seed, testId) => {
    session({ band: 'tweens', seed: seed as never })
    expect(await screen.findByTestId(testId)).toBeInTheDocument()
    expect(screen.getByTestId('homework-view')).toHaveAttribute('data-phase', { restate: 'RESTATE', steps: 'STEPS', final: 'FINAL', 'checked-not-yet': 'CHECKED', done: 'DONE' }[seed]!)
  })
  it('resumes at the second step with the trail of what was answered', async () => {
    session({ band: 'tweens', seed: 'steps-2' })
    expect(await screen.findByTestId('step-title')).toHaveTextContent('Step 2')
    expect(within(screen.getByTestId('step-trail')).getByText('Make the bottoms the same')).toBeInTheDocument()
  })
  it('shows the capture editor when the session is back at the problem', async () => {
    session({ band: 'kids', seed: 'capture' })
    expect(await screen.findByRole('heading', { name: 'Let us fix the problem!' })).toBeInTheDocument()
    expect((screen.getByLabelText('The problem') as HTMLTextAreaElement).value).toBe(scripts.kids.problem)
  })
  it('a closed session says so and offers a new problem', async () => {
    session({ band: 'tweens', seed: 'abandoned' })
    expect(await screen.findByText('This homework help was closed')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'New problem' }))
    expect(navigate).toHaveBeenCalledWith('/learn/homework')
  })
  it('does not leak whether a session exists: a 404 is a plain not-found, a 503 can be retried', async () => {
    session({ band: 'tweens', sessionStatus: 404 })
    expect(await screen.findByText('We could not find that homework help')).toBeInTheDocument()
    cleanup()
    session({ band: 'tweens', sessionStatus: 503 })
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
  it('refuses a session payload that carries a solution and shows nothing from it', async () => {
    const server = createHomeworkMock({ band: 'tweens', seed: 'steps' })
    const leaky = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await server.fetch(input, init)
      const text = await response.text()
      if (!String(input).endsWith('/homework/sessions/hw-1')) return new Response(text, { status: response.status })
      const json = JSON.parse(text)
      json.data.workedSolution = ['Add the tops: 7/8']
      return new Response(JSON.stringify(json), { status: 200 })
    })
    vi.stubGlobal('fetch', leaky)
    render(shell({ band: 'tweens' }, <HomeworkSessionScreen sessionId="hw-1" navigate={navigate} pollTiming={{ delay }} />))
    expect(await screen.findByText(/returned something unexpected/)).toBeInTheDocument()
    expect(bodyText()).not.toContain('7/8')
  })
  it('keeps the page and shows a note when a re-read fails in the middle of a session', async () => {
    const server = createHomeworkMock({ band: 'tweens', seed: 'thinking' })
    let failing = false
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => failing ? new Response('{}', { status: 503 }) : server.fetch(input, init)))
    render(shell({ band: 'tweens' }, <HomeworkSessionScreen sessionId="hw-1" navigate={navigate} pollTiming={{ delay }} />))
    await screen.findByTestId('thinking-title')
    failing = true
    expect(await screen.findByTestId('connection-note')).toBeInTheDocument()
    expect(screen.getByTestId('thinking-title')).toBeInTheDocument()
    failing = false; act(() => server.release())
    await waitFor(() => expect(screen.getByTestId('step-title')).toHaveTextContent('Step 2'))
    expect(screen.queryByTestId('connection-note')).not.toBeInTheDocument()
  })
})

describe('L18 read-aloud, live regions and accessibility', () => {
  it('has no read-aloud control when the device cannot speak', async () => {
    restoreNone = removeSpeech()
    session({ band: 'kids', seed: 'restate' })
    await screen.findByTestId('restatement')
    expect(screen.queryByTestId('read-aloud')).not.toBeInTheDocument()
  })
  it('reads Co aloud with a local voice only when pressed, never by itself', async () => {
    speech = installFakeSpeech()
    session({ band: 'kids', seed: 'restate' })
    const button = await screen.findByTestId('read-aloud')
    expect(speech.spoken).toEqual([])
    expect(button).toHaveAccessibleName('Read to me')
    fireEvent.click(button)
    expect(speech.spoken).toEqual([`${scripts.kids.restatement} Is that right?`])
    expect(screen.getByRole('button', { name: 'Stop reading' })).toBeInTheDocument()
  })
  it('announces Co turns in a polite live region', async () => {
    session({ band: 'tweens', seed: 'restate' })
    const region = await screen.findByTestId('homework-announcer')
    expect(region).toHaveAttribute('role', 'status'); expect(region).toHaveAttribute('aria-live', 'polite')
    await waitFor(() => expect(region).toHaveTextContent(`Co says: ${scripts.tweens.restatement} Is that right?`))
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(region).toHaveTextContent(`Step 1. ${scripts.tweens.steps[0]!.prompt}`))
  })
  it('labels the journey, the leave button and every field', async () => {
    session({ band: 'teens', seed: 'steps' })
    expect(await screen.findByRole('button', { name: 'Leave homework help' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Where you are' })).toBeInTheDocument()
    expect(screen.getByText('Steps').closest('li')).toHaveAttribute('aria-current', 'step')
    for (const field of screen.getAllByRole('textbox')) expect(field).toHaveAccessibleName()
    fireEvent.click(screen.getByRole('button', { name: 'Leave homework help' }))
    expect(navigate).toHaveBeenCalledWith('/learn/homework')
  })
  it('works right-to-left', async () => {
    document.documentElement.dir = 'rtl'
    session({ band: 'tweens', seed: 'restate' })
    expect(await screen.findByTestId('restatement')).toBeInTheDocument()
    expect(document.documentElement.dir).toBe('rtl')
  })
})

describe('L18 entry point on the learn home', () => {
  it.each(homeworkBands)('%s: the home offers Homework help and opens /learn/homework', band => {
    render(<LearnIdentityProvider scope="account:a" band={band}><LearnHomeView data={homeFixture(band)} /></LearnIdentityProvider>)
    const card = screen.getByTestId('homework-help-card')
    expect(card).toHaveAttribute('href', '/learn/homework')
    expect(card).toHaveTextContent('Homework help')
  })
})
