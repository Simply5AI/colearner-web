import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
const holder = vi.hoisted(() => ({ request: (() => Promise.reject(new Error('unset'))) as (...args: unknown[]) => Promise<unknown>, push: vi.fn(), replace: vi.fn() }))
vi.mock('@/components/teacher/teaching-context', () => { const value = { schoolId: 'school-1', schoolName: 'Green Valley', request: (...args: unknown[]) => holder.request(...args) }; return { useTeaching: () => value, TeachingProvider: ({ children }: { children: React.ReactNode }) => children } })
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: holder.push, replace: holder.replace }) }))
vi.mock('@/lib/api/teaching/co-drafts', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/api/teaching/co-drafts')>()), POLL_MS: 30 }))
import { CoDraftDialog } from '@/components/teacher/questions/co-draft-dialog'
import { CoReviewQueue } from '@/components/teacher/questions/co-review-queue'
import { createMockQuestions, renderWithQuery, requestFor, type LogEntry } from './b13-question-helpers'

let log: LogEntry[] = []
function boot(state: string) { log = []; const server = createMockQuestions(state); holder.request = requestFor(server, log) as typeof holder.request; return server }
const cards = () => screen.getAllByTestId('draft-card')
beforeEach(() => vi.clearAllMocks()); afterEach(() => cleanup())

it('polls while Co works, shows an honest working state, then the queue', async () => {
  boot('batch-running'); renderWithQuery(<CoReviewQueue batchId="batch-101" />)
  const working = await screen.findByTestId('batch-working')
  expect(working.textContent).toMatch(/Co (has your request|is drafting)/); expect(working).toHaveAttribute('aria-live', 'polite')
  expect(await screen.findByTestId('review-heading')).toHaveTextContent("Co drafted 4 questions from ‘Adding fractions’")
  expect(log.filter(entry => entry.suffix === '/questions/co-drafts/batch-101').length).toBeGreaterThanOrEqual(3)
  const before = log.length
  await new Promise(resolve => setTimeout(resolve, 150))
  expect(log.length).toBe(before)
  expect(cards()).toHaveLength(4)
})
it('lists drafts with the answer key, Co suggestion chips and validation warnings, none of them published', async () => {
  const server = boot('default'); renderWithQuery(<CoReviewQueue batchId="batch-101" />)
  await screen.findByTestId('review-heading')
  for (const card of cards()) expect(card).toHaveAttribute('data-review-state', 'PENDING_REVIEW')
  expect([...server.rows.values()].filter(r => r.detail.origin === 'CO').every(r => r.detail.status === 'DRAFT')).toBe(true)
  expect(within(cards()[0]!).getByTestId('draft-key')).toHaveTextContent('Answer key: How many equal parts')
  expect(within(cards()[1]!).getByTestId('flag-chip')).toHaveTextContent('Co suggests')
  expect(within(cards()[3]!).getByTestId('draft-warnings')).toHaveTextContent('Check before accepting')
  expect(screen.getByTestId('review-progress')).toHaveTextContent('0 of 4 reviewed')
})
it('Accept publishes only that question and records the decision', async () => {
  const server = boot('default'); renderWithQuery(<CoReviewQueue batchId="batch-101" />)
  await screen.findByTestId('review-heading')
  const first = cards()[0]!; const id = first.getAttribute('data-question-id')!
  fireEvent.click(within(first).getByTestId('draft-accept'))
  await waitFor(() => expect(within(cards()[0]!).getByTestId('draft-decided')).toHaveTextContent('Published'))
  const row = server.rows.get(id)!.detail
  expect(row.status).toBe('PUBLISHED'); expect(row.reviewState).toBe('ACCEPTED'); expect(row.provenance.approvedBy).toBe('teacher-1')
  expect(log.find(entry => entry.suffix === `/questions/${id}/review`)!.body).toEqual({ decision: 'ACCEPT', expectedVersion: 1 })
  expect(screen.getByTestId('review-progress')).toHaveTextContent('1 of 4 reviewed')
  expect(within(cards()[1]!).getByTestId('draft-accept')).toBeVisible()
})
it('Reject archives the question and keeps its provenance', async () => {
  const server = boot('default'); renderWithQuery(<CoReviewQueue batchId="batch-101" />)
  await screen.findByTestId('review-heading')
  const second = cards()[1]!; const id = second.getAttribute('data-question-id')!
  fireEvent.click(within(second).getByTestId('draft-reject'))
  await waitFor(() => expect(within(cards()[1]!).getByTestId('draft-decided')).toHaveTextContent('Rejected'))
  const row = server.rows.get(id)!.detail
  expect(row.status).toBe('ARCHIVED'); expect(row.reviewState).toBe('REJECTED'); expect(row.provenance.origin).toBe('CO'); expect(row.provenance.batchId).toBe('batch-101')
})
it('Edit opens the editor for that question', async () => {
  boot('default'); renderWithQuery(<CoReviewQueue batchId="batch-101" />)
  await screen.findByTestId('review-heading')
  const card = cards()[2]!
  expect(within(card).getByTestId('draft-edit')).toHaveAttribute('href', `/teacher/questions/${card.getAttribute('data-question-id')}`)
})
it('a server rejection on Accept is shown on that card and the draft stays pending', async () => {
  const server = boot('default'); renderWithQuery(<CoReviewQueue batchId="batch-101" />)
  await screen.findByTestId('review-heading')
  const card = cards()[3]!; const id = card.getAttribute('data-question-id')!
  fireEvent.click(within(card).getByTestId('draft-accept'))
  expect(await within(cards()[3]!).findByTestId('draft-error')).toHaveTextContent('server found a problem')
  expect(server.rows.get(id)!.detail.status).toBe('DRAFT')
})
it('a failed batch says nothing was added and offers a way back', async () => {
  boot('batch-failed'); renderWithQuery(<CoReviewQueue batchId="batch-101" />)
  expect(await screen.findByTestId('batch-failed')).toHaveTextContent('Nothing was drafted')
  expect(screen.queryAllByTestId('draft-card')).toHaveLength(0)
})
it('an unknown or foreign batch is a denied state', async () => {
  boot('default'); renderWithQuery(<CoReviewQueue batchId="batch-nope" />)
  expect(await screen.findByTestId('review-denied')).toBeVisible()
})
it('Co re-check is unavailable with the server reason when Co review is off', async () => {
  boot('co-unavailable'); renderWithQuery(<CoReviewQueue batchId="batch-101" />)
  expect(await screen.findByTestId('recheck-unavailable')).toHaveTextContent('switched off for your school')
})

function openDialog(state: string) { boot(state); renderWithQuery(<CoDraftDialog open onOpenChange={() => undefined} />) }
async function fillDialog() {
  const plan = await screen.findByTestId('co-plan')
  await waitFor(() => expect(within(plan).getByText('Grade 6 Fractions')).toBeInTheDocument())
  fireEvent.change(plan, { target: { value: 'plan-fractions' } })
  await waitFor(() => expect(within(screen.getByTestId('co-topic')).getByText('Adding fractions')).toBeInTheDocument())
  fireEvent.change(screen.getByTestId('co-topic'), { target: { value: 'topic-add' } })
  fireEvent.click(await screen.findByLabelText(/Mr. Thomas notes/))
}
it('asks Co with a key and goes to the review queue', async () => {
  openDialog('default')
  await fillDialog()
  await waitFor(() => expect(screen.getByTestId('co-submit')).not.toHaveAttribute('aria-disabled', 'true'))
  fireEvent.change(screen.getByTestId('co-count'), { target: { value: '4' } })
  fireEvent.click(screen.getByTestId('co-submit'))
  await waitFor(() => expect(holder.push).toHaveBeenCalledWith(expect.stringMatching(/^\/teacher\/questions\/review\/batch-/)))
  const post = log.find(entry => entry.method === 'POST' && entry.suffix.endsWith('/co-drafts'))!
  expect(post.headers?.['Idempotency-Key']).toBeTruthy()
  expect(post.body).toMatchObject({ topicId: 'topic-add', materialIds: ['mat-pdf'], count: 4, types: ['MCQ', 'SHORT_ANSWER'] })
  expect(JSON.stringify(post.body)).not.toMatch(/CODE|PICTURE|ORDERING/)
})
it('explains what is missing and does not call the server', async () => {
  openDialog('default')
  fireEvent.click(await screen.findByTestId('co-submit'))
  expect(screen.getByTestId('co-problem')).toHaveTextContent('Choose a plan')
  expect(log.some(entry => entry.method === 'POST')).toBe(false)
})
it('unavailable Co is aria-disabled with the server reason and sends nothing', async () => {
  openDialog('co-unavailable')
  await fillDialog()
  expect(await screen.findByTestId('co-unavailable')).toHaveTextContent('switched off for your school')
  expect(screen.getByTestId('co-submit')).toHaveAttribute('aria-disabled', 'true')
  fireEvent.click(screen.getByTestId('co-submit'))
  expect(log.some(entry => entry.method === 'POST')).toBe(false)
})
it('keeps the choices and shows the reason when the server refuses', async () => {
  openDialog('default')
  await fillDialog()
  await waitFor(() => expect(screen.getByTestId('co-submit')).not.toHaveAttribute('aria-disabled', 'true'))
  const request = holder.request
  holder.request = (async (...args: unknown[]) => { if (args[1] === 'POST') { const { TeachingApiError } = await import('@/lib/api/teaching/core'); throw new TeachingApiError(429, 'x', 'CO_DRAFT_DAILY_LIMIT') } return request(...args) }) as typeof holder.request
  fireEvent.click(screen.getByTestId('co-submit'))
  expect(await screen.findByTestId('co-create-error')).toHaveTextContent('today’s limit')
  expect((screen.getByTestId('co-count') as HTMLInputElement).value).toBe('10')
  expect(holder.push).not.toHaveBeenCalled()
})
