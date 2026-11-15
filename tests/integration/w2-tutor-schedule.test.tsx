import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getTutorFixture } from '@/lib/api/tutor-loop/fixtures'

const sched = vi.hoisted(() => ({ getTutorSchedule: vi.fn(), previewScheduleMove: vi.fn(), previewScheduleDayOff: vi.fn(), previewScheduleReplan: vi.fn(), applyScheduleChange: vi.fn(), downloadScheduleCalendar: vi.fn() }))
const today = vi.hoisted(() => ({ getTutorToday: vi.fn() }))
const profile = vi.hoisted(() => ({ getStudyPreferences: vi.fn() }))
const entry = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => '/learn/today', useSearchParams: () => new URLSearchParams() }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { name: 'Sara' } } }) }))
vi.mock('@/lib/api/tutor-loop/schedule', async (original) => ({ ...(await original<typeof import('@/lib/api/tutor-loop/schedule')>()), ...sched }))
vi.mock('@/lib/api/tutor-loop/today', async (original) => ({ ...(await original<typeof import('@/lib/api/tutor-loop/today')>()), ...today }))
vi.mock('@/lib/api/tutor-loop/profile', async (original) => ({ ...(await original<typeof import('@/lib/api/tutor-loop/profile')>()), ...profile }))
vi.mock('@/lib/api/tutor-loop/client', async (original) => ({ ...(await original<typeof import('@/lib/api/tutor-loop/client')>()), tutorLoopClient: { entry } }))

import { ScheduleTab } from '@/components/tutor-loop/schedule/schedule-tab'

type Item = { id: string; goalId: string | null; topicId: string | null; kind: string; sourceRef: string; originDate: string; date: string; estimatedMinutes: number; status: string; placement: string; title: string }
const item = (over: Partial<Item>): Item => ({ id: 'i1', goalId: 'g1', topicId: 't1', kind: 'PRACTICE', sourceRef: 't1', originDate: '2026-11-13', date: '2026-11-13', estimatedMinutes: 10, status: 'PLANNED', placement: 'AUTO', title: 'Acids and bases', ...over })
const week = (items: Item[], extra: Record<string, unknown> = {}) => ({
  from: '2026-11-09', to: '2026-11-15', timeZone: 'Asia/Dubai', revision: 2, items, daysOff: [], unplacedMinutes: 0, warnings: [],
  pace: { state: 'ON_TRACK', requiredMinutes: 100, availableMinutes: 160, shortfallMinutes: 0 }, ...extra,
})
const preview = (over: Record<string, unknown> = {}) => ({ id: 'p1', baseRevision: 2, expiresAt: '2026-11-13T09:15:00Z', canApply: true, changes: [], conflicts: [], unplacedMinutes: 0, ...over })
const show = (band: '14-17' | '18+' = '14-17') => {
  entry.mockResolvedValue({ band, scope: 'SCHOOL', needsOnboarding: false, needsConsent: false, tutorIdentity: null, capabilities: {} })
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ScheduleTab /></QueryClientProvider>)
}

beforeEach(() => {
  today.getTutorToday.mockResolvedValue({ ...getTutorFixture('today'), date: '2026-11-13' })
  profile.getStudyPreferences.mockResolvedValue({ revision: 1, timeZone: 'Asia/Dubai', studyDays: [1, 2, 3, 4, 5, 6], minutesPerDay: 40 })
})
afterEach(() => { cleanup(); vi.resetAllMocks() })

const day = (name: RegExp) => screen.getByRole('region', { name })

it('shows the week with day names, the range and today highlighted', async () => {
  sched.getTutorSchedule.mockResolvedValue(week([item({}), item({ id: 'i2', date: '2026-11-11', status: 'DONE', title: 'Salts' })]))
  show()
  expect(await screen.findByRole('heading', { name: 'This week' })).toBeInTheDocument()
  expect(screen.getByTestId('week-range')).toHaveTextContent('9 – 15 Nov')
  expect(screen.getByTestId('week-range')).toHaveTextContent('10 min of 20 min done')
  expect(day(/^Fri 13/)).toHaveAttribute('data-today', 'true')
  expect(within(day(/^Wed 11/)).getByText('Salts')).toBeInTheDocument()
  expect(within(day(/^Sun 15/)).getByText('Rest day')).toBeInTheDocument()
  expect(sched.getTutorSchedule).toHaveBeenCalledWith({ from: '2026-11-09', to: '2026-11-15' }, { workspace: 'school' })
})

