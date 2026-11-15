import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getTutorFixture } from '@/lib/api/tutor-loop/fixtures'

const prog = vi.hoisted(() => ({ getTutorProgress: vi.fn(), downloadProgressCsv: vi.fn(), downloadProgressPdf: vi.fn() }))
const sched = vi.hoisted(() => ({ getTutorSchedule: vi.fn() }))
const today = vi.hoisted(() => ({ getTutorToday: vi.fn() }))
const profile = vi.hoisted(() => ({ getStudyPreferences: vi.fn() }))
const entry = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => '/learn/today', useSearchParams: () => new URLSearchParams() }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null }) }))
vi.mock('@/lib/api/tutor-loop/progress', async (original) => ({ ...(await original<typeof import('@/lib/api/tutor-loop/progress')>()), ...prog }))
vi.mock('@/lib/api/tutor-loop/schedule', async (original) => ({ ...(await original<typeof import('@/lib/api/tutor-loop/schedule')>()), ...sched }))
vi.mock('@/lib/api/tutor-loop/today', async (original) => ({ ...(await original<typeof import('@/lib/api/tutor-loop/today')>()), ...today }))
vi.mock('@/lib/api/tutor-loop/profile', async (original) => ({ ...(await original<typeof import('@/lib/api/tutor-loop/profile')>()), ...profile }))
vi.mock('@/lib/api/tutor-loop/client', async (original) => ({ ...(await original<typeof import('@/lib/api/tutor-loop/client')>()), tutorLoopClient: { entry } }))

import { ProgressTab } from '@/components/tutor-loop/progress/progress-tab'
import { TutorLoopApiError } from '@/lib/api/tutor-loop/client'

const onSchedule = vi.fn()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const progress = (): any => {
  const base = structuredClone(getTutorFixture('progress'))
  return {
    ...base,
    week: [{ date: '2026-11-10', minutes: 25, completedActivities: 2 }, { date: '2026-11-13', minutes: 10, completedActivities: 1 }],
    topics: [
      { ...base.topics[0]!, id: 'a', state: 'PRACTICING' }, { ...base.topics[0]!, id: 'b', state: 'SECURE' },
      { ...base.topics[0]!, id: 'c', state: 'NOT_STARTED' }, { ...base.topics[0]!, id: 'd', state: 'NOT_STARTED', archived: true },
    ],
  }
}
const show = (band: '14-17' | '18+' = '14-17') => {
  entry.mockResolvedValue({ band, scope: 'SCHOOL', needsOnboarding: false, needsConsent: false, tutorIdentity: null, capabilities: {} })
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ProgressTab onOpenSchedule={onSchedule} /></QueryClientProvider>)
}

beforeEach(() => {
  today.getTutorToday.mockResolvedValue({ ...getTutorFixture('today'), date: '2026-11-13', fixedWork: [] })
  sched.getTutorSchedule.mockResolvedValue({ from: '2026-11-09', to: '2026-11-15', timeZone: 'UTC', revision: 1, items: [], daysOff: [], unplacedMinutes: 0, warnings: [], pace: { state: 'BEHIND', requiredMinutes: 100, availableMinutes: 60, shortfallMinutes: 40 } })
  profile.getStudyPreferences.mockResolvedValue({ revision: 1, timeZone: 'UTC', studyDays: [1, 2, 3, 4, 5], minutesPerDay: 40 })
})
afterEach(() => { cleanup(); vi.resetAllMocks() })

