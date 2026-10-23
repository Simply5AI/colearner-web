import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
const holder = vi.hoisted(() => ({ request: (() => Promise.reject(new Error('unset'))) as (...args: unknown[]) => Promise<unknown> }))
vi.mock('@/components/teacher/teaching-context', () => { const value = { schoolId: 'school-1', schoolName: 'Green Valley', request: (...args: unknown[]) => holder.request(...args) }; return { useTeaching: () => value, TeachingProvider: ({ children }: { children: React.ReactNode }) => children } })
import { PlanWorkspace } from '@/components/teacher/plans/plan-workspace'
import { createMockTeaching, renderWithQuery, requestFor } from './w2-helpers'

let log: { suffix: string; method: string; body: unknown; headers?: Record<string, string> }[] = []
function mount(plan: string, state = 'default', topic: string | null = null) {
  log = []; const server = createMockTeaching(state); holder.request = requestFor(server, log) as typeof holder.request
  renderWithQuery(<PlanWorkspace planId={plan} initialTopicId={topic} />); return { server }
}
const order = () => screen.getAllByTestId('tree-node').map(node => node.getAttribute('data-node-id'))
beforeEach(() => vi.clearAllMocks()); afterEach(() => cleanup())

it('a published plan is read-only: reason shown, no drag handles, no structure controls, and it says nobody can see it yet', async () => {
  mount('plan-fractions')
  expect(await screen.findByTestId('tree-locked')).toHaveTextContent('fixed')
  expect(screen.queryAllByTestId('tree-handle')).toHaveLength(0); expect(screen.queryByTestId('tree-actions')).toBeNull()
  expect(screen.getByTestId('student-visibility')).toHaveAttribute('data-state', 'PUBLISHED_NOT_ASSIGNED')
  expect(screen.getByTestId('student-visibility')).toHaveTextContent('students cannot see it until you assign it')
  expect(screen.getByTestId('open-assign')).toBeVisible(); expect(screen.getByTestId('unpublish')).toBeVisible(); expect(screen.queryByTestId('review-publish')).toBeNull()
})
it('moving a topic saves the tree with the revision and a key, and shows the new order', async () => {
  mount('plan-algebra')
  fireEvent.click(await screen.findByRole('button', { name: 'Move Topic: Simple equations up' }))
  await waitFor(() => expect(order()).toEqual(['a-phase-1', 'a-topic-2', 'a-topic-1', 'a-phase-2']))
  const put = log.find(entry => entry.method === 'PUT' && entry.suffix.endsWith('/tree'))!
  expect(put.body).toMatchObject({ expectedRevision: 2 }); expect(put.headers?.['Idempotency-Key']).toBeTruthy()
  expect(JSON.stringify(put.body)).not.toMatch(/counts|sortOrder|dueAt/)
  await waitFor(() => expect(screen.getByTestId('tree-announce')).toHaveTextContent('Moved Simple equations to position 1 of 2'))
})
it('a failed save restores the previous order and says so', async () => {
  mount('plan-algebra', 'tree-fail')
  fireEvent.click(await screen.findByRole('button', { name: 'Move Topic: Variables down' }))
  expect(await screen.findByTestId('plan-failure')).toHaveTextContent('previous order was restored')
  expect(order()).toEqual(['a-phase-1', 'a-topic-1', 'a-topic-2', 'a-phase-2'])
})
it('another tab changed the plan: a revision conflict is a reload prompt, not a lost edit', async () => {
  const { server } = mount('plan-algebra')
  await screen.findByTestId('plan-workspace'); server.plans.get('plan-algebra')!.revision += 5
  fireEvent.click(screen.getByRole('button', { name: 'Move Topic: Variables down' }))
  expect(await screen.findByTestId('plan-conflict')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Reload the latest' }))
  await waitFor(() => expect(screen.queryByTestId('plan-conflict')).toBeNull())
})
it('removing a topic that has material sends its id for confirmation', async () => {
  const { server } = mount('plan-fractions')
  await screen.findByTestId('plan-workspace')
  const result = server.handle('POST', '/plans/plan-fractions/unpublish', new URLSearchParams(), { expectedRevision: 4 }, { 'Idempotency-Key': 'k-12345678' })
  expect(result.status).toBe(200)
  cleanup(); log.length = 0; holder.request = requestFor(server, log) as typeof holder.request
  renderWithQuery(<PlanWorkspace planId="plan-fractions" initialTopicId={null} />)
  fireEvent.click((await screen.findAllByTestId('tree-node')).find(node => node.getAttribute('data-node-id') === 'topic-add')!.querySelector('button[aria-current], button:not([aria-label^="Move"]):not([aria-label^="Reorder"])')!)
  fireEvent.click(await screen.findByRole('button', { name: 'Remove' }))
  expect(await screen.findByTestId('tree-confirm-remove')).toHaveTextContent('materials, questions or a lesson')
  fireEvent.click(within(screen.getByTestId('tree-confirm-remove')).getByRole('button', { name: 'Remove' }))
  await waitFor(() => expect(log.some(entry => entry.method === 'PUT' && (entry.body as { confirmRemoveNodeIds?: string[] }).confirmRemoveNodeIds?.includes('topic-add'))).toBe(true))
})
it('review before publishing lists phases, topics and every issue; success is announced only after the answer', async () => {
  mount('plan-algebra')
  fireEvent.click(await screen.findByTestId('review-publish'))
  const dialog = await screen.findByTestId('publish-dialog')
  expect(within(dialog).getByTestId('review-tree')).toHaveTextContent('Variables')
  expect(within(dialog).getByTestId('issues-warning')).toHaveTextContent('no material or lesson yet')
  expect(within(dialog).queryByTestId('publish-success')).toBeNull()
  fireEvent.click(within(dialog).getByTestId('confirm-publish'))
  expect(await within(dialog).findByTestId('publish-success')).toHaveTextContent('structure is now fixed')
  await waitFor(() => expect(screen.getByTestId('plan-workspace')).toHaveAttribute('data-plan-status', 'PUBLISHED'))
  const call = log.find(entry => entry.suffix.endsWith('/publish'))!; expect(call.body).toEqual({ expectedRevision: 2 }); expect(call.headers?.['Idempotency-Key']).toBeTruthy()
})
it('a plan with no topics cannot be published: the error is listed and the button is disabled', async () => {
  const { server } = mount('plan-algebra')
  const plan = server.plans.get('plan-algebra')!; plan.tree = []
  cleanup(); renderWithQuery(<PlanWorkspace planId="plan-algebra" />)
  fireEvent.click(await screen.findByTestId('review-publish'))
  const dialog = await screen.findByTestId('publish-dialog')
  expect(within(dialog).getByTestId('issues-error')).toHaveTextContent('Add at least one topic')
  expect(within(dialog).getByTestId('confirm-publish')).toBeDisabled()
})
it('a failed publish keeps the draft and shows no success', async () => {
  mount('plan-algebra')
  const real = holder.request; holder.request = (async (...args: unknown[]) => { if (String(args[0]).endsWith('/publish')) throw Object.assign(new Error('x'), { status: 503, name: 'TeachingApiError' }); return real(...args) }) as typeof holder.request
  fireEvent.click(await screen.findByTestId('review-publish'))
  fireEvent.click(await screen.findByTestId('confirm-publish'))
  expect(await screen.findByTestId('publish-error')).toHaveTextContent('plan is unchanged')
  expect(screen.queryByTestId('publish-success')).toBeNull(); expect(screen.getByTestId('plan-workspace')).toHaveAttribute('data-plan-status', 'DRAFT')
})
it('taking a plan back to a draft is refused while it is in use, with the reason', async () => {
  mount('plan-fractions', 'assigned')
  fireEvent.click(await screen.findByTestId('unpublish'))
  fireEvent.click(await screen.findByTestId('confirm-lifecycle'))
  expect(await screen.findByTestId('plan-failure')).toHaveTextContent('cannot be taken back to a draft or archived')
  expect(screen.getByTestId('plan-workspace')).toHaveAttribute('data-plan-status', 'PUBLISHED')
})
it('denied and unavailable plans show a plain state', async () => {
  mount('someone-elses-plan'); expect(await screen.findByTestId('plan-denied')).toBeVisible(); cleanup()
  mount('plan-fractions', 'unavailable'); expect(await screen.findByTestId('plan-error')).toBeVisible()
})
