import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
const holder = vi.hoisted(() => ({ request: (() => Promise.reject(new Error('unset'))) as (...args: unknown[]) => Promise<unknown>, replace: vi.fn(), push: vi.fn() }))
vi.mock('@/components/teacher/teaching-context', () => { const value = { schoolId: 'school-1', schoolName: 'Green Valley', request: (...args: unknown[]) => holder.request(...args) }; return { useTeaching: () => value, TeachingProvider: ({ children }: { children: React.ReactNode }) => children } })
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: holder.push, replace: holder.replace }) }))
import { QuestionEditor } from '@/components/teacher/questions/question-editor'
import { questionTypes, validateQuestion, contentForType, type QuestionContent, type QuestionType } from '@/lib/api/teaching/question-schema'
import { createMockQuestions, renderWithQuery, requestFor, type LogEntry } from './b13-question-helpers'

let log: LogEntry[] = []
function mount(props: { questionId?: string; planId?: string; topicId?: string }, state = 'default') {
  log = []; const server = createMockQuestions(state); holder.request = requestFor(server, log) as typeof holder.request
  renderWithQuery(<QuestionEditor {...props} />); return { server }
}
const type = (testId: string, value: string) => fireEvent.change(screen.getByTestId(testId), { target: { value } })
const labels = (values: string[]) => screen.getAllByTestId('option-label').forEach((input, i) => fireEvent.change(input, { target: { value: values[i] ?? `Option ${i + 1}` } }))
const posted = () => log.find(entry => entry.method === 'POST' && /\/plans\/plan-fractions\/questions$/.test(entry.suffix))
beforeEach(() => { vi.clearAllMocks() }); afterEach(() => cleanup())

async function openNew(kind: QuestionType) {
  const view = mount({ planId: 'plan-fractions', topicId: 'topic-parts' })
  await screen.findByTestId('field-type')
  await waitFor(() => expect((screen.getByTestId('field-topic') as HTMLSelectElement).value).toBe('topic-parts'))
  if (kind !== 'MCQ') type('field-type', kind)
  return view
}
const fillers: Record<QuestionType, () => Promise<void> | void> = {
  MCQ: () => labels(['1/8', '3/8', '5/8', '7/8']),
  MULTI_SELECT: () => { labels(['2/4', '3/6', '2/3', '4/8']); fireEvent.click(screen.getAllByTestId('option-correct')[1]!) },
  TRUE_FALSE: () => { fireEvent.click(screen.getByTestId('tf-false')) },
  FILL_BLANK: () => { type('field-prompt', '2/4 + ___ = 1'); fireEvent.change(screen.getByTestId('blank-answers'), { target: { value: '2/4\n1/2' } }) },
  SHORT_ANSWER: () => { fireEvent.change(screen.getByTestId('field-sample'), { target: { value: 'A common denominator.' } }); fireEvent.change(screen.getByTestId('field-rubric'), { target: { value: 'Mentions denominators.' } }) },
  LONG_ANSWER: () => { fireEvent.change(screen.getByTestId('field-sample'), { target: { value: 'A long model answer.' } }); fireEvent.change(screen.getByTestId('field-rubric'), { target: { value: 'Three marks.' } }) },
  CODE: () => { fireEvent.change(screen.getByTestId('field-sample'), { target: { value: 'def f(x):\n    return x + 1' } }); fireEvent.change(screen.getByTestId('field-starter'), { target: { value: 'def f(x):' } }) },
  PICTURE_CHOICE: async () => {
    labels(['Eighths', 'Quarters', 'Halves', 'Thirds'])
    await waitFor(() => expect(within(screen.getAllByTestId('option-image')[0]!).getByText('Pizza cut in 8 (photo)')).toBeInTheDocument())
    screen.getAllByTestId('option-image').forEach(select => fireEvent.change(select, { target: { value: 'mat-photo-1' } }))
  },
  ORDERING: () => labels(['One quarter', 'One third', 'One half']),
}

