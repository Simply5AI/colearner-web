import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mocks = vi.hoisted(() => ({ config: vi.fn(), list: vi.fn(), detail: vi.fn(), import: vi.fn(), bulk: vi.fn(), retry: vi.fn(), cancel: vi.fn() }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { id: 'learner-a' } } }) }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/learn/lesson/lesson-fixture',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/lib/api/materials', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/api/materials')>(), materialApi: mocks }))

import { LearnIdentityProvider } from '@/components/learn/learn-common'
import { LessonView } from '@/components/lesson/lesson-screen'
import { MaterialReader } from '@/components/materials/material-reader'
import { createCoMock, type MockOptions } from '@/components/co/dev/co-mock'
import { fixtureLessonId, fixtureMaterialId, topics } from '@/components/co/dev/co-fixtures'
import { lessonDetailFixture } from '@/components/lesson/dev/lesson-fixtures'
import { installFakeSpeech, type FakeSpeech } from '@/components/lesson/dev/fake-speech'
import { lessonDetailSchema, type LessonDetail } from '@/lib/api/lesson'
import { materialSchema } from '@/lib/api/materials'
import type { LearnBand } from '@/lib/api/learn'

vi.setConfig({ testTimeout: 40000 })
let speech: FakeSpeech | null = null
beforeEach(() => { configure({ asyncUtilTimeout: 6000 }); vi.clearAllMocks(); document.documentElement.dir = 'ltr' })
afterEach(() => { cleanup(); configure({ asyncUtilTimeout: 1000 }); speech?.restore(); speech = null; vi.unstubAllGlobals() })

const wrap = (ui: React.ReactNode) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
  <LearnIdentityProvider scope="account:learner-a:unselected" band={null}>{ui}</LearnIdentityProvider>
</QueryClientProvider>

/** Answers the Ask Co endpoints with the contract double and everything else (progress writes) with a plain success. */
function stubNetwork(options: Partial<MockOptions> & { band: LearnBand }) {
  const server = createCoMock(options)
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.includes('/api/learn/co/')) return server.fetch(input, init)
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) as { currentStep?: number; revision?: number } : {}
    return new Response(JSON.stringify({ statusCode: 200, data: { progress: { currentStep: body.currentStep ?? 0, completedSteps: [], completedAt: null, revision: (body.revision ?? 0) + 1 } } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))
  return server
}

const detailFor = (band: LearnBand, askCo: LessonDetail['askCo']): LessonDetail => ({ ...lessonDetailFixture(band), askCo })
const view = (detail: LessonDetail) => render(wrap(<LessonView detail={detail} onExit={vi.fn()} retry={{ run: vi.fn(), pending: false, error: null }} cancel={{ run: vi.fn(), pending: false, error: null }} timing={{ debounceMs: 5, retryBaseMs: 600000 }} />))
const askButton = () => screen.getByRole('button', { name: 'Ask Co' })

describe('the lesson schema carries the Ask Co context additively', () => {
  const base = lessonDetailFixture('teens')
  it('accepts AVAILABLE with a null reason and a lesson context', () => {
    const parsed = lessonDetailSchema.safeParse({ ...base, askCo: { status: 'AVAILABLE', reason: null, context: { kind: 'LESSON', lessonId: 'lesson-fixture' } } })
    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data.askCo.context).toEqual({ kind: 'LESSON', lessonId: 'lesson-fixture' })
  })
  it('still accepts the B08 shapes: UNAVAILABLE with a reason, and no context at all', () => {
    expect(lessonDetailSchema.safeParse({ ...base, askCo: { status: 'UNAVAILABLE', reason: 'Ask Co is not switched on yet.' } }).success).toBe(true)
    expect(lessonDetailSchema.safeParse({ ...base, askCo: { status: 'UNAVAILABLE' } }).success).toBe(true)
  })
  it('refuses a context for another kind of thing', () => {
    expect(lessonDetailSchema.safeParse({ ...base, askCo: { status: 'AVAILABLE', context: { kind: 'MATERIAL', lessonId: 'x' } } }).success).toBe(false)
  })
})

