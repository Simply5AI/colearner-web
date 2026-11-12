import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
const holder = vi.hoisted(() => ({ request: (() => Promise.reject(new Error('unset'))) as (...args: unknown[]) => Promise<unknown> }))
vi.mock('@/components/teacher/teaching-context', () => { const value = { schoolId: 'school-1', schoolName: 'Green Valley', request: (...args: unknown[]) => holder.request(...args) }; return { useTeaching: () => value, TeachingProvider: ({ children }: { children: React.ReactNode }) => children } })
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
import { QuestionBankList } from '@/components/teacher/questions/question-bank-list'
import { createMockQuestions, renderWithQuery, requestFor, type LogEntry } from './b13-question-helpers'

let log: LogEntry[] = []
function mount(state = 'default', props: { initialPlanId?: string } = {}) {
  log = []; const server = createMockQuestions(state); holder.request = requestFor(server, log) as typeof holder.request
  renderWithQuery(<QuestionBankList {...props} />); return { server }
}
const listCalls = () => log.filter(entry => entry.suffix.startsWith('/questions?'))
const row = (id: string) => document.querySelector(`[data-question-id="${id}"]`) as HTMLElement
beforeEach(() => vi.clearAllMocks()); afterEach(() => cleanup())

it('lists questions with type, difficulty and source, and shows facet counts from the server', async () => {
  const { server } = mount()
  expect(await screen.findByTestId('question-table')).toBeVisible()
  expect(within(row('q-1')).getByText('Multiple choice')).toBeVisible()
  expect(within(row('q-1')).getByText('Easy')).toBeVisible()
  expect(screen.getByTestId('facet-count-MCQ')).toHaveTextContent(String([...server.rows.values()].filter(r => r.detail.type === 'MCQ').length))
  expect(screen.queryByTestId('facet-CODE')).toBeVisible()
})
it('shows measured success rate, and a dash with the reason when there are fewer than 5 attempts', async () => {
  mount()
  await screen.findByTestId('question-table')
  const measured = within(row('q-1')).getByTestId('success-rate')
  expect(measured).toHaveTextContent('72%'); expect(measured).toHaveTextContent('18 attempts'); expect(measured).toHaveTextContent('Measured')
  const empty = within(row('q-2')).getByTestId('success-rate')
  expect(empty).toHaveAttribute('data-empty', 'true'); expect(empty).toHaveTextContent('–'); expect(empty).toHaveAttribute('title', expect.stringContaining('Fewer than 5 attempts'))
  expect(empty.textContent).not.toMatch(/\d+%/)
})
it('tells a Co suggestion from a rule-based duplicate, and marks author-only types', async () => {
  mount()
  await screen.findByTestId('question-table')
  const co = within(row('q-2')).getByTestId('flag-chip'); expect(co).toHaveAttribute('data-source', 'CO'); expect(co).toHaveTextContent('Co suggests')
  const dup = within(row('q-3')).getByTestId('flag-chip'); expect(dup).toHaveAttribute('data-source', 'DETERMINISTIC'); expect(dup).toHaveTextContent('Duplicate'); expect(dup).not.toHaveTextContent('Co suggests')
  expect(within(row('q-4')).getByTestId('author-only')).toBeVisible(); expect(within(row('q-6')).getByTestId('author-only')).toBeVisible()
  expect(within(row('q-1')).queryByTestId('author-only')).toBeNull()
})
it('a flag can be dismissed and a dismissed flag goes away without touching the question', async () => {
  const { server } = mount()
  await screen.findByTestId('question-table')
  fireEvent.click(within(row('q-2')).getByTestId('flag-dismiss'))
  await waitFor(() => expect(within(row('q-2')).queryByTestId('flag-chip')).toBeNull())
  expect(log.some(entry => entry.suffix === '/questions/q-2/flags/f-1/dismiss' && entry.method === 'POST')).toBe(true)
  expect(server.rows.get('q-2')!.detail.status).toBe('DRAFT')
})
it('every filter changes the API query', async () => {
  mount()
  await screen.findByTestId('question-table')
  fireEvent.change(screen.getByTestId('filter-plan'), { target: { value: 'plan-fractions' } })
  await waitFor(() => expect(listCalls().at(-1)!.suffix).toContain('planId=plan-fractions'))
  await waitFor(() => expect((screen.getByTestId('filter-topic') as HTMLSelectElement).disabled).toBe(false))
  fireEvent.change(screen.getByTestId('filter-difficulty'), { target: { value: 'MEDIUM' } })
  fireEvent.change(screen.getByTestId('filter-origin'), { target: { value: 'CO' } })
  fireEvent.change(screen.getByTestId('filter-status'), { target: { value: 'DRAFT' } })
  fireEvent.click(screen.getByTestId('filter-flagged'))
  fireEvent.click(screen.getByTestId('facet-SHORT_ANSWER'))
  await waitFor(() => { const last = listCalls().at(-1)!.suffix; for (const part of ['difficulty=MEDIUM', 'origin=CO', 'status=DRAFT', 'flagged=true', 'type=SHORT_ANSWER']) expect(last).toContain(part) })
  fireEvent.click(screen.getByTestId('facet-all'))
  await waitFor(() => expect(listCalls().at(-1)!.suffix).not.toContain('type='))
})
it('filters down to the matching rows and shows an empty state with a way back', async () => {
  mount()
  await screen.findByTestId('question-table')
  fireEvent.change(screen.getByTestId('filter-origin'), { target: { value: 'CSV' } })
  await waitFor(() => expect(screen.getAllByTestId('question-row')).toHaveLength(1))
  fireEvent.change(screen.getByLabelText('Search questions'), { target: { value: 'zzzz-nothing' } })
  expect(await screen.findByTestId('questions-empty', {}, { timeout: 3000 })).toHaveTextContent('No questions match')
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
  await waitFor(() => expect(screen.getAllByTestId('question-row').length).toBeGreaterThan(3))
})
it('an empty bank explains how to start', async () => {
  mount('empty')
  expect(await screen.findByTestId('questions-empty')).toHaveTextContent('Your question bank is empty')
})
it('denied and failed loads are explicit; failure offers retry', async () => {
  mount('denied'); expect(await screen.findByTestId('questions-denied')).toBeVisible(); cleanup()
  mount('error'); expect(await screen.findByTestId('questions-error')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible()
})
it('Import CSV links to the import page with the chosen plan', async () => {
  mount('default', { initialPlanId: 'plan-fractions' })
  const link = await screen.findByTestId('import-csv')
  expect(link).toHaveAttribute('href', '/teacher/questions/import?planId=plan-fractions')
})
it('Co drafting that is unavailable is aria-disabled and shows the server reason', async () => {
  mount('co-unavailable', { initialPlanId: 'plan-fractions' })
  const button = await screen.findByTestId('ask-co')
  await screen.findByTestId('co-reason')
  expect(button).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByTestId('co-reason')).toHaveTextContent('switched off for your school')
  fireEvent.click(button)
  expect(screen.queryByTestId('co-draft-dialog')).toBeNull()
})