describe('authoring every type', () => {
  it.each(questionTypes)('creates a %s draft with the section 5 shape and an idempotency key', async kind => {
    await openNew(kind)
    if (kind !== 'FILL_BLANK') type('field-prompt', `A ${kind} question about fractions`)
    await fillers[kind]()
    fireEvent.change(screen.getByTestId('field-difficulty'), { target: { value: 'MEDIUM' } })
    fireEvent.change(screen.getByTestId('hint-NUDGE'), { target: { value: 'Think about the bottom number.' } })
    fireEvent.change(screen.getByTestId('hint-SIMILAR_EXAMPLE'), { target: { value: 'Try 1/3 + 1/3.' } })
    fireEvent.change(screen.getByTestId('field-explanation'), { target: { value: 'Because.' } })
    fireEvent.click(screen.getByTestId('save'))
    await waitFor(() => expect(posted()).toBeTruthy())
    const body = posted()!.body as QuestionContent
    expect(posted()!.headers?.['Idempotency-Key']).toBeTruthy()
    expect(body).toMatchObject({ schemaVersion: '1.0', type: kind, topicId: 'topic-parts', difficulty: 'MEDIUM', explanation: 'Because.' })
    expect(body.hints).toEqual([{ rung: 'NUDGE', text: 'Think about the bottom number.' }, { rung: 'SIMILAR_EXAMPLE', text: 'Try 1/3 + 1/3.' }])
    expect(validateQuestion(body)).toEqual([])
    if (kind === 'SHORT_ANSWER' || kind === 'LONG_ANSWER') expect(body.rubric).toBeTruthy(); else expect(body.rubric).toBeNull()
    if (kind === 'PICTURE_CHOICE') expect(Object.keys(body.media!.optionImages!)).toHaveLength(4)
    if (kind === 'CODE') expect(body.media).toEqual({ language: 'python', starterCode: 'def f(x):' })
    if (kind === 'TRUE_FALSE') expect(body.correctAnswer).toEqual({ kind: 'option', optionId: 'false' })
    if (kind === 'FILL_BLANK') expect(body.correctAnswer).toEqual({ kind: 'blanks', blanks: [['2/4', '1/2']] })
    if (kind === 'ORDERING') expect(body.correctAnswer).toMatchObject({ kind: 'order' })
    await waitFor(() => expect(holder.replace).toHaveBeenCalledWith(expect.stringMatching(/^\/teacher\/questions\/q-/)))
  })
})

it('author-only types say so before saving', async () => {
  await openNew('ORDERING')
  expect(screen.getByTestId('field-type').parentElement).toHaveTextContent('do not see this type yet')
})
it('shows inline errors with the field, moves focus to the first, and sends nothing', async () => {
  await openNew('MCQ')
  fireEvent.click(screen.getByTestId('save'))
  expect(await screen.findByTestId('error-prompt')).toHaveTextContent('Write the question')
  expect(screen.getAllByTestId('error-options.0.label').length).toBeGreaterThan(0)
  expect(screen.getByTestId('issue-count')).toBeVisible()
  expect(posted()).toBeUndefined()
  await waitFor(() => expect(document.activeElement?.getAttribute('data-testid')).toBe('field-prompt'))
})
it('refuses a fill-in-the-blank with no blank marker and one with a missing answer', async () => {
  await openNew('FILL_BLANK')
  type('field-prompt', 'No marker here'); fireEvent.click(screen.getByTestId('save'))
  expect(await screen.findByTestId('error-prompt')).toHaveTextContent('___')
  type('field-prompt', 'Two ___ and ___'); fireEvent.click(screen.getByTestId('save'))
  await waitFor(() => expect(screen.getAllByTestId('blank-answers')).toHaveLength(2))
  expect(screen.getByTestId('error-correctAnswer.blanks.0')).toBeVisible()
})
it('keeps the answer key labelled as staff only', async () => {
  await openNew('MCQ')
  expect(screen.getByTestId('answer-key-note')).toHaveTextContent('Only you and your school')
  expect(screen.getByText('1. Nudge')).toBeVisible(); expect(screen.getByText('2. Hint')).toBeVisible(); expect(screen.getByText('3. Similar example')).toBeVisible()
})
it('Save then Publish on a new question creates it and publishes it', async () => {
  const { server } = await openNew('TRUE_FALSE')
  type('field-prompt', 'A third is bigger than a half.')
  fireEvent.click(screen.getByTestId('publish'))
  await waitFor(() => expect(holder.replace).toHaveBeenCalled())
  const created = [...server.rows.values()].find(r => r.detail.promptPreview.startsWith('A third'))!
  expect(created.detail.status).toBe('PUBLISHED'); expect(created.detail.version).toBe(2)
})