it('previews the consequence before moving and applies against the preview revision', async () => {
  sched.getTutorSchedule.mockResolvedValue(week([item({})]))
  sched.previewScheduleMove.mockResolvedValue(preview({ changes: [{ itemId: 'i1', from: '2026-11-13', to: '2026-11-14', reasonCode: 'USER_MOVED' }] }))
  sched.applyScheduleChange.mockResolvedValue({ previewId: 'p1', revision: 3, appliedAt: '2026-11-13T09:00:00Z' })
  show()
  fireEvent.click(await screen.findByText('Acids and bases'))
  fireEvent.click(screen.getByRole('button', { name: 'Sat' }))
  await waitFor(() => expect(sched.previewScheduleMove).toHaveBeenCalledWith({ itemId: 'i1', date: '2026-11-14', baseRevision: 2 }, { workspace: 'school' }))
  expect(await screen.findByTestId('move-consequence')).toHaveTextContent('Sat gets about 10 min longer. Nothing else moves.')
  fireEvent.click(screen.getByRole('button', { name: 'Move' }))
  await waitFor(() => expect(sched.applyScheduleChange).toHaveBeenCalledWith('p1', expect.objectContaining({ baseRevision: 2, clientRequestId: expect.any(String) }), { workspace: 'school' }))
  expect(await screen.findByTestId('schedule-notice')).toHaveTextContent('Moved to Sat.')
  expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
})