it('shows measured readiness, the weekly chart with day names, topic counts and what needs practice', async () => {
  prog.getTutorProgress.mockResolvedValue(progress())
  show()
  const readiness = await screen.findByTestId('progress-readiness')
  expect(within(readiness).getByText('60%')).toBeInTheDocument()
  expect(within(readiness).getByText('Measured')).toBeInTheDocument()
  expect(within(readiness).getByTestId('readiness-line')).toHaveTextContent('60% ready · Measured on 1 of 1 topics')
  await waitFor(() => expect(within(readiness).getByTestId('pace-line')).toHaveTextContent('About 40 min behind your plan.'))
  const week = screen.getByTestId('progress-week')
  for (const name of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) expect(within(week).getByText(name)).toBeInTheDocument()
  expect(within(week).getByText('25 min')).toBeInTheDocument()
  expect(within(week).getAllByText('Planned')).toHaveLength(2)
  expect(within(week).getAllByTestId('week-bar')).toHaveLength(7)
  const topics = screen.getByTestId('progress-topics')
  expect(topics).toHaveTextContent('Not started1')
  expect(topics).toHaveTextContent('Secure1')
  expect(within(screen.getByTestId('progress-weak')).getByRole('link', { name: 'Practise Acids and bases' })).toBeInTheDocument()
})

it('says "not yet" instead of a percentage when there is not enough practice', async () => {
  const data = progress()
  data.readiness = { ...data.readiness!, percent: null, evidence: 'INSUFFICIENT', topicsCovered: 1, topicsTotal: 5 }
  prog.getTutorProgress.mockResolvedValue(data)
  show()
  const readiness = await screen.findByTestId('progress-readiness')
  expect(within(readiness).getByText('Not yet')).toBeInTheDocument()
  expect(within(readiness).getByTestId('readiness-line')).toHaveTextContent('Not enough practice yet — 1 of 5 topics')
  expect(within(readiness).queryByText(/% ready/)).toBeNull()
})

it('does not join readiness points across a changed topic list', async () => {
  const data = progress()
  const point = (date: string, blueprintRevision: string) => ({ date, blueprintRevision, percent: 50, topicsCovered: 1, topicsTotal: 2 })
  data.trend = [point('2026-11-01', 'v1'), point('2026-11-08', 'v1'), point('2026-11-13', 'v2')]
  prog.getTutorProgress.mockResolvedValue(data)
  show()
  const trend = await screen.findByTestId('readiness-trend')
  expect(trend.querySelectorAll('[title="Topic weights changed here"]')).toHaveLength(1)
})

it('downloads CSV for Teens', async () => {
  prog.getTutorProgress.mockResolvedValue(progress())
  prog.downloadProgressCsv.mockResolvedValue({ fileName: 'progress.csv' })
  show('14-17')
  expect(await screen.findByRole('button', { name: /Download CSV/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Download PDF/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Download CSV/ }))
  expect(await screen.findByText('progress.csv downloaded.')).toBeInTheDocument()
})

it('offers the PDF summary to Adults and reports a failed download kindly', async () => {
  prog.getTutorProgress.mockResolvedValue(progress())
  prog.downloadProgressPdf.mockRejectedValue(Object.assign(new Error('This download is available to verified adult accounts.'), { status: 403 }))
  show('18+')
  fireEvent.click(await screen.findByRole('button', { name: /Download PDF/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('verified adult')
})

it('falls back to what Today knows when the progress route is not available yet', async () => {
  prog.getTutorProgress.mockRejectedValue(new TutorLoopApiError(404, 'x', 'RESOURCE_NOT_FOUND'))
  show()
  expect(await screen.findByText(/full progress view is not available yet/)).toBeInTheDocument()
  expect(screen.getByTestId('progress-readiness')).toHaveTextContent('60%')
  expect(screen.getByText('Daily minutes will appear here soon.')).toBeInTheDocument()
})

it('shows an error with retry and sends the learner to the schedule', async () => {
  prog.getTutorProgress.mockRejectedValueOnce(new TutorLoopApiError(500, 'x')).mockResolvedValueOnce(progress())
  show()
  expect(await screen.findByRole('alert')).toHaveTextContent('Your progress could not be loaded')
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await waitFor(() => expect(screen.getByTestId('progress-schedule')).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Update my schedule' }))
  expect(onSchedule).toHaveBeenCalled()
})
