import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import type { TutorEntry } from '@/lib/api/tutor-loop/entry'

const actions = vi.hoisted(() => ({ grantConsent: vi.fn() }))
const router = vi.hoisted(() => ({ push: vi.fn() }))
const goals = vi.hoisted(() => ({
  createGoal: vi.fn(), getGoal: vi.fn(), updateGoal: vi.fn(), updateExam: vi.fn(), listAvailableMaterials: vi.fn(),
  startPlanDraft: vi.fn(), getPlanDraft: vi.fn(), cancelPlanDraft: vi.fn(), regeneratePlanDraft: vi.fn(), acceptPlanDraft: vi.fn(), createManualPlan: vi.fn(),
}))
const profile = vi.hoisted(() => ({ getTutorProfile: vi.fn(), updateTutorProfile: vi.fn(), getStudyPreferences: vi.fn(), previewStudyPreferences: vi.fn(), applySchedulePreview: vi.fn() }))
vi.mock('@/app/(tutor-start)/learn/start/actions', () => actions)
vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('@/lib/api/tutor-loop/goals', async (original) => ({ ...(await original<typeof import('@/lib/api/tutor-loop/goals')>()), ...goals }))
vi.mock('@/lib/api/tutor-loop/profile', async (original) => ({ ...(await original<typeof import('@/lib/api/tutor-loop/profile')>()), ...profile }))

import { TutorStartScreen } from '@/components/tutor-loop/start/start-screen'

const requestId = '10000000-0000-4000-8000-000000000001'
const capabilities = {
  canCreatePersonalPlan: true, canUseTutor: true, canUseMock: true, canUseMemory: false, findMaterial: 'HIDDEN',
} as const
const teen: TutorEntry = {
  band: '14-17', scope: 'SCHOOL', needsConsent: false, needsOnboarding: true,
  tutorIdentity: { name: 'Co', icon: 'SPROUT' }, capabilities,
}
const adult: TutorEntry = { ...teen, band: '18+', scope: 'PERSONAL', tutorIdentity: { name: 'Co', icon: 'BUDDY' } }
afterEach(() => { cleanup(); vi.resetAllMocks() })
const renderStart = (entry: TutorEntry, startGoal = true) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <TutorStartScreen entry={entry} name="Sara" requestId={requestId} startGoal={startGoal} />
  </QueryClientProvider>,
)
const apiError = (status: number, code: string) => Object.assign(new Error(code), { status, code })
const savedGoal = {
  id: '20000000-0000-4000-8000-000000000001', title: 'AWS certification', kind: 'EXAM', dueDate: null, status: 'ACTIVE', position: 0,
  source: 'LEARNER', revision: 1, topics: [],
  exam: { id: '20000000-0000-4000-8000-000000000002', goalId: '20000000-0000-4000-8000-000000000001', title: 'AWS certification', date: null, passMarkPercent: 72, revision: 1 },
}
async function throughSteps() {
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Exam' }), { target: { value: 'AWS certification' } })
  fireEvent.change(screen.getByRole('spinbutton', { name: /Pass mark/ }), { target: { value: '72' } })
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  expect(await screen.findByText('How much time a day?')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('radio', { name: '60 min' }))
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  expect(await screen.findByText('What will you learn from?')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  expect(await screen.findByText('Last thing: make me yours.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('radio', { name: /Detailed/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Make my plan' }))
}


