import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getTutorFixture } from '@/lib/api/tutor-loop/fixtures'

const api = vi.hoisted(() => ({ getTutorToday: vi.fn(), getTodayScreenNudges: vi.fn(), dismissTutorNudge: vi.fn() }))
const entry = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => '/learn/today', useSearchParams: () => new URLSearchParams() }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { name: 'Sara Khan' } } }) }))
vi.mock('@/lib/api/tutor-loop/today', async (original) => ({ ...(await original<typeof import('@/lib/api/tutor-loop/today')>()), ...api }))
vi.mock('@/lib/api/tutor-loop/client', async (original) => ({ ...(await original<typeof import('@/lib/api/tutor-loop/client')>()), tutorLoopClient: { entry } }))

import { TodayTab } from '@/components/tutor-loop/today/today-tab'
import { TutorLoopApiError } from '@/lib/api/tutor-loop/client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const today = (): any => structuredClone(getTutorFixture('today'))
const show = (band: '14-17' | '18+' = '18+') => {
  entry.mockResolvedValue({ band, scope: 'PERSONAL', needsOnboarding: false, needsConsent: false, tutorIdentity: { name: 'Sage', icon: 'CLOUD' }, capabilities: {} })
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><TodayTab onOpenProgress={onProgress} /></QueryClientProvider>)
}
const onProgress = vi.fn()

beforeEach(() => { api.getTodayScreenNudges.mockResolvedValue({ items: [] }) })
afterEach(() => { cleanup(); vi.resetAllMocks() })

it('shows one suggestion with its reason, time and the goal countdown', async () => {
  api.getTutorToday.mockResolvedValue({ ...today(), fixedWork: [] })
  show()
  expect(await screen.findByRole('heading', { name: 'Hi Sara' })).toBeInTheDocument()
  const briefing = screen.getByTestId('today-briefing')
  expect(within(briefing).getByText('Practise acids and bases')).toBeInTheDocument()
  expect(within(briefing).getByText('Due for review today')).toBeInTheDocument()
  expect(within(briefing).getByText(/About 10 min/)).toBeInTheDocument()
  expect(within(briefing).getByRole('link', { name: 'Start' })).toHaveAttribute('href', expect.stringContaining('/learn/practice?goalId='))
  expect(screen.getByText(/109 days to Board exams/)).toBeInTheDocument()
  expect(screen.getByText('2 day streak')).toBeInTheDocument()
})

it('labels the tutor wording as the tutor’s suggestion and uses the learner’s tutor name and icon', async () => {
  api.getTutorToday.mockResolvedValue({ ...today(), fixedWork: [] })
  show()
  expect(await screen.findByText('Sage’s suggestion')).toBeInTheDocument()
  expect(screen.getByTestId('co-wording')).toHaveTextContent('A short review will help neutralisation stick.')
  expect(screen.getByTestId('today-briefing').querySelector('img')).toHaveAttribute('src', '/tutor-loop/cloud-speaking.svg')
})

it('still works without tutor wording and never shows a raw reason code', async () => {
  api.getTutorToday.mockResolvedValue({ ...today(), briefing: { ...today().briefing, wording: null }, fixedWork: [] })
  show()
  await screen.findByTestId('today-briefing')
  expect(screen.queryByTestId('co-wording')).toBeNull()
  expect(screen.queryByText(/DUE_REVIEW/)).toBeNull()
})