describe('a published question', () => {
  it('editing saves a draft revision and shows the banner; learners keep the published version', async () => {
    const { server } = mount({ questionId: 'q-1' })
    await screen.findByTestId('question-editor')
    expect(screen.queryByTestId('draft-revision-banner')).toBeNull()
    type('field-prompt', 'Which of 3/8 and 5/8 is bigger?')
    fireEvent.click(screen.getByTestId('save'))
    expect(await screen.findByTestId('draft-revision-banner')).toHaveTextContent('Learners still see published version 1')
    const row = server.rows.get('q-1')!.detail
    expect(row.content.prompt).toBe('Which fraction is bigger, 3/8 or 5/8?'); expect(row.draftRevision!.content.prompt).toBe('Which of 3/8 and 5/8 is bigger?')
    expect(log.find(entry => entry.method === 'PUT')!.body).toMatchObject({ expectedVersion: 1 })
    fireEvent.click(screen.getByTestId('publish'))
    await waitFor(() => expect(server.rows.get('q-1')!.detail.version).toBe(2))
    await waitFor(() => expect(screen.queryByTestId('draft-revision-banner')).toBeNull())
    expect(screen.getByTestId('editor-status')).toHaveTextContent('Published')
  })
  it('opens on the draft revision, and discarding it keeps the published version', async () => {
    const { server } = mount({ questionId: 'q-7' })
    expect(await screen.findByTestId('draft-revision-banner')).toBeVisible()
    expect((screen.getByTestId('field-prompt') as HTMLTextAreaElement).value).toBe('Which fraction of the pizza is left now?')
    fireEvent.click(screen.getByTestId('discard-draft'))
    fireEvent.click(await screen.findByTestId('confirm-action'))
    await waitFor(() => expect(screen.queryByTestId('draft-revision-banner')).toBeNull())
    expect(server.rows.get('q-7')!.detail.hasDraftRevision).toBe(false)
    expect((screen.getByTestId('field-prompt') as HTMLTextAreaElement).value).toContain('Which fraction of the pizza is left?')
  })
  it('publish says there is nothing to publish when nothing changed', async () => {
    mount({ questionId: 'q-1' })
    await screen.findByTestId('question-editor')
    expect(screen.getByTestId('publish')).toHaveAttribute('aria-disabled', 'true'); expect(screen.getByTestId('publish-reason')).toHaveTextContent('Nothing new to publish')
  })
  it('archiving asks first, then makes the question read-only with a reason', async () => {
    const { server } = mount({ questionId: 'q-1' })
    await screen.findByTestId('question-editor')
    fireEvent.click(screen.getByTestId('archive'))
    expect(await screen.findByTestId('confirm-dialog')).toHaveTextContent('Learners will stop seeing it')
    fireEvent.click(screen.getByTestId('confirm-action'))
    expect(await screen.findByTestId('archived-note')).toBeVisible()
    expect(server.rows.get('q-1')!.detail.status).toBe('ARCHIVED')
    expect(screen.getByTestId('publish')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByTestId('field-prompt').matches(':disabled')).toBe(true)
  })
  it('a published question cannot be deleted; a never-published manual draft can', async () => {
    mount({ questionId: 'q-1' }); await screen.findByTestId('question-editor'); expect(screen.queryByTestId('delete')).toBeNull(); cleanup()
    const { server } = mount({ questionId: 'q-9' }); await screen.findByTestId('question-editor')
    fireEvent.click(screen.getByTestId('delete')); fireEvent.click(await screen.findByTestId('confirm-action'))
    await waitFor(() => expect(holder.replace).toHaveBeenCalledWith('/teacher/questions'))
    expect(server.rows.has('q-9')).toBe(false)
  })
})

