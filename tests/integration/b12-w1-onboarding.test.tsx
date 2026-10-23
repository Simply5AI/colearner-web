import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TeachingProvider, useTeaching } from '@/components/teacher/teaching-context'
import { TeacherOnboardingView } from '@/components/teacher/onboarding/onboarding-flow'
import { createOnboardingMock, type OnboardingMockOptions } from '@/components/teacher/onboarding/dev/onboarding-mock'

vi.mock('@/components/teacher/teacher-page', () => ({
  TeacherPage: ({ title, children }: { title: string; children: React.ReactNode }) => <main><h1>{title}</h1>{children}</main>,
}))
// W2 components are stubs here; their own suites cover them. Each stub calls back only after the mock server answered.
vi.mock('@/components/teacher/plans/new-plan-options', () => ({
  NewPlanOptions: ({ onCreated }: { onCreated: (plan: unknown) => void }) => {
    const { request } = useTeaching()
    return <button type="button" onClick={() => void request('/plans', 'POST', { title: 'Class 6 Fractions' }, { 'Idempotency-Key': 'key-12345678' }).then(onCreated)}>Stub create plan</button>
  },
}))
vi.mock('@/components/teacher/plans/assign-class-panel', () => ({
  AssignClassPanel: ({ planId, onAssigned }: { planId: string; onAssigned: (a: unknown) => void }) => {
    const { request } = useTeaching()
    return <button type="button" onClick={() => void request(`/plans/${planId}/assignments`, 'POST', { classId: 'class-6a' }).then(onAssigned, () => undefined)}>Stub assign</button>
  },
}))

function renderOnboarding(options: OnboardingMockOptions) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const mock = createOnboardingMock(options)
  render(
    <QueryClientProvider client={client}>
      <TeachingProvider schoolId="school-fixture" schoolName="Fixture Public School" requestImpl={mock.request}>
        <TeacherOnboardingView />
      </TeachingProvider>
    </QueryClientProvider>,
  )
  return mock
}

const current = () => screen.getByTestId('t8-progress').querySelector('[aria-current="step"]')

