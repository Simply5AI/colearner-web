import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { TeachingApiError } from '@/lib/api/teaching/core'
import { createMockWorksheets, SAMPLE_CSV } from '@/app/dev/teacher/worksheets/mock-server'
import { renderWithQuery } from './b12/w2-helpers'

type Mock = ReturnType<typeof createMockWorksheets>
const holder = vi.hoisted(() => ({ server: null as unknown, log: [] as { suffix: string; method: string; body: unknown }[] }))
const server = () => holder.server as Mock
async function call(suffix: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
  holder.log.push({ suffix, method, body })
  const [path = '', search = ''] = suffix.split('?')
  const result = server().handle(method, path, new URLSearchParams(search), body as Record<string, unknown>, headers)
  if (result.status >= 400) throw new TeachingApiError(result.status, 'failed', (result.body as { code?: string }).code ?? null)
  return (result.body as { data: unknown }).data
}
vi.mock('@/components/teacher/teaching-context', () => { const value = { schoolId: 'school-1', schoolName: 'Green Valley', request: (...args: unknown[]) => (call as (...a: unknown[]) => Promise<unknown>)(...args) }; return { useTeaching: () => value, TeachingProvider: ({ children }: { children: React.ReactNode }) => children } })
vi.mock('@/lib/api/teaching/question-imports', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/api/teaching/question-imports')>()),
  uploadTeachingFile: async (_school: string, suffix: string, file: File) => call(suffix, 'POST', { fileName: file.name, text: await file.text() }),
}))
import { CsvImportFlow } from '@/components/teacher/questions/csv-import-flow'

function mount(state = 'default', importId: string | null = null, onLocationChange = vi.fn()) {
  holder.server = createMockWorksheets(state); holder.log = []
  renderWithQuery(<CsvImportFlow initialPlanId="plan-fractions" initialImportId={importId} onLocationChange={onLocationChange} />)
  return onLocationChange
}
async function upload(text = SAMPLE_CSV, name = 'q.csv') {
  const input = await screen.findByTestId('csv-file')
  fireEvent.change(input, { target: { files: [new File([text], name, { type: 'text/csv' })] } })
  await screen.findByTestId('csv-file-name')
  fireEvent.click(screen.getByTestId('csv-upload-submit'))
  return screen.findByTestId('csv-mapping')
}
beforeEach(() => vi.clearAllMocks()); afterEach(() => cleanup())

it('rejects a non-CSV file before any request', async () => {
  mount()
  fireEvent.change(await screen.findByTestId('csv-file'), { target: { files: [new File(['x'], 'notes.pdf', { type: 'application/pdf' })] } })
  expect(await screen.findByTestId('csv-file-problem')).toHaveTextContent('Choose a .csv file')
  expect(holder.log.some(entry => entry.method === 'POST')).toBe(false)
  expect(screen.getByTestId('csv-upload-submit')).toBeDisabled()
})

it('uploads, suggests a mapping, previews per-row errors and duplicate suggestions, then commits valid rows only', async () => {
  const onLocation = mount()
  await upload()
  expect(onLocation).toHaveBeenCalledWith(expect.objectContaining({ importId: expect.stringMatching(/^imp-/) }))
  expect((screen.getByTestId('map-prompt') as HTMLSelectElement).value).toBe('Question')
  expect((screen.getByTestId('map-correct') as HTMLSelectElement).value).toBe('Answer')
  fireEvent.change(screen.getByTestId('map-default-topic'), { target: { value: 'topic-add' } })
  fireEvent.click(screen.getByTestId('map-submit'))
  const preview = await screen.findByTestId('csv-preview')
  expect(within(preview).getByTestId('csv-valid')).toHaveTextContent('3 questions ready')
  expect(within(preview).getByTestId('csv-invalid')).toHaveTextContent('3 rows with a problem')
  expect(within(preview).getByTestId('csv-dups')).toHaveTextContent('1 possible duplicate')
  const rows = within(preview).getAllByTestId('csv-row')
  expect(rows.find(r => r.getAttribute('data-row') === '5')!).toHaveTextContent('cannot be imported')
  expect(rows.find(r => r.getAttribute('data-row') === '4')!).toHaveTextContent('question text is empty')
  expect(rows.find(r => r.getAttribute('data-row') === '3')!.getAttribute('data-status')).toBe('DUPLICATE_SUGGESTION')
  expect(screen.getByTestId('csv-commit')).toHaveTextContent('Import 3 questions')
  fireEvent.click(screen.getByTestId('csv-commit'))
  expect(await screen.findByTestId('csv-committed')).toHaveTextContent('3 questions added as drafts')
  expect(screen.getByTestId('csv-skipped')).toHaveTextContent('4 rows skipped')
  const commit = holder.log.find(entry => entry.suffix.endsWith('/commit'))!
  expect(commit.body).toEqual({ includeDuplicateSuggestions: false })
})

it('includes duplicate suggestions only when the teacher opts in', async () => {
  mount(); await upload()
  fireEvent.change(screen.getByTestId('map-default-topic'), { target: { value: 'topic-add' } })
  fireEvent.click(screen.getByTestId('map-submit')); await screen.findByTestId('csv-preview')
  fireEvent.click(within(screen.getByTestId('csv-include-dups')).getByRole('checkbox'))
  expect(screen.getByTestId('csv-commit')).toHaveTextContent('Import 4 questions')
  fireEvent.click(screen.getByTestId('csv-commit'))
  expect(await screen.findByTestId('csv-committed')).toHaveTextContent('4 questions added')
})

it('blocks continuing until the required columns are matched', async () => {
  mount(); await upload('a,b\n1,2\n')
  expect(screen.getByTestId('map-submit')).toBeDisabled()
  expect(screen.getByTestId('map-blocked')).toHaveTextContent('Question text and Correct answer')
})

it('resumes from an import id in the URL and shows the committed summary without committing again', async () => {
  mount(); await upload()
  fireEvent.click(screen.getByTestId('map-submit')); await screen.findByTestId('csv-preview'); fireEvent.click(screen.getByTestId('csv-commit')); await screen.findByTestId('csv-done')
  const id = holder.log.find(entry => entry.suffix.endsWith('/question-imports'))!
  void id; cleanup(); holder.log = []
  renderWithQuery(<CsvImportFlow initialPlanId="plan-fractions" initialImportId="imp-1" />)
  expect(await screen.findByTestId('csv-done')).toBeVisible()
  expect(holder.log.some(entry => entry.method === 'POST')).toBe(false)
})

it('shows an expired import with a way to upload again', async () => {
  mount('expired'); await upload()
  fireEvent.click(screen.getByTestId('map-submit')); await screen.findByTestId('csv-preview'); fireEvent.click(screen.getByTestId('csv-commit'))
  expect(await screen.findByTestId('csv-commit-failure')).toHaveTextContent('expired')
  expect(await screen.findByTestId('csv-expired')).toBeVisible()
})

it('shows denied and unavailable-with-retry states', async () => {
  mount('denied', 'imp-9'); expect(await screen.findByTestId('csv-import-failure-denied')).toBeVisible()
  cleanup(); mount('unavailable', 'imp-9')
  expect(await screen.findByTestId('csv-import-failure')).toHaveTextContent('Nothing was changed'); expect(screen.getByRole('button', { name: /Retry/ })).toBeVisible()
  await waitFor(() => expect(screen.getByTestId('csv-import')).toBeVisible())
})
