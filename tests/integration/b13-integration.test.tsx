import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { TeachingApiError, teachingRequest } from '@/lib/api/teaching/core'
import { serverIssues } from '@/lib/api/teaching/questions'
import { contentForType } from '@/lib/api/teaching/question-schema'
import { worksheetErrorText } from '@/lib/api/teaching/worksheets'
import { createMockWorksheets } from '@/app/dev/teacher/worksheets/mock-server'
import { renderWithQuery as renderWorksheets } from './b12/w2-helpers'

const holder = vi.hoisted(() => ({ request: (() => Promise.reject(new Error('unset'))) as (...args: unknown[]) => Promise<unknown> }))
vi.mock('@/components/teacher/teaching-context', () => { const value = { schoolId: 'school-1', schoolName: 'Green Valley', request: (...args: unknown[]) => holder.request(...args) }; return { useTeaching: () => value, TeachingProvider: ({ children }: { children: React.ReactNode }) => children } })
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
import { QuestionBankList } from '@/components/teacher/questions/question-bank-list'
import { WorksheetBuilder } from '@/components/teacher/worksheets/worksheet-builder'
import { createMockQuestions, renderWithQuery, requestFor, type LogEntry } from './b13-question-helpers'

beforeEach(() => vi.clearAllMocks()); afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('422 details reach the editor', () => {
  it('carries the platform error body (flat shape) as code and details', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      statusCode: 422, code: 'QUESTION_INVALID', message: 'The question is not valid',
      details: [{ path: 'correctAnswer.optionId', code: 'UNKNOWN_OPTION' }, { path: 'media.optionImages.opt-b', code: 'REQUIRED' }, { nope: true }],
      error: 'UnprocessableEntityException', timestamp: 'x', path: '/p',
    }, { status: 422 })))
    const failure = await teachingRequest('token', 's1', '/plans/p/questions', 'POST', {}, { 'Idempotency-Key': 'key-12345678' }).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(TeachingApiError)
    const error = failure as TeachingApiError
    expect(error.code).toBe('QUESTION_INVALID')
    expect(error.details).toEqual([{ path: 'correctAnswer.optionId', code: 'UNKNOWN_OPTION' }, { path: 'media.optionImages.opt-b', code: 'REQUIRED' }])
  })

  it('keeps an error without details working (empty list)', () => {
    expect(new TeachingApiError(409, 'x', 'VERSION_CONFLICT').details).toEqual([])
  })

  it('maps server paths onto editor fields', () => {
    const content = { ...contentForType('PICTURE_CHOICE', { topicId: 't' }) }
    const second = content.options![1]!.id
    const error = new TeachingApiError(422, 'bad', 'QUESTION_INVALID', null, [{ path: `media.optionImages.${second}`, code: 'REQUIRED' }, { path: 'prompt', code: 'REQUIRED' }])
    const issues = serverIssues(error, content)!
    expect(issues.map(issue => issue.path)).toEqual(['options.1.image', 'prompt'])
    expect(issues[1]!.message).toBe('This is required.')
    expect(serverIssues(new TeachingApiError(409, 'x'), content)).toBeNull()
  })

  it('has reasons for the worksheet codes the platform sends', () => {
    for (const code of ['NOT_PUBLISHED', 'WORKSHEET_NOT_DRAFT', 'WORKSHEET_EMPTY', 'WORKSHEET_ITEMS_UNAVAILABLE', 'VERSION_CONFLICT']) expect(worksheetErrorText[code]).toBeTruthy()
  })
})

describe('worksheet builder reads GET /worksheets/:id', () => {
  it('loads one worksheet with enriched rows, no list and no render', async () => {
    const server = createMockWorksheets('default'); const log: { suffix: string; method: string }[] = []
    holder.request = (async (suffix: string, method: string = 'GET', body?: unknown, headers: Record<string, string> = {}) => {
      log.push({ suffix, method })
      const [path = '', search = ''] = suffix.split('?')
      const result = server.handle(method, path, new URLSearchParams(search), body as Record<string, unknown>, headers)
      if (result.status >= 400) throw new TeachingApiError(result.status, 'failed', (result.body as { code?: string }).code ?? null)
      return (result.body as { data: unknown }).data
    }) as typeof holder.request
    renderWorksheets(<WorksheetBuilder planId="plan-fractions" worksheetId="ws-draft" />)
    expect(await screen.findAllByTestId('wsb-item')).toHaveLength(2)
    await waitFor(() => expect(screen.getAllByTestId('wsb-item')[0]).toHaveTextContent('What is 3/8 + 2/8?'))
    expect(log.some(entry => entry.suffix === '/worksheets/ws-draft' && entry.method === 'GET')).toBe(true)
    expect(log.some(entry => entry.suffix === '/plans/plan-fractions/worksheets')).toBe(false)
    expect(log.some(entry => entry.suffix.includes('/render'))).toBe(false)
  })
})

describe('recent Co drafts', () => {
  it('lists the plan batches (newest first) with links into their review queues', async () => {
    const log: LogEntry[] = []; const server = createMockQuestions('default'); holder.request = requestFor(server, log) as typeof holder.request
    server.handle('POST', '/plans/plan-fractions/questions/co-drafts', new URLSearchParams(), { topicId: 'topic-add', materialIds: ['mat-pdf'], count: 4, types: ['MCQ'], difficulty: null }, { 'Idempotency-Key': 'key-12345678' })
    renderWithQuery(<QuestionBankList initialPlanId="plan-fractions" />)
    const section = await screen.findByTestId('recent-co-drafts')
    const rows = within(section).getAllByTestId('recent-co-draft')
    expect(rows.length).toBeGreaterThanOrEqual(2) // the seeded fixture batch and the one just queued
    expect(rows[0]).toHaveTextContent('Adding fractions')
    expect(within(rows[0]!).getByRole('button')).toHaveAttribute('href', expect.stringMatching(/^\/teacher\/questions\/review\/batch-/))
    expect(log.some(entry => entry.suffix === '/plans/plan-fractions/questions/co-drafts' && entry.method === 'GET')).toBe(true)
  })

  it('is hidden when no plan is chosen', async () => {
    holder.request = requestFor(createMockQuestions('default'), []) as typeof holder.request
    renderWithQuery(<QuestionBankList />)
    await screen.findByTestId('question-table')
    expect(screen.queryByTestId('recent-co-drafts')).toBeNull()
  })
})