describe('T8 teacher onboarding', () => {
  it('starts at Profile with five steps, one tip, and no skip button (F-T8-05)', async () => {
    renderOnboarding({ state: 'profile' })
    expect(await screen.findByTestId('t8-profile-form')).toBeInTheDocument()
    expect(within(screen.getByTestId('t8-progress')).getAllByRole('listitem')).toHaveLength(5)
    expect(current()).toHaveTextContent('Profile')
    expect(screen.getByTestId('t8-tip')).toBeInTheDocument()
    expect(screen.queryByTestId('t8-skip')).toBeNull()
  })

  it('validates the profile before any request and keeps what was typed', async () => {
    const mock = renderOnboarding({ state: 'profile' })
    fireEvent.click(await screen.findByRole('button', { name: 'Save and continue' }))
    expect(await screen.findByText('Enter the name students will see.')).toBeInTheDocument()
    expect(screen.getByText('Add at least one subject you teach.')).toBeInTheDocument()
    expect(mock.store.current.revision).toBe(1)
  })

  it('saves the profile and moves to First plan (F-T8-01)', async () => {
    const mock = renderOnboarding({ state: 'profile' })
    fireEvent.change(await screen.findByLabelText('Name students will see'), { target: { value: 'Daniel Okafor' } })
    fireEvent.change(screen.getByLabelText('Add a subject'), { target: { value: 'Mathematics' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    fireEvent.click(screen.getByLabelText('Grade 6'))
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    await waitFor(() => expect(current()).toHaveTextContent('First plan'))
    expect(mock.store.current.profile).toMatchObject({ displayName: 'Daniel Okafor', subjects: ['Mathematics'], grades: [6] })
    expect(mock.store.current.step).toBe('FIRST_PLAN')
  })

  it('a revision conflict keeps the draft and says so', async () => {
    renderOnboarding({ state: 'profile', conflict: true })
    fireEvent.change(await screen.findByLabelText('Name students will see'), { target: { value: 'Daniel' } })
    fireEvent.change(screen.getByLabelText('Add a subject'), { target: { value: 'Science' } })
    fireEvent.click(screen.getByLabelText('Grade 7'))
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    expect(await screen.findByTestId('t8-profile-failure')).toHaveTextContent('answers below are kept')
    expect(screen.getByLabelText('Name students will see')).toHaveValue('Daniel')
    expect(within(screen.getByTestId('t8-subjects')).getByText('Science')).toBeInTheDocument()
  })

  it('hides the photo field when storage is unavailable (F-T8-01)', async () => {
    renderOnboarding({ state: 'profile', photo: false })
    await screen.findByTestId('t8-profile-form')
    expect(screen.queryByTestId('t8-photo')).toBeNull()
  })

  it('shows the photo field when storage is available', async () => {
    renderOnboarding({ state: 'profile', photo: true })
    expect(await screen.findByTestId('t8-photo')).toBeInTheDocument()
  })

  it('creates the first plan through the shared options and then continues (F-T8-03)', async () => {
    renderOnboarding({ state: 'first-plan' })
    fireEvent.click(await screen.findByRole('button', { name: 'Stub create plan' }))
    const saved = await screen.findByTestId('t8-first-plan-saved')
    expect(saved).toHaveTextContent('Class 6 Fractions')
    expect(saved).toHaveTextContent('Draft')
    fireEvent.click(within(saved).getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(current()).toHaveTextContent('Material'))
  })

  it('no class: explains and does not offer plan creation', async () => {
    renderOnboarding({ state: 'no-class' })
    expect(await screen.findByTestId('t8-no-class')).toHaveTextContent('No class is assigned')
    expect(screen.queryByRole('button', { name: 'Stub create plan' })).toBeNull()
  })

  it('Material step can be skipped and Invite can be skipped; other steps have no skip (F-T8-05)', async () => {
    renderOnboarding({ state: 'material' })
    expect(await screen.findByTestId('t8-material')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('t8-skip'))
    await waitFor(() => expect(current()).toHaveTextContent('Students'))
    expect(screen.getByTestId('t8-skipped')).toHaveTextContent('material')
    fireEvent.click(screen.getByTestId('t8-skip'))
    await waitFor(() => expect(current()).toHaveTextContent('Done'))
    expect(screen.queryByTestId('t8-skip')).toBeNull()
  })

  it('adds a link as material and unlocks Continue', async () => {
    const mock = renderOnboarding({ state: 'material' })
    const form = await screen.findByTestId('t8-material')
    expect(within(form).getByRole('button', { name: 'Continue' })).toBeDisabled()
    fireEvent.click(within(form).getByRole('button', { name: 'Add a link' }))
    fireEvent.change(within(form).getByLabelText('Title'), { target: { value: 'Fractions video' } })
    fireEvent.change(within(form).getByLabelText('Link (https)'), { target: { value: 'http://insecure.example' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Add material' }))
    expect(await screen.findByTestId('t8-material-error')).toHaveTextContent('https://')
    fireEvent.change(within(form).getByLabelText('Link (https)'), { target: { value: 'https://example.org/fractions' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Add material' }))
    expect(await screen.findByTestId('t8-material-added')).toHaveTextContent('Fractions video')
    expect(mock.store.current.hasMaterial).toBe(true)
    fireEvent.click(within(form).getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(current()).toHaveTextContent('Students'))
  })

  it('a failed material add keeps the entry', async () => {
    renderOnboarding({ state: 'material', materialFail: true })
    const form = await screen.findByTestId('t8-material')
    fireEvent.click(within(form).getByRole('button', { name: 'Add a link' }))
    fireEvent.change(within(form).getByLabelText('Title'), { target: { value: 'Kept title' } })
    fireEvent.change(within(form).getByLabelText('Link (https)'), { target: { value: 'https://example.org/a' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Add material' }))
    expect(await screen.findByTestId('t8-material-error')).toHaveTextContent('kept')
    expect(within(form).getByLabelText('Title')).toHaveValue('Kept title')
    expect(screen.queryByTestId('t8-material-added')).toBeNull()
  })

  it('Invite asks for a published plan first; assign only after publish; reports pending approval (F-T8-04, F-T8-06)', async () => {
    renderOnboarding({ state: 'invite-draft' })
    expect(await screen.findByTestId('t8-invite-needs-publish')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Stub assign' })).toBeNull()
    expect(screen.getByTestId('t8-invite-later')).toHaveTextContent('Invite codes, links and QR codes arrive in a later release')
  })

  it('Invite with a published plan assigns and shows pending-approval counts', async () => {
    renderOnboarding({ state: 'invite' })
    expect(await screen.findByTestId('t8-roster-count')).toHaveTextContent('28')
    fireEvent.click(screen.getByRole('button', { name: 'Stub assign' }))
    expect(await screen.findByTestId('t8-assign-summary')).toHaveTextContent('24 waiting for guardian approval')
  })

  it('a failed assignment announces nothing', async () => {
    renderOnboarding({ state: 'invite', assignFail: true })
    fireEvent.click(await screen.findByRole('button', { name: 'Stub assign' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Stub assign' })).toBeInTheDocument())
    expect(screen.queryByTestId('t8-assign-summary')).toBeNull()
  })

  it.each([
    ['done-not-published', 'Your plan is saved as a draft'],
    ['done-published', 'Published. Students will see it once you assign it to a class'],
    ['done-pending', 'Assigned. Students appear once their guardians approve'],
    ['done-live', 'Your plan is live'],
  ])('Done copy for %s (F-T8-06)', async (state, title) => {
    renderOnboarding({ state })
    expect(await screen.findByTestId('t8-done-title')).toHaveTextContent(title)
  })

  it('Finish setup completes once and then links onward', async () => {
    const mock = renderOnboarding({ state: 'done-pending' })
    fireEvent.click(await screen.findByRole('button', { name: 'Finish setup' }))
    expect(await screen.findByRole('link', { name: 'Go to dashboard' })).toHaveAttribute('href', '/teacher/dashboard')
    expect(mock.store.current.completed).toBe(true)
    expect(screen.getByTestId('t8-done-title')).toHaveTextContent('Assigned. Students appear once their guardians approve')
  })

  it('resumes at the saved step and does not unlock later steps', async () => {
    renderOnboarding({ state: 'material' })
    await screen.findByTestId('t8-material')
    expect(current()).toHaveTextContent('Material')
    const steps = within(screen.getByTestId('t8-progress')).getAllByRole('button')
    expect(steps[0]).toBeEnabled()
    expect(steps[3]).toBeDisabled()
    expect(steps[4]).toBeDisabled()
  })

  it.each([
    ['denied', 'Teaching access denied'],
    ['unavailable', 'The teaching workspace is unavailable'],
    ['malformed', 'This did not load'],
  ])('%s renders its own panel', async (state, title) => {
    renderOnboarding({ state })
    expect(await screen.findByTestId('t8-failure')).toHaveTextContent(title)
  })

  it('retry recovers after one failed load', async () => {
    renderOnboarding({ state: 'retry' })
    fireEvent.click(within(await screen.findByTestId('t8-failure')).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByTestId('t8-root')).toBeInTheDocument()
  })
})
