import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

const profileApi = vi.hoisted(() => ({ getTutorProfile: vi.fn(), updateTutorProfile: vi.fn(), getStudyPreferences: vi.fn(), previewStudyPreferences: vi.fn(), applySchedulePreview: vi.fn(), getTutorMemory: vi.fn() }))
const goalsApi = vi.hoisted(() => ({ listGoals: vi.fn(), createGoal: vi.fn(), startPlanDraft: vi.fn() }))
const entry = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('next-auth/react', () => ({ signOut: vi.fn() }))
vi.mock('@/lib/api/tutor-loop/profile', async (original) => ({ ...(await original<typeof import('@/lib/api/tutor-loop/profile')>()), ...profileApi }))
vi.mock('@/lib/api/tutor-loop/goals', async (original) => ({ ...(await original<typeof import('@/lib/api/tutor-loop/goals')>()), ...goalsApi }))
vi.mock('@/lib/api/tutor-loop/client', async (original) => ({ ...(await original<typeof import('@/lib/api/tutor-loop/client')>()), tutorLoopClient: { entry } }))

import { MeArea } from '@/components/tutor-loop/me/me-area'

const profile = {
  revision: 4, name: 'Co', icon: 'SPROUT', style: 'FRIENDLY', presence: 'AVAILABLE', nudgesEnabled: true, pinnedActions: [],
  memoryOptIn: false, generalOptOut: false, accessibility: { textScale: 'NORMAL', easyRead: false, reducedMotion: false, readAloud: false },
}
const show = (initialSection: 'tutor' | 'access' | 'goal' | 'notes', band: '14-17' | '18+' = '18+') => {
  entry.mockResolvedValue({ band, scope: band === '18+' ? 'PERSONAL' : 'SCHOOL', needsOnboarding: false, needsConsent: false, tutorIdentity: null, capabilities: {} })
  profileApi.getTutorProfile.mockResolvedValue(profile)
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><MeArea initialSection={initialSection} /></QueryClientProvider>)
}
afterEach(() => { cleanup(); vi.resetAllMocks(); document.documentElement.removeAttribute('data-tutor-text-scale') })

it('saves a validated tutor name against the current profile revision', async () => {
  profileApi.updateTutorProfile.mockResolvedValue({ ...profile, name: 'Sage', revision: 5 })
  show('tutor')
  const input = await screen.findByRole('textbox', { name: /tutor’s name/i })
  fireEvent.change(input, { target: { value: 'Teacher' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save name' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Try a different name')
  expect(profileApi.updateTutorProfile).not.toHaveBeenCalled()
  fireEvent.change(input, { target: { value: 'Sage' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save name' }))
  await waitFor(() => expect(profileApi.updateTutorProfile).toHaveBeenCalledWith({ name: 'Sage', revision: 4 }, { workspace: 'school' }))
})

it('applies text size to the page as soon as it is saved', async () => {
  profileApi.updateTutorProfile.mockResolvedValue({ ...profile, revision: 5, accessibility: { ...profile.accessibility, textScale: 'LARGE' } })
  show('access')
  fireEvent.click(await screen.findByRole('radio', { name: 'Large text size' }))
  await waitFor(() => expect(document.documentElement.getAttribute('data-tutor-text-scale')).toBe('large'))
  expect(profileApi.updateTutorProfile).toHaveBeenCalledWith({ accessibility: { textScale: 'LARGE' }, revision: 4 }, { workspace: 'school' })
})

it('adds a goal and moves on to plan drafting', async () => {
  goalsApi.listGoals.mockResolvedValue({ items: [], nextCursor: null })
  goalsApi.createGoal.mockResolvedValue({ id: 'g1', title: 'Networking assignment', kind: 'ASSIGNMENT', dueDate: '2099-11-20', status: 'ACTIVE', position: 0, source: 'LEARNER', revision: 1, exam: null, topics: [] })
  goalsApi.startPlanDraft.mockReturnValue(new Promise(() => undefined))
  show('goal')
  fireEvent.click(await screen.findByRole('button', { name: /Add a goal/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Assignment' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Networking assignment' } })
  fireEvent.change(screen.getByLabelText(/Due date/), { target: { value: '2099-11-20' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add goal' }))
  await waitFor(() => expect(goalsApi.createGoal).toHaveBeenCalledOnce())
  expect(goalsApi.createGoal.mock.calls[0]![0]).toMatchObject({ kind: 'ASSIGNMENT', dueDate: '2099-11-20', title: 'Networking assignment' })
  expect(await screen.findByText('Making your plan…')).toBeInTheDocument()
})

it('shows the parent visibility line for Teens and keeps memory off by default', async () => {
  show('notes', '14-17')
  expect(await screen.findByText('Your parent can see these notes. Your school cannot.')).toBeInTheDocument()
  expect(screen.getByRole('switch', { name: 'Memory' })).toHaveAttribute('aria-checked', 'false')
})
