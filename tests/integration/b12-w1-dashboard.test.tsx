import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TeachingProvider } from '@/components/teacher/teaching-context'
import { TeacherDashboardView } from '@/components/teacher/dashboard/dashboard-view'
import { createDashboardMock } from '@/components/teacher/dashboard/dev/dashboard-mock'

vi.mock('@/components/teacher/teacher-page', () => ({
  TeacherPage: ({ title, children }: { title: string; children: React.ReactNode }) => <main><h1>{title}</h1>{children}</main>,
}))
// W2 owns the panel and its tests; here it is a stub that reports success exactly as the real one does.
vi.mock('@/components/teacher/plans/assign-class-panel', () => ({
  AssignClassPanel: ({ planId, onAssigned }: { planId: string; onAssigned: (a: unknown) => void }) => (
    <button type="button" onClick={() => onAssigned({ id: 'a1', planId, classId: 'class-6a', classLabel: 'CBSE · Class 6 A', roster: { total: 28, enrolledActive: 0, pendingGuardian: 24, alreadyEnrolled: 0, skipped: [] } })}>Stub assign</button>
  ),
}))

function renderDashboard(options: Parameters<typeof createDashboardMock>[0]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const request = createDashboardMock(options)
  render(
    <QueryClientProvider client={client}>
      <TeachingProvider schoolId="school-fixture" schoolName="Fixture Public School" requestImpl={request}>
        <TeacherDashboardView />
      </TeachingProvider>
    </QueryClientProvider>,
  )
  return request as unknown as { calls: string[] }
}

describe('T1 teacher dashboard', () => {
  it('renders measured counts in their own panel, class chips and the school (F-T1-01, F-T1-07)', async () => {
    renderDashboard({ state: 'default' })
    expect(await screen.findByTestId('t1-root')).toHaveAttribute('data-state', 'ACTIVE')
    expect(screen.getByTestId('t1-school')).toHaveTextContent('Fixture Public School')
    expect(within(screen.getByTestId('t1-classes')).getAllByRole('listitem')).toHaveLength(2)
    const week = screen.getByTestId('t1-this-week')
    expect(within(week).getByTestId('t1-active')).toHaveTextContent('9 of 12')
    expect(within(week).getByTestId('t1-plans-published')).toHaveTextContent('2')
    expect(screen.getByTestId('t1-due')).toHaveTextContent('Equivalent fractions')
    // No AI text exists in B12, so nothing on the page is labelled as a Co draft.
    expect(screen.queryByText(/Co draft/i)).toBeNull()
  })

  it('shows insufficient data, never zero, below three active students', async () => {
    renderDashboard({ state: 'insufficient' })
    await screen.findByTestId('t1-progress')
    expect(screen.getAllByTestId('t1-progress-insufficient')).toHaveLength(2)
    expect(screen.queryByText(/^0%$/)).toBeNull()
  })

  it('renders honest later-release panels instead of zeros for deferred items (F-T1-03, F-T1-05)', async () => {
    renderDashboard({ state: 'default' })
    for (const id of ['t1-later-at-risk', 't1-later-worksheets', 't1-later-practice']) {
      const panel = await screen.findByTestId(id)
      expect(panel).toHaveTextContent('Arrives in a later release')
    }
    expect(screen.queryByText(/struggling with/i)).toBeNull()
  })

  it('new teacher: checklist with real links and a disabled Assign until a plan is published (F-T1-02, F-T1-06)', async () => {
    renderDashboard({ state: 'new-teacher' })
    expect(await screen.findByTestId('t1-new-teacher')).toBeInTheDocument()
    const checklist = screen.getByTestId('t1-checklist')
    expect(within(checklist).getByTestId('t1-check-CREATE_PLAN')).toHaveAttribute('data-done', 'false')
    expect(within(checklist).getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/teacher/plans/new')
    expect(screen.getByTestId('t1-action-lesson')).toBeDisabled()
    expect(screen.getByTestId('t1-action-assign')).toBeDisabled()
    expect(screen.getByTestId('t1-action-assign-reason')).toHaveTextContent('Publish a plan first.')
    expect(screen.getByTestId('t1-action-plan')).toHaveAttribute('href', '/teacher/plans/new')
  })

  it('draft ready lists only the teacher own drafts and links to the right workspace', async () => {
    renderDashboard({ state: 'draft-ready' })
    const drafts = await screen.findByTestId('t1-drafts')
    expect(drafts).toHaveTextContent('Written by you')
    expect(within(drafts).getByRole('link', { name: /Adding fractions/ })).toHaveAttribute('href', '/teacher/plans/plan-fractions/topics/topic-add')
    expect(screen.getByTestId('t1-action-lesson')).toHaveAttribute('href', '/teacher/plans/plan-fractions/topics/topic-add')
  })

  it('no class: explains, disables creating, and offers no invite codes (F-T1-07)', async () => {
    renderDashboard({ state: 'no-class' })
    expect(await screen.findByTestId('t1-no-class')).toHaveTextContent('No class is assigned to you yet')
    expect(screen.getByTestId('t1-action-plan')).toBeDisabled()
    expect(screen.getByTestId('t1-action-plan-reason')).toBeInTheDocument()
    expect(screen.queryByText(/invite code|QR/i)).toBeNull()
  })

  it('Assign to class opens the real panel for the published plan and announces only after success', async () => {
    renderDashboard({ state: 'default' })
    fireEvent.click(await screen.findByTestId('t1-action-assign'))
    expect(screen.queryByTestId('t1-assigned-note')).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: 'Stub assign' }))
    expect(await screen.findByTestId('t1-assigned-note')).toHaveTextContent('Assigned to CBSE · Class 6 A.')
  })

  it.each([
    ['denied', 'denied', 'Teaching access denied'],
    ['unavailable', 'unavailable', 'The teaching workspace is unavailable'],
    ['malformed', 'retry', 'This did not load'],
  ])('%s state renders its own panel', async (state, kind, title) => {
    renderDashboard({ state })
    const panel = await screen.findByTestId('t1-failure')
    expect(panel).toHaveAttribute('data-failure', kind)
    expect(panel).toHaveTextContent(title)
  })

  it('retry recovers after one failed load', async () => {
    renderDashboard({ state: 'retry' })
    const panel = await screen.findByTestId('t1-failure')
    fireEvent.click(within(panel).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.getByTestId('t1-root')).toBeInTheDocument())
  })

  it('shows a loading state while the request is pending', () => {
    renderDashboard({ state: 'loading' })
    expect(screen.getByTestId('t1-loading')).toBeInTheDocument()
  })
})