it('offers something else, then a way back', async () => {
  const data = today()
  data.briefing.alternative = { kind: 'LESSON', targetId: 't9', label: 'Learn salts', minutes: 15, reasonCodes: ['NEXT_IN_PLAN'] }
  api.getTutorToday.mockResolvedValue({ ...data, fixedWork: [] })
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Something else' }))
  expect(screen.getByText('Learn salts')).toBeInTheDocument()
  expect(screen.queryByTestId('co-wording')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Back to my first suggestion' }))
  expect(screen.getByText('Practise acids and bases')).toBeInTheDocument()
})

it('shows the done state when the alternative is done for today', async () => {
  api.getTutorToday.mockResolvedValue({ ...today(), fixedWork: [] })
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Something else' }))
  expect(screen.getByText('All done for today')).toBeInTheDocument()
  expect(screen.getByTestId('today-briefing')).toHaveAttribute('data-kind', 'DONE_FOR_TODAY')
})

it('asks for a shorter suggestion when the learner is short on time', async () => {
  api.getTutorToday.mockResolvedValue({ ...today(), fixedWork: [] })
  show()
  fireEvent.click(await screen.findByRole('button', { name: '15 min' }))
  await waitFor(() => expect(api.getTutorToday).toHaveBeenCalledWith({ availableMinutes: 15 }, { workspace: 'school' }))
  expect(screen.getByRole('button', { name: '15 min' })).toHaveAttribute('aria-pressed', 'true')
})

it('lists later work, teacher work and topics that need practice, with the Teens wording', async () => {
  const data = today()
  data.later = [...data.later, { ...data.later[0]!, id: 'x2', title: 'Salts', status: 'DONE' }]
  api.getTutorToday.mockResolvedValue({ ...data, fixedWork: [{ ...data.later[0]!, id: 'f1', kind: 'TEACHER_DUE', placement: 'FIXED', title: 'Lab report' }] })
  show('14-17')
  const later = await screen.findByTestId('today-later')
  expect(later).toHaveTextContent('1 more · 10 min · 1 done')
  fireEvent.click(within(later).getByRole('button', { expanded: false }))
  expect(within(later).getByText('Salts')).toBeInTheDocument()
  expect(within(screen.getByTestId('today-teacher')).getByText('Lab report')).toBeInTheDocument()
  expect(await screen.findByText('Worth another look')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Acids and bases' })).toHaveAttribute('href', expect.stringContaining('topicId='))
})

it('does not claim a readiness percentage when there is not enough practice', async () => {
  const data = today()
  data.readiness = { ...data.readiness!, percent: null, evidence: 'INSUFFICIENT', topicsCovered: 2, topicsTotal: 9 }
  api.getTutorToday.mockResolvedValue({ ...data, fixedWork: [] })
  show()
  const button = await screen.findByRole('button', { name: /Ready on 2 of 9 topics/ })
  expect(button).toHaveTextContent('Not enough practice yet')
  expect(screen.queryByText('60% ready')).toBeNull()
  fireEvent.click(button)
  expect(onProgress).toHaveBeenCalled()
})

it('shows loading, then an error with retry', async () => {
  api.getTutorToday.mockRejectedValueOnce(new TutorLoopApiError(500, 'Boom')).mockResolvedValueOnce({ ...today(), fixedWork: [] })
  show()
  expect(screen.getByRole('status')).toHaveTextContent('Loading today')
  expect(await screen.findByRole('alert')).toHaveTextContent('Today could not be loaded')
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByTestId('today-briefing')).toBeInTheDocument()
})

it('shows the tutor resting state with a way to keep studying', async () => {
  api.getTutorToday.mockRejectedValue(new TutorLoopApiError(503, 'Resting', 'TUTOR_RESTING'))
  show()
  expect(await screen.findByText('Sage is resting')).toBeInTheDocument()
  expect(screen.getByText(/Your plan still works/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Go to Practice' })).toHaveAttribute('href', '/learn/practice')
})

it('shows the add-material empty state and can dismiss a nudge', async () => {
  const data = today()
  data.briefing = { action: { kind: 'ADD_MATERIAL', targetId: null, label: 'Add study material', minutes: 0, reasonCodes: ['NO_MATERIAL'] }, alternative: null, wording: null }
  data.later = []
  api.getTutorToday.mockResolvedValue({ ...data, fixedWork: [] })
  api.getTodayScreenNudges.mockResolvedValue({ items: [{ id: 'n1', kind: 'REVIEW_DUE', text: 'A review is waiting.', reasonCodes: [], action: { kind: 'PRACTICE', targetId: null, label: 'Review now', minutes: 5, reasonCodes: [] }, alternative: null, expiresAt: '2026-11-14T00:00:00Z' }] })
  api.dismissTutorNudge.mockResolvedValue({})
  show()
  expect(await screen.findByRole('link', { name: 'Add material' })).toHaveAttribute('href', expect.stringContaining('/learn?tab=library'))
  fireEvent.click(await screen.findByRole('button', { name: 'Not now' }))
  await waitFor(() => expect(api.dismissTutorNudge).toHaveBeenCalledWith('n1'))
})