describe('version conflicts', () => {
  it('keeps the teacher’s edits, explains, and lets them load the latest and save again', async () => {
    const { server } = mount({ questionId: 'q-1' }, 'conflict')
    await screen.findByTestId('question-editor')
    type('field-prompt', 'My edited prompt')
    fireEvent.click(screen.getByTestId('save'))
    const panel = await screen.findByTestId('conflict-panel')
    expect(panel).toHaveTextContent('Your edits are still here')
    expect((screen.getByTestId('field-prompt') as HTMLTextAreaElement).value).toBe('My edited prompt')
    fireEvent.click(screen.getByTestId('conflict-keep'))
    await waitFor(() => expect(screen.queryByTestId('conflict-panel')).toBeNull())
    expect((screen.getByTestId('field-prompt') as HTMLTextAreaElement).value).toBe('My edited prompt')
    fireEvent.click(screen.getByTestId('save'))
    await waitFor(() => expect(server.rows.get('q-1')!.detail.draftRevision?.content.prompt).toBe('My edited prompt'))
    expect(log.filter(entry => entry.method === 'PUT').at(-1)!.body).toMatchObject({ expectedVersion: 2 })
  })
  it('discarding my edits loads the latest', async () => {
    mount({ questionId: 'q-1' }, 'conflict')
    await screen.findByTestId('question-editor')
    type('field-prompt', 'Throw me away'); fireEvent.click(screen.getByTestId('save'))
    await screen.findByTestId('conflict-panel'); fireEvent.click(screen.getByTestId('conflict-discard'))
    await waitFor(() => expect(screen.queryByTestId('conflict-panel')).toBeNull())
    expect((screen.getByTestId('field-prompt') as HTMLTextAreaElement).value).toBe('Which fraction is bigger, 3/8 or 5/8?')
  })
})

describe('provenance and Co drafts', () => {
  it('shows what the server knows about where a Co draft came from, and nothing it does not', async () => {
    const { server } = mount({ questionId: 'q-102' })
    const co = [...server.rows.values()].find(r => r.detail.origin === 'CO')!.detail
    cleanup(); mount({ questionId: co.id })
    const panel = await screen.findByTestId('provenance')
    expect(panel).toHaveTextContent('Drafted by Co'); expect(panel).toHaveTextContent('0.1.10'); expect(panel).toHaveTextContent('fixture')
    expect(within(panel).getByRole('link', { name: 'Open the batch' })).toHaveAttribute('href', expect.stringContaining('/teacher/questions/review/batch-'))
    expect(panel).not.toHaveTextContent('CSV import')
    expect(screen.getByTestId('co-pending-banner')).toBeVisible()
  })
  it('accepting a Co draft in the editor publishes it with the teacher as approver', async () => {
    const { server } = mount({ questionId: 'q-102' })
    const co = [...server.rows.values()].find(r => r.detail.origin === 'CO')!.detail
    cleanup(); mount({ questionId: co.id })
    fireEvent.click(await screen.findByTestId('accept'))
    await waitFor(() => expect(screen.getByTestId('editor-status')).toHaveTextContent('Accepted and published'))
    expect(log.some(entry => entry.suffix.endsWith('/review') && (entry.body as { decision: string }).decision === 'ACCEPT')).toBe(true)
  })
  it('a flag is a suggestion: it appears with its note, and a flagged draft can still be published', async () => {
    const { server } = mount({ questionId: 'q-2' })
    expect(await screen.findByTestId('summary')).toHaveTextContent('Co suggests: ambiguous wording')
    expect(screen.getByTestId('summary')).toHaveTextContent('Suggestions are advice')
    expect(screen.getByTestId('publish')).not.toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(screen.getByTestId('publish'))
    await waitFor(() => expect(server.rows.get('q-2')!.detail.status).toBe('PUBLISHED'))
  })
})

it('shows denied and retry states for a question that cannot be loaded', async () => {
  mount({ questionId: 'nope' })
  expect(await screen.findByTestId('editor-denied')).toHaveTextContent('not found')
  cleanup(); mount({ questionId: 'q-1' }, 'denied')
  expect(await screen.findByTestId('editor-denied')).toBeVisible()
})
it('every blank question type starts valid-shaped for its own rules', () => {
  for (const kind of questionTypes) expect(validateQuestion(contentForType(kind, { topicId: 't' })).length).toBeGreaterThan(0)
})