it('continues returning Teens to learning and opens the goal flow for new learners', () => {
  const { rerender } = render(<TutorStartScreen entry={teen} name="Rohan" requestId={requestId} startGoal={false} />)
  expect(screen.getByRole('heading', { name: 'Welcome back, Rohan' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Continue' })).toHaveAttribute('href', '/learn/start?step=goal')
  rerender(<TutorStartScreen entry={{ ...teen, needsOnboarding: false }} name="Rohan" requestId={requestId} startGoal={false} />)
  expect(screen.getByRole('link', { name: 'Continue' })).toHaveAttribute('href', '/learn/home')
})

it('asks for explicit Adult consent before opening goal setup', async () => {
  actions.grantConsent.mockResolvedValue({})
  renderStart({ ...adult, needsConsent: true })
  expect(screen.queryByRole('heading', { name: 'What are you working towards?' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('checkbox', { name: 'I agree to save my goals and progress in this workspace.' }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  await waitFor(() => expect(actions.grantConsent).toHaveBeenCalledOnce())
  const form = actions.grantConsent.mock.calls[0]![1] as FormData
  expect(form.get('accept')).toBe('yes')
  expect(form.get('requestId')).toBe(requestId)
})

it('keeps Adult exam details in place after a failed save', async () => {
  goals.createGoal.mockRejectedValue(apiError(503, 'TUTOR_UNAVAILABLE'))
  renderStart(adult)
  expect(screen.queryByRole('button', { name: 'Keep up with school' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Exam' }), { target: { value: 'AWS certification' } })
  fireEvent.change(screen.getByRole('spinbutton', { name: /Pass mark/ }), { target: { value: '72' } })
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Your goal could not be saved')
  expect(screen.getByRole('textbox', { name: 'Exam' })).toHaveValue('AWS certification')
  expect(screen.getByRole('spinbutton', { name: /Pass mark/ })).toHaveValue(72)
})

it('shows Co is resting and builds a plan by hand when drafting is unavailable', async () => {
  goals.createGoal.mockResolvedValue(savedGoal)
  goals.listAvailableMaterials.mockResolvedValue([])
  profile.getTutorProfile.mockResolvedValue({ revision: 3 })
  profile.updateTutorProfile.mockResolvedValue({})
  profile.getStudyPreferences.mockRejectedValue(apiError(404, 'RESOURCE_NOT_FOUND'))
  goals.startPlanDraft.mockRejectedValue(apiError(503, 'AI_UNAVAILABLE'))
  goals.createManualPlan.mockResolvedValue({ id: 'p', title: 'AWS certification plan', ownership: 'OWN', state: 'ACTIVE', revision: 1, goalIds: [savedGoal.id], phases: [] })
  renderStart(adult)
  await throughSteps()
  await waitFor(() => expect(profile.updateTutorProfile).toHaveBeenCalledWith(expect.objectContaining({ revision: 3, style: 'DETAILED' }), { workspace: 'personal' }))
  expect(await screen.findByText('Co is resting')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Make my plan by hand' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Topic 1' }), { target: { value: 'IAM policies' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save my plan' }))
  await waitFor(() => expect(goals.createManualPlan).toHaveBeenCalledOnce())
  expect(goals.createManualPlan.mock.calls[0]![0]).toMatchObject({ goalId: savedGoal.id, phases: [{ topics: [{ title: 'IAM policies', basis: 'MANUAL' }] }] })
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/workspaces'))
})

it('polls a drafted plan, shows it and accepts it against the current goal revision', async () => {
  goals.createGoal.mockResolvedValue(savedGoal)
  goals.getGoal.mockResolvedValue({ ...savedGoal, revision: 2 })
  goals.listAvailableMaterials.mockResolvedValue([])
  profile.getTutorProfile.mockResolvedValue({ revision: 1 })
  profile.updateTutorProfile.mockResolvedValue({})
  profile.getStudyPreferences.mockRejectedValue(apiError(404, 'RESOURCE_NOT_FOUND'))
  goals.startPlanDraft.mockResolvedValue({ id: 'job', lineageId: 'job', version: 1, status: 'QUEUED', draft: null, reasonCode: null, retryable: false })
  goals.getPlanDraft.mockResolvedValue({
    id: 'job', lineageId: 'job', version: 1, status: 'READY', reasonCode: null, retryable: false,
    draft: { title: 'Plan', phases: [{ title: 'Security', topics: [{ title: 'IAM policies', estimateMin: 45, priority: 3, basis: 'SYLLABUS', materialIds: [] }] }] },
  })
  goals.acceptPlanDraft.mockResolvedValue({})
  renderStart(adult)
  await throughSteps()
  expect(await screen.findByRole('heading', { name: 'Here’s your plan' })).toBeInTheDocument()
  expect(screen.getByTestId('plan-totals')).toHaveTextContent('1 topics · about 45 min')
  fireEvent.click(screen.getByRole('button', { name: 'Start this plan' }))
  await waitFor(() => expect(goals.acceptPlanDraft).toHaveBeenCalledOnce())
  expect(goals.acceptPlanDraft.mock.calls[0]![1]).toMatchObject({ goalRevision: 2 })
})
