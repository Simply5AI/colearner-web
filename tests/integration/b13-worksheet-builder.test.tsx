import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { TeachingApiError } from '@/lib/api/teaching/core'
import { createMockWorksheets } from '@/app/dev/teacher/worksheets/mock-server'
import { answerKeyRenderSchema, studentRenderSchema, formatCorrectAnswer } from '@/lib/api/teaching/worksheets'
import { renderWithQuery } from './b12/w2-helpers'

type Mock = ReturnType<typeof createMockWorksheets>
const holder = vi.hoisted(() => ({ server: null as unknown, log: [] as { suffix: string; method: string; body: unknown }[] }))
async function call(suffix: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
  holder.log.push({ suffix, method, body })
  const [path = '', search = ''] = suffix.split('?')
  const result = (holder.server as Mock).handle(method, path, new URLSearchParams(search), body as Record<string, unknown>, headers)
  if (result.status >= 400) throw new TeachingApiError(result.status, 'failed', (result.body as { code?: string }).code ?? null)
  return (result.body as { data: unknown }).data
}
vi.mock('@/components/teacher/teaching-context', () => { const value = { schoolId: 'school-1', schoolName: 'Green Valley', request: (...args: unknown[]) => (call as (...a: unknown[]) => Promise<unknown>)(...args) }; return { useTeaching: () => value, TeachingProvider: ({ children }: { children: React.ReactNode }) => children } })
import { WorksheetBuilder } from '@/components/teacher/worksheets/worksheet-builder'
import { WorksheetDocument } from '@/components/teacher/worksheets/worksheet-document'
import { WorksheetsList } from '@/components/teacher/worksheets/worksheets-list'

const setup = (state = 'default') => { holder.server = createMockWorksheets(state); holder.log = [] }
beforeEach(() => vi.clearAllMocks()); afterEach(() => cleanup())

it('lists worksheets with status words, hides archived by default, and has an empty state', async () => {
  setup(); renderWithQuery(<WorksheetsList planId="plan-fractions" />)
  const cards = await screen.findAllByTestId('ws-card')
  expect(cards).toHaveLength(2); expect(cards[0]).toHaveTextContent('Final')
  fireEvent.click(screen.getByTestId('ws-show-archived')); expect(screen.getAllByTestId('ws-card')).toHaveLength(3)
  cleanup(); setup('empty'); renderWithQuery(<WorksheetsList planId="plan-fractions" />)
  expect(await screen.findByTestId('ws-empty')).toBeVisible()
})
it('shows denied and unavailable states for the list', async () => {
  setup('denied'); renderWithQuery(<WorksheetsList planId="plan-fractions" />); expect(await screen.findByTestId('ws-list-failure-denied')).toBeVisible()
  cleanup(); setup('unavailable'); renderWithQuery(<WorksheetsList planId="plan-fractions" />)
  expect(await screen.findByTestId('ws-list-failure')).toHaveTextContent('Nothing was changed')
})

it('adds a published question, reorders, sets marks, saves with expectedVersion', async () => {
  setup(); renderWithQuery(<WorksheetBuilder planId="plan-fractions" worksheetId="ws-draft" />)
  await screen.findByTestId('ws-builder')
  expect(await screen.findAllByTestId('wsb-item')).toHaveLength(2)
  await waitFor(() => expect(screen.getAllByTestId('wsb-item')[0]).toHaveTextContent('What is 3/8 + 2/8?'))
  const add = (await screen.findAllByTestId('bank-add')).find(b => !(b as HTMLButtonElement).disabled)!
  fireEvent.click(add)
  expect(screen.getAllByTestId('wsb-item')).toHaveLength(3); expect(screen.getByTestId('wsb-dirty')).toBeVisible()
  fireEvent.click(screen.getAllByTestId('wsb-up')[2]!)
  fireEvent.change(screen.getAllByTestId('wsb-points')[0]!, { target: { value: '4' } })
  fireEvent.click(screen.getByTestId('wsb-save'))
  await waitFor(() => expect(screen.getByTestId('wsb-notice')).toHaveTextContent('Saved.'))
  const put = holder.log.find(entry => entry.method === 'PUT')!
  expect((put.body as { expectedVersion: number }).expectedVersion).toBe(2)
  expect((put.body as { items: { sortOrder: number }[] }).items.map(i => i.sortOrder)).toEqual([0, 1, 2])
  expect(screen.getByTestId('wsb-total')).toHaveTextContent('3 · 6 marks')
})

