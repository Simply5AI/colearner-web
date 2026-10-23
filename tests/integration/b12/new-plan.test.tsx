import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
const holder = vi.hoisted(() => ({ request: (() => Promise.reject(new Error('unset'))) as (...args: unknown[]) => Promise<unknown> }))
vi.mock('@/components/teacher/teaching-context', () => { const value = { schoolId: 'school-1', schoolName: 'Green Valley', request: (...args: unknown[]) => holder.request(...args) }; return { useTeaching: () => value, TeachingProvider: ({ children }: { children: React.ReactNode }) => children } })
import { NewPlanOptions } from '@/components/teacher/plans/new-plan-options'
import { TeachingApiError } from '@/lib/api/teaching/core'
import { createMockTeaching, renderWithQuery, requestFor } from './w2-helpers'

let log: { suffix: string; method: string; body: unknown; headers?: Record<string, string> }[] = []
function mount(state = 'default', onCreated = vi.fn()) {
  log = []; const server = createMockTeaching(state); holder.request = requestFor(server, log) as typeof holder.request
  renderWithQuery(<NewPlanOptions onCreated={onCreated} />); return { server, onCreated }
}
beforeEach(() => vi.clearAllMocks()); afterEach(() => cleanup())

it('offers three ways to start and shows Co drafting as disabled with the server reason', async () => {
  mount()
  expect(await screen.findByTestId('tile-scratch')).toBeVisible(); expect(screen.getByTestId('tile-source')).toBeVisible()
  const co = screen.getByTestId('tile-co')
  expect(co).toHaveAttribute('aria-disabled', 'true'); expect(screen.getByTestId('co-unavailable')).toHaveTextContent('Unavailable'); expect(screen.getByTestId('co-reason')).toHaveTextContent('Co drafting for teachers is not available yet.')
  expect(co.querySelector('input')).toBeNull()
  expect(screen.queryByRole('status', { name: /generating/i })).toBeNull(); expect(document.body.textContent).not.toMatch(/Co is (generating|drafting|working)/i)
})
it('defaults the band from the grade and notes a mismatch without blocking', async () => {
  mount()
  const band = await screen.findByTestId('field-band') as HTMLSelectElement
  expect(band.value).toBe('10-13')
  fireEvent.change(band, { target: { value: '6-9' } })
  expect(await screen.findByTestId('band-mismatch')).toHaveTextContent('nothing is blocked')
  expect(screen.getByTestId('create-plan')).toBeEnabled()
  fireEvent.change(screen.getByTestId('field-class'), { target: { value: 'class-3a' } })
  expect((screen.getByTestId('field-band') as HTMLSelectElement).value).toBe('6-9')
})
it('disables the curriculum choice with its reason when it is not loaded; the outline is always available', async () => {
  mount()
  fireEvent.click(await screen.findByTestId('tile-source'))
  fireEvent.change(screen.getByTestId('field-subject'), { target: { value: 'Science' } })
  expect(await screen.findByTestId('source-curriculum')).toBeDisabled()
  expect(screen.getByTestId('curriculum-reason')).toHaveTextContent('not loaded')
  expect(screen.getByTestId('source-outline')).toBeEnabled(); expect(screen.getByLabelText('Outline')).toBeVisible()
})
it('names the offending outline line and does not call the server', async () => {
  mount()
  fireEvent.click(await screen.findByTestId('tile-source'))
  fireEvent.change(screen.getByLabelText('Plan title'), { target: { value: 'My plan' } })
  fireEvent.change(screen.getByLabelText('Outline'), { target: { value: '  - topic without a phase' } })
  fireEvent.click(screen.getByTestId('create-plan'))
  expect(await screen.findByTestId('outline-error')).toHaveTextContent('Line 1')
  expect(log.some(entry => entry.method === 'POST')).toBe(false)
})
it('creates a plan from an outline with a key and calls onCreated with the draft plan', async () => {
  const { onCreated } = mount()
  fireEvent.click(await screen.findByTestId('tile-source'))
  fireEvent.change(screen.getByLabelText('Plan title'), { target: { value: 'Outlined' } })
  fireEvent.change(screen.getByLabelText('Outline'), { target: { value: 'Fractions\n  - Parts\n  - Adding\nDecimals' } })
  fireEvent.click(screen.getByTestId('create-plan'))
  await waitFor(() => expect(onCreated).toHaveBeenCalledOnce())
  const plan = onCreated.mock.calls[0]![0]
  expect(plan.status).toBe('DRAFT'); expect(plan.tree).toHaveLength(2); expect(plan.tree[0].children).toHaveLength(2)
  const post = log.find(entry => entry.method === 'POST')!; expect(post.headers?.['Idempotency-Key']).toBeTruthy()
  expect(post.body).toMatchObject({ classId: 'class-6a', subject: 'Mathematics', targetBand: '10-13', source: { kind: 'OUTLINE' } })
})
it('a failed create keeps every field and a retry reuses one Idempotency-Key', async () => {
  const { onCreated, server } = mount()
  const real = holder.request; let first = true
  holder.request = (async (...args: unknown[]) => { if (args[1] === 'POST' && first) { first = false; throw new TeachingApiError(503, 'The teaching service is unavailable.') } return real(...args) }) as typeof holder.request
  fireEvent.change(await screen.findByLabelText('Plan title'), { target: { value: 'Keep me' } })
  fireEvent.click(screen.getByTestId('create-plan'))
  expect(await screen.findByTestId('new-plan-failure')).toBeVisible()
  expect(screen.getByLabelText('Plan title')).toHaveValue('Keep me'); expect(onCreated).not.toHaveBeenCalled()
  fireEvent.click(screen.getByTestId('create-plan'))
  await waitFor(() => expect(onCreated).toHaveBeenCalledOnce())
  expect([...server.plans.values()].filter(plan => plan.title === 'Keep me')).toHaveLength(1)
})
it('shows the no class state and the unavailable state with retry', async () => {
  mount('no-class'); expect(await screen.findByTestId('new-plan-no-class')).toBeVisible()
  cleanup(); mount('unavailable'); expect(await screen.findByTestId('new-plan-error')).toBeVisible(); expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible()
})
