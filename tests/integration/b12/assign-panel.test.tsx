import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
const holder = vi.hoisted(() => ({ request: (() => Promise.reject(new Error('unset'))) as (...args: unknown[]) => Promise<unknown> }))
vi.mock('@/components/teacher/teaching-context', () => { const value = { schoolId: 'school-1', schoolName: 'Green Valley', request: (...args: unknown[]) => holder.request(...args) }; return { useTeaching: () => value, TeachingProvider: ({ children }: { children: React.ReactNode }) => children } })
import { AssignClassPanel } from '@/components/teacher/plans/assign-class-panel'
import { createMockTeaching, renderWithQuery, requestFor } from './w2-helpers'

function mount(state = 'default', planId = 'plan-fractions', defaultClassId?: string) {
  const onAssigned = vi.fn(); const server = createMockTeaching(state); holder.request = requestFor(server) as typeof holder.request
  renderWithQuery(<AssignClassPanel planId={planId} defaultClassId={defaultClassId} onAssigned={onAssigned} />); return { onAssigned, server }
}
beforeEach(() => vi.clearAllMocks()); afterEach(() => cleanup())

it('refuses to assign a draft plan and says to publish first', async () => {
  mount('default', 'plan-algebra')
  expect(await screen.findByTestId('assign-blocked')).toHaveTextContent('Publish the plan before assigning')
  expect(screen.queryByTestId('assign-form')).toBeNull()
})
it('lists only classes the teacher teaches that subject to, then assigns with a roster summary', async () => {
  const { onAssigned } = mount()
  const picker = await screen.findByTestId('assign-class') as HTMLSelectElement
  expect([...picker.options].map(option => option.textContent)).toEqual(['CBSE · Class 6 A', 'CBSE · Class 6 B', 'CBSE · Class 3 A'])
  fireEvent.click(screen.getByTestId('assign-submit'))
  await waitFor(() => expect(onAssigned).toHaveBeenCalledOnce())
  const latest = await screen.findByTestId('assign-latest')
  expect(within(latest).getByTestId('roster-pending')).toHaveTextContent('19 waiting for guardian approval')
  expect(within(latest).getByTestId('roster-already')).toHaveTextContent('2 already had this plan')
  expect(within(latest).getByTestId('roster-skipped-no_account')).toHaveTextContent('3 not enrolled')
  expect(screen.getByTestId('assign-notice')).toHaveTextContent('Assigned to CBSE · Class 6 A.')
  expect(latest.textContent).not.toMatch(/\bnickname|displayName|date of birth/i)
})
it('shows an admin-created assignment as read-only with no unassign control', async () => {
  mount('admin-assignment')
  const rows = await screen.findAllByTestId('assignment-row')
  const admin = rows.find(row => row.getAttribute('data-source') === 'SCHOOL_ADMIN')!
  expect(within(admin).getByTestId('assignment-readonly')).toBeVisible(); expect(within(admin).queryByTestId('unassign')).toBeNull(); expect(within(admin).queryByTestId('sync-assignment')).toBeNull()
  expect(within(rows.find(row => row.getAttribute('data-source') === 'TEACHER')!).getByTestId('unassign')).toBeVisible()
})
it('unassign asks first, states revoked versus kept, and reports the exact counts from the server after', async () => {
  mount('assigned')
  fireEvent.click(await screen.findByTestId('unassign'))
  const confirm = await screen.findByTestId('unassign-confirm')
  expect(within(confirm).getByTestId('unassign-revoked')).toHaveTextContent('19 learners waiting for guardian approval')
  expect(within(confirm).getByTestId('unassign-retained')).toHaveTextContent('keep their work')
  fireEvent.click(screen.getByTestId('confirm-unassign'))
  await waitFor(() => expect(screen.getByTestId('assign-notice')).toHaveTextContent('Unassigned. 20 enrolments revoked and 1 kept'))
  expect(await screen.findByTestId('assign-empty')).toBeVisible()
})
it('shows unavailable with retry and denied without detail', async () => {
  mount('unavailable'); expect(await screen.findByTestId('assign-error')).toHaveTextContent('Nothing was changed'); expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible()
  cleanup(); mount('denied'); expect(await screen.findByTestId('assign-denied')).toBeVisible()
})
it('says when there is nowhere left to assign', async () => {
  mount()
  for (const classId of ['class-6a', 'class-6b', 'class-3a']) {
    fireEvent.change(await screen.findByTestId('assign-class'), { target: { value: classId } })
    fireEvent.click(screen.getByTestId('assign-submit'))
    await waitFor(() => expect(screen.getByTestId('assign-notice')).toHaveTextContent('Assigned to'))
    await waitFor(() => expect(screen.getAllByTestId('assignment-row').length).toBeGreaterThan(['class-6a', 'class-6b', 'class-3a'].indexOf(classId)))
  }
  await waitFor(() => expect(screen.getByTestId('assign-no-class')).toHaveTextContent('every class you teach'))
})