it('fills deterministically, saving first, and reports a shortfall', async () => {
  setup(); renderWithQuery(<WorksheetBuilder planId="plan-fractions" worksheetId="ws-draft" />)
  fireEvent.click(await screen.findByTestId('wsb-fill'))
  const dialog = await screen.findByTestId('ws-fill-dialog')
  expect(within(dialog).getByTestId('fill-submit')).toBeDisabled()
  fireEvent.click(within(dialog).getByTestId('fill-topic-topic-parts'))
  fireEvent.change(within(dialog).getByTestId('fill-count'), { target: { value: '5' } })
  fireEvent.click(within(dialog).getByTestId('fill-submit'))
  await waitFor(() => expect(screen.getByTestId('wsb-notice')).toHaveTextContent('Added 3. Only 3 matching published questions were available, 2 short.'))
  expect(screen.getAllByTestId('wsb-item')).toHaveLength(5)
})

it('finalises after confirmation and then becomes read-only with a reason', async () => {
  setup(); renderWithQuery(<WorksheetBuilder planId="plan-fractions" worksheetId="ws-draft" />)
  fireEvent.click(await screen.findByTestId('wsb-finalize'))
  fireEvent.click(await screen.findByTestId('wsb-confirm-go'))
  expect(await screen.findByTestId('wsb-locked')).toHaveTextContent('frozen')
  expect(screen.queryByTestId('wsb-save')).toBeNull(); expect(screen.getByTestId('wsb-title')).toBeDisabled()
  expect(screen.getAllByTestId('bank-add').every(b => (b as HTMLButtonElement).disabled)).toBe(true)
})

it('handles a version conflict without losing the screen', async () => {
  setup('conflict'); renderWithQuery(<WorksheetBuilder planId="plan-fractions" worksheetId="ws-draft" />)
  fireEvent.change(await screen.findByTestId('wsb-title'), { target: { value: 'Changed title' } })
  fireEvent.click(screen.getByTestId('wsb-save'))
  expect(await screen.findByTestId('wsb-conflict')).toBeVisible()
  fireEvent.click(within(screen.getByTestId('wsb-conflict')).getByRole('button', { name: 'Load the latest' }))
  await waitFor(() => expect((screen.getByTestId('wsb-title') as HTMLInputElement).value).toBe('Adding fractions practice (fixture)'))
})

it('student page has no answers and no answer-key text; the key page has the header and answers', async () => {
  setup(); renderWithQuery(<WorksheetDocument planId="plan-fractions" worksheetId="ws-final" mode="student" />)
  const sheet = await screen.findByTestId('ws-sheet')
  expect(within(sheet).getAllByTestId('ws-question')).toHaveLength(10)
  expect(within(sheet).getByTestId('ws-name-line')).toBeVisible(); expect(sheet.textContent).not.toMatch(/Teacher answer key|Answer:|Marking guide|Why:|Cross-multiply/)
  expect(holder.log.every(entry => !entry.suffix.includes('answer-key'))).toBe(true)
  cleanup(); holder.log = []
  renderWithQuery(<WorksheetDocument planId="plan-fractions" worksheetId="ws-final" mode="answer-key" />)
  expect(await screen.findByTestId('ws-key-header')).toHaveTextContent('Teacher answer key')
  expect(screen.getAllByTestId('ws-answer')).toHaveLength(10); expect(screen.getByTestId('ws-sheet').textContent).toContain('Cross-multiply')
  expect(holder.log.some(entry => entry.suffix.includes('part=answer-key'))).toBe(true)
})

it('the student render schema strips answer-key fields even if the server leaks them', () => {
  const leaky = { worksheet: { id: 'w', title: 't', instructions: '', status: 'FINAL', settings: { showHints: false, answerLines: 3, includeName: true } },
    items: [{ number: 1, points: 1, type: 'MCQ', prompt: 'p', options: [{ id: 'o1', label: 'a' }], answerLines: 0, correctAnswer: { kind: 'option', optionId: 'o1' }, explanation: 'secret', rubric: 'secret' }] }
  const parsed = studentRenderSchema.parse(leaky)
  expect(JSON.stringify(parsed)).not.toMatch(/correctAnswer|secret|explanation|rubric/)
  expect(answerKeyRenderSchema.safeParse(leaky.items[0] && { ...leaky, items: [{ ...leaky.items[0], correctAnswer: undefined }] }).success).toBe(false)
})
it('formats every answer kind for the key', () => {
  const item = (correctAnswer: unknown) => ({ number: 1, points: 1, type: 'X', prompt: 'p', options: [{ id: 'a', label: 'One' }, { id: 'b', label: 'Two' }], media: null, answerLines: 0, explanation: '', rubric: null, correctAnswer }) as never
  expect(formatCorrectAnswer(item({ kind: 'option', optionId: 'b' }))).toEqual(['B. Two'])
  expect(formatCorrectAnswer(item({ kind: 'order', optionIds: ['b', 'a'] }))).toEqual(['1. Two', '2. One'])
  expect(formatCorrectAnswer(item({ kind: 'blanks', blanks: [['x', 'y']] }))).toEqual(['Blank 1: x / y'])
})