it('explains a move that cannot be made and offers no Move button', async () => {
  sched.getTutorSchedule.mockResolvedValue(week([item({})]))
  sched.previewScheduleMove.mockResolvedValue(preview({ canApply: false, conflicts: [{ itemId: 'i1', reasonCode: 'SCHEDULE_FULL' }] }))
  show()
  fireEvent.click(await screen.findByText('Acids and bases'))
  fireEvent.click(screen.getByRole('button', { name: 'Sat' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('That day is already full.')
  expect(screen.queryByRole('button', { name: 'Move' })).toBeNull()
})

it('keeps teacher deadlines fixed and shows the stale-preview message on a conflict', async () => {
  sched.getTutorSchedule.mockResolvedValue(week([item({ id: 't', kind: 'TEACHER_DUE', placement: 'FIXED', title: 'Lab report', date: '2026-11-14' }), item({})]))
  const { TutorLoopApiError } = await import('@/lib/api/tutor-loop/client')
  sched.previewScheduleMove.mockRejectedValue(new TutorLoopApiError(409, 'x', 'PREVIEW_STALE'))
  show()
  fireEvent.click(await screen.findByText('Lab report'))
  expect(screen.getAllByText('Set by your teacher').length).toBeGreaterThan(0)
  expect(screen.queryByText('Move to')).toBeNull()
  fireEvent.click(screen.getByText('Acids and bases'))
  fireEvent.click(screen.getByRole('button', { name: 'Sat' }))
  expect(await screen.findByTestId('schedule-error')).toHaveTextContent('Your schedule has changed')
})

it('takes a day off with a preview of what moves', async () => {
  sched.getTutorSchedule.mockResolvedValue(week([item({ id: 'a', date: '2026-11-14', title: 'Salts' })]))
  sched.previewScheduleDayOff.mockResolvedValue(preview({ changes: [{ itemId: 'a', from: '2026-11-14', to: '2026-11-15', reasonCode: 'DAY_OFF' }] }))
  sched.applyScheduleChange.mockResolvedValue({ previewId: 'p1', revision: 3, appliedAt: 'x' })
  show()
  fireEvent.click(await screen.findByRole('button', { name: /Take a day off/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Take Sat off' }))
  await waitFor(() => expect(sched.previewScheduleDayOff).toHaveBeenCalledWith({ baseRevision: 2, startDate: '2026-11-14', endDate: '2026-11-14', dayOff: true }, { workspace: 'school' }))
  const panel = await screen.findByTestId('schedule-preview')
  expect(panel).toHaveTextContent('Sat off: 1 thing moves.')
  expect(panel).toHaveTextContent('1 thing · 10 min')
  fireEvent.click(within(panel).getByRole('button', { name: 'Take the day off' }))
  await waitFor(() => expect(sched.applyScheduleChange).toHaveBeenCalled())
  expect(await screen.findByTestId('schedule-notice')).toHaveTextContent('Sat is now a day off.')
})

it('replans when behind: shows the new plan against the old and lets the learner keep theirs', async () => {
  sched.getTutorSchedule.mockResolvedValue(week([item({}), item({ id: 'i3', title: 'Bases' })], { pace: { state: 'BEHIND', requiredMinutes: 200, availableMinutes: 160, shortfallMinutes: 40 } }))
  sched.previewScheduleReplan.mockResolvedValue(preview({ changes: [{ itemId: 'i3', from: '2026-11-13', to: '2026-11-15', reasonCode: 'REPLAN' }] }))
  show()
  expect(await screen.findByTestId('pace-behind')).toHaveTextContent('about 40 min short')
  fireEvent.click(screen.getByRole('button', { name: /I’m behind · replan/ }))
  const panel = await screen.findByTestId('schedule-preview')
  expect(sched.previewScheduleReplan).toHaveBeenCalledWith({ baseRevision: 2, reason: 'BEHIND' }, { workspace: 'school' })
  expect(panel).toHaveTextContent('2 things · 20 min')
  expect(panel).toHaveTextContent('1 thing · 10 min')
  expect(within(panel).getByRole('button', { name: 'Use new plan' })).toBeInTheDocument()
  fireEvent.click(within(panel).getByRole('button', { name: 'Keep mine' }))
  expect(screen.queryByTestId('schedule-preview')).toBeNull()
})

it('folds a crowded day to three items and expands it', async () => {
  sched.getTutorSchedule.mockResolvedValue(week(['a', 'b', 'c', 'd', 'e'].map((id) => item({ id, title: `Topic ${id}` }))))
  show()
  await screen.findByText('Topic a')
  expect(screen.queryByText('Topic e')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '+2 more' }))
  expect(screen.getByText('Topic e')).toBeInTheDocument()
})

it('shows a day off and reports fixed work on it', async () => {
  sched.getTutorSchedule.mockResolvedValue(week([], { daysOff: [{ id: 'd', startDate: '2026-11-14', endDate: '2026-11-14' }], warnings: [{ date: '2026-11-14', reasonCode: 'FIXED_ON_DAY_OFF', minutes: 15 }] }))
  show()
  expect(await within(await screen.findByRole('region', { name: /^Sat 14/ })).findByText('Day off')).toBeInTheDocument()
  expect(screen.getByText(/Your teacher set Sat 14 Nov/)).toBeInTheDocument()
})

it('offers the calendar file to adults only', async () => {
  sched.getTutorSchedule.mockResolvedValue(week([item({})]))
  sched.downloadScheduleCalendar.mockResolvedValue({ fileName: 'colearner-schedule.ics' })
  const view = show('14-17')
  await screen.findByRole('heading', { name: 'This week' })
  expect(screen.queryByRole('button', { name: 'Add to calendar' })).toBeNull()
  view.unmount()
  show('18+')
  fireEvent.click(await screen.findByRole('button', { name: 'Add to calendar' }))
  await waitFor(() => expect(sched.downloadScheduleCalendar).toHaveBeenCalledWith({ from: '2026-11-09', to: '2026-11-15' }))
})

it('shows the empty week, loading and an error with retry', async () => {
  sched.getTutorSchedule.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(week([]))
  show()
  expect(await screen.findByRole('alert')).toHaveTextContent('Your week could not be loaded')
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByTestId('schedule-empty')).toHaveTextContent('Nothing planned this week')
})

it('moves to the next week', async () => {
  sched.getTutorSchedule.mockResolvedValue(week([]))
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Next week' }))
  await waitFor(() => expect(sched.getTutorSchedule).toHaveBeenCalledWith({ from: '2026-11-16', to: '2026-11-22' }, { workspace: 'school' }))
})
