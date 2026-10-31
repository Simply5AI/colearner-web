import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { id: 'learner-fixture' } } }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
import { LearnIdentityProvider } from '@/components/learn/learn-common'
import { ProgressScreen } from '@/components/learn-progress/progress-view'
import { TeachEntryScreen, TeachSessionScreen } from '@/components/teach-back/teach-view'
import { detail, progress, turn } from '@/components/teach-back/dev/b11-fixtures'
import type { LearnBand } from '@/lib/api/learn'
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.sessionStorage.clear() })
function mount(band: LearnBand, kind: 'teach' | 'progress', fetcher: (url: string, init?: RequestInit) => unknown) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const data = await fetcher(String(input), init)
    return Response.json({ statusCode: 200, data, timestamp: '2026-10-21T08:00:00Z' })
  }))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><LearnIdentityProvider scope="b11:test" band={band}>{kind === 'teach' ? <TeachSessionScreen sessionId="session-fixture" pollBaseMs={10} /> : <ProgressScreen />}</LearnIdentityProvider></QueryClientProvider>)
}
it.each(['kids', 'tweens', 'teens'] as const)('shows truthful %s voice availability and band feedback', async band => {
  mount(band, 'teach', () => detail(band))
  expect(await screen.findByTestId('teach-voice-note')).toHaveTextContent('speech recognition')
  if (band === 'teens') expect(screen.queryByTestId('taught-it')).toBeNull()
  else expect(await screen.findByTestId('taught-it')).toHaveTextContent('Taught it!')
  const sources = screen.getByTestId('teach-sources')
  expect(sources).not.toHaveAttribute('open')
  fireEvent.click(screen.getByText(band === 'kids' ? 'From your page' : 'Sources from your material'))
  expect(sources).toHaveAttribute('open')
  expect(sources).toHaveTextContent('Warm water can become vapour.')
  expect(screen.getByRole('link', { name: 'Water cycle page' })).toHaveAttribute('href', '/learn/library/material-fixture')
  expect(screen.queryByRole('button', { name: /record|microphone/i })).toBeNull()
  expect(screen.queryByTestId('missed-points') !== null).toBe(band === 'teens')
  expect(screen.queryByTestId('exam-tip') !== null).toBe(band === 'teens')
  expect(document.body.textContent).not.toMatch(/AI pack|prompt release|synthetic-b11|0\.1\.5/)
  expect(screen.getAllByText(/Co is an AI helper/).length).toBeGreaterThan(0)
})
it('polls pending without partial content, then shows saved feedback', async () => {
  let done = false
  mount('teens', 'teach', url => {
    if (url.includes('/turns/')) { done = true; return turn() }
    return detail('teens', done ? 'feedback' : 'pending')
  })
  expect(await screen.findByTestId('teach-pending')).toHaveTextContent('checking')
  expect(screen.queryByTestId('teach-reply-text')).toBeNull()
  expect(await screen.findByTestId('teach-feedback')).toBeVisible()
  await waitFor(() => expect(screen.queryByTestId('teach-pending')).toBeNull())
})
it('shows kid garden without scores or miss lists', async () => {
  mount('kids', 'progress', () => progress('kids'))
  fireEvent.click(await screen.findByRole('button', { name: /Science/ }))
  expect(screen.getByTestId('garden-idea')).toHaveTextContent('Water cycle')
  expect(document.body.textContent).not.toMatch(/%|failures|Weak spots/)
  expect(screen.queryByTestId('export-csv')).toBeNull()
})
it('shows tween activity and explicit unavailable rewards', async () => {
  mount('tweens', 'progress', () => progress('tweens'))
  expect(await screen.findByTestId('rewards-unavailable')).toHaveTextContent('Levels and badges arrive in a later release')
  expect(screen.getByTestId('week-activity')).toHaveTextContent('2 sessions')
  expect(screen.queryByTestId('readiness')).toBeNull()
})
it('separates insufficient teen evidence, measured weak spots and Co suggests', async () => {
  mount('teens', 'progress', () => progress('teens', 'insufficient'))
  expect(await screen.findByTestId('readiness-pending')).toHaveTextContent('Not enough practice')
  expect(screen.getByTestId('co-suggests')).toHaveTextContent('turned off')
  expect(screen.getByTestId('weak-spots')).toHaveTextContent('No concept')
  expect(screen.getByTestId('export-csv')).toBeVisible()
})
it('an ambiguous send keeps exact body and the retry remains operable', async () => {
  const bodies: string[] = []
  let accepted = false
  mount('teens', 'teach', (_url, init) => {
    if (init?.method === 'POST') {
      bodies.push(String(init.body))
      if (bodies.length === 1) throw new Error('lost response')
      accepted = true
      return turn('QUEUED')
    }
    return detail('teens', accepted ? 'pending' : 'prompt')
  })
  fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'Water becomes vapour' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send explanation' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('explanation is kept')
  const retry = screen.getByRole('button', { name: 'Send again' })
  expect(retry).toBeEnabled()
  fireEvent.click(retry)
  await waitFor(() => expect(bodies).toHaveLength(2))
  expect(bodies[0]).toBe(bodies[1])
})

it('reuses a lost creation request but releases the creation id when entering the session', async () => {
  const ids: string[] = []
  let lose = true
  const started = vi.fn()
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    let data: unknown
    if (url.includes('/context')) data = { band: '14-17', available: true, reason: null, voice: { available: false, reason: 'No speech recognition.' }, concept: { title: 'Water', keyPoints: ['Water becomes vapour'], source: { materialId: 'material-fixture', title: 'Water page', link: null } }, openSessionId: null }
    else if (url.endsWith('/sessions')) {
      ids.push(JSON.parse(String(init?.body)).clientSessionId)
      if (lose) { lose = false; throw new Error('creation response lost') }
      data = { id: 'new-session' }
    } else data = turn('QUEUED')
    return Response.json({ statusCode: 200, data, timestamp: '2026-10-21T08:00:00Z' })
  }))
  const show = () => render(<QueryClientProvider client={new QueryClient()}><LearnIdentityProvider scope="b11:test" band="teens"><TeachEntryScreen materialId="material-fixture" onStarted={started} /></LearnIdentityProvider></QueryClientProvider>)
  const first = show()
  fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'Water becomes vapour' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send explanation' }))
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Send explanation' }))
  await waitFor(() => expect(started).toHaveBeenCalledOnce())
  expect(ids[0]).toBe(ids[1])
  first.unmount()
  show()
  fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'Another explanation' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send explanation' }))
  await waitFor(() => expect(started).toHaveBeenCalledTimes(2))
  expect(ids[2]).not.toBe(ids[1])
})

it('shows source labels and quotes without inventing a link for unlinked evidence', async () => {
  const payload = detail('teens')
  payload.turns[0]!.reply!.citations[0]!.link = null
  mount('teens', 'teach', () => payload)
  const sources = await screen.findByTestId('teach-sources')
  expect(sources).toHaveTextContent('Water cycle page')
  expect(sources).toHaveTextContent('Warm water can become vapour.')
  expect(sources.querySelector('a')).toBeNull()
})

it('shows the week activity instead of the empty state when sessions exist but no subject has evidence yet', async () => {
  mount('teens', 'progress', () => ({ ...progress('teens'), subjects: [], week: [{ date: '2026-10-27', completedSessions: 0 }, { date: '2026-10-28', completedSessions: 2 }] }))
  expect(await screen.findByTestId('week-activity')).toBeInTheDocument()
  expect(screen.getByTestId('subjects-pending')).toBeInTheDocument()
  expect(screen.queryByText('Your progress grows here')).toBeNull()
})