describe.each(['kids', 'tweens', 'teens'] as const)('F-L8-01 Ask Co in the lesson player, %s band', band => {
  const available: LessonDetail['askCo'] = { status: 'AVAILABLE', reason: null, context: { kind: 'LESSON', lessonId: fixtureLessonId } }

  it('is a real control only when the server says AVAILABLE, and opens the panel for this lesson at this step', async () => {
    const server = stubNetwork({ band })
    view(detailFor(band, available))
    const button = askButton()
    expect(button).not.toHaveAttribute('aria-disabled')
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')
    button.focus()
    fireEvent.click(button)
    const dialog = await screen.findByRole('dialog', { name: 'Ask Co' })
    await within(dialog).findByTestId('co-empty')
    expect(server.calls[0]!.path).toBe(`/co/context?lessonId=${fixtureLessonId}&stepIndex=0`)
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: topics[band].question } })
    fireEvent.click(within(dialog).getByRole('button', { name: band === 'kids' ? 'Ask' : 'Send' }))
    await within(dialog).findByTestId('co-reply')
    expect(server.calls.find(call => call.path === '/co/conversations')!.body).toEqual({ context: { kind: 'LESSON', lessonId: fixtureLessonId, stepIndex: 0 } })
    expect(server.calls.find(call => call.path.endsWith('/turns') && call.method === 'POST')!.body).toMatchObject({ stepIndex: 0 })
    // Source chips go back to the library item of this lesson's material.
    expect(within(within(dialog).getByTestId('co-sources')).getByRole('link')).toHaveAttribute('href', `/learn/library/${fixtureMaterialId}`)
    // Closing returns focus to the control that opened it.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close Ask Co' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(button).toHaveFocus())
  })

  it('asks about the step the learner is on', async () => {
    const server = stubNetwork({ band })
    view(detailFor(band, available))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByRole('img', { name: 'Step 2 of 5' })
    fireEvent.click(askButton())
    await screen.findByRole('dialog', { name: 'Ask Co' })
    await waitFor(() => expect(server.calls.some(call => call.path === `/co/context?lessonId=${fixtureLessonId}&stepIndex=1`)).toBe(true))
  })

  it('uses the lesson itself when the server sent no context', async () => {
    const server = stubNetwork({ band })
    view(detailFor(band, { status: 'AVAILABLE' }))
    fireEvent.click(askButton())
    await screen.findByRole('dialog', { name: 'Ask Co' })
    await waitFor(() => expect(server.calls[0]?.path).toBe(`/co/context?lessonId=${fixtureLessonId}&stepIndex=0`))
  })

  it('the "/" shortcut opens it, and while it is open Esc and the arrows belong to the panel, not the lesson', async () => {
    stubNetwork({ band })
    view(detailFor(band, available))
    fireEvent.keyDown(window, { key: '/' })
    const dialog = await screen.findByRole('dialog', { name: 'Ask Co' })
    await within(dialog).findByRole('textbox')
    // The lesson underneath does not move or ask to leave.
    fireEvent.keyDown(dialog, { key: 'ArrowRight' })
    expect(screen.queryByRole('dialog', { name: 'Leave this lesson?' })).toBeNull()
    expect(document.body.textContent).toContain('Step 1 of 5')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.queryByRole('dialog', { name: 'Leave this lesson?' })).toBeNull()
  })

  it('stops the lesson read-aloud when Ask Co opens', async () => {
    speech = installFakeSpeech({ autoplayMs: null })
    stubNetwork({ band })
    view(detailFor(band, available))
    fireEvent.click(await screen.findByRole('button', { name: band === 'kids' ? 'Read to me' : 'Listen' }))
    expect(speech.current()).not.toBeNull()
    fireEvent.click(askButton())
    await screen.findByRole('dialog', { name: 'Ask Co' })
    expect(speech.current()).toBeNull()
  })

  it('keeps the disabled control and the server reason when Ask Co is UNAVAILABLE', async () => {
    const server = stubNetwork({ band })
    view(detailFor(band, { status: 'UNAVAILABLE', reason: 'Your school has not switched on Ask Co yet.' }))
    const button = askButton()
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAccessibleDescription('Your school has not switched on Ask Co yet.')
    fireEvent.click(button)
    fireEvent.keyDown(window, { key: '/' })
    expect(button).toHaveFocus()
    expect(screen.queryByRole('dialog', { name: 'Ask Co' })).toBeNull()
    expect(server.calls).toHaveLength(0)
  })
})

describe('F-L8-01 Ask Co in the library item (reader)', () => {
  const config = {
    enabled: true, band: 'tweens', sources: [{ type: 'text', label: 'Pasted text', available: true, reason: null }],
    limits: { maxFiles: 3, maxPages: 3, maxBytes: 2000000, maxTextLength: 10000, dailyLimit: 5, usedToday: 2 }, subjects: [{ id: 'subject-a', name: 'Science' }], plans: [], faceRedaction: { verified: false }, lessonsAvailable: true, practiceAvailable: false,
  }
  const raw = {
    id: fixtureMaterialId, title: 'Water source', sourceType: 'text', subjectId: 'subject-a', subjectName: 'Science', planId: null, planTitle: null, createdAt: '2026-10-15T00:00:00Z', updatedAt: '2026-10-15T00:00:00Z',
    status: 'ready', stage: 'ready', progress: 100, jobId: 'job-a', sourceVersionRef: 'source-v1', concepts: [{ id: 'c', label: 'Evaporation' }], error: null,
    links: { reader: `/learn/library/${fixtureMaterialId}`, lesson: null, practice: null }, actions: { retry: false, cancel: false, delete: true, addToPlan: true },
  }
  const open = (status: 'ready' | 'processing' = 'ready') => {
    mocks.config.mockResolvedValue(config)
    mocks.detail.mockResolvedValue({ ...materialSchema.parse({ ...raw, status, stage: status === 'ready' ? 'ready' : 'reading' }), source: { text: 'Water cycles.', anchors: [] }, analysis: null })
    return render(wrap(<MaterialReader id={fixtureMaterialId} />))
  }

  it('offers Ask Co about the material when the context says it is available, and opens the panel on that material', async () => {
    const server = stubNetwork({ band: 'tweens' })
    open()
    const entry = await screen.findByTestId('ask-co-entry')
    expect(server.calls[0]!.path).toBe(`/co/context?materialId=${fixtureMaterialId}`)
    fireEvent.click(within(entry).getByRole('button', { name: 'Ask Co' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ask Co' })
    await within(dialog).findByRole('textbox')
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: topics.tweens.question } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send' }))
    await within(dialog).findByTestId('co-reply')
    expect(server.calls.find(call => call.path === '/co/conversations')!.body).toEqual({ context: { kind: 'MATERIAL', materialId: fixtureMaterialId } })
    // The page keeps its own lesson text untouched.
    expect(screen.getByTestId('lesson-unavailable')).toBeInTheDocument()
  })

  it('shows the server reason, not a working control, when Ask Co is not available', async () => {
    stubNetwork({ band: 'tweens', state: 'disabled' })
    open()
    const control = await screen.findByTestId('ask-co-unavailable')
    expect(control).toHaveTextContent('Your school or family settings do not allow Ask Co right now.')
    expect(within(control).getByRole('button', { name: 'Ask Co' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('adds nothing when the context cannot be read, and asks nothing for a material that is still being read', async () => {
    const server = stubNetwork({ band: 'tweens', state: 'unreachable' })
    open()
    await screen.findByRole('tablist', { name: 'Material views' })
    await waitFor(() => expect(server.calls.length).toBeGreaterThan(0))
    await new Promise(resolve => setTimeout(resolve, 40))
    expect(screen.queryByTestId('ask-co-entry')).toBeNull()
    expect(screen.queryByTestId('ask-co-unavailable')).toBeNull()
    cleanup()
    const other = stubNetwork({ band: 'tweens' })
    open('processing')
    await screen.findByRole('tablist', { name: 'Material views' })
    await new Promise(resolve => setTimeout(resolve, 40))
    expect(other.calls).toHaveLength(0)
    expect(screen.queryByTestId('ask-co-entry')).toBeNull()
  })
})
