import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, configure, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
const mocks = vi.hoisted(() => ({ config: vi.fn(), list: vi.fn(), detail: vi.fn(), import: vi.fn(), bulk: vi.fn(), retry: vi.fn(), cancel: vi.fn() }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { id: 'learner-a' } } }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }))
vi.mock('@/lib/api/materials', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/api/materials')>(), materialApi: mocks }))
import { materialConfigSchema, materialSchema } from '@/lib/api/materials'
import { MaterialLibrary } from '@/components/materials/material-library'
import { MaterialReader } from '@/components/materials/material-reader'

const config = {
  enabled: true, band: 'teens', sources: [{ type: 'text', label: 'Pasted text', available: true, reason: null }],
  limits: { maxFiles: 3, maxPages: 3, maxBytes: 2000000, maxTextLength: 10000, dailyLimit: 5, usedToday: 2 }, subjects: [{ id: 'subject-a', name: 'Science' }], plans: [], faceRedaction: { verified: false }, lessonsAvailable: true, practiceAvailable: false,
}
const raw = {
  id: 'material-a', title: 'Water source', sourceType: 'text', subjectId: 'subject-a', subjectName: 'Science', planId: null, planTitle: null, createdAt: '2026-10-15T00:00:00Z', updatedAt: '2026-10-15T00:00:00Z',
  status: 'ready', stage: 'ready', progress: 100, jobId: 'job-a', sourceVersionRef: 'source-v1', concepts: [{ id: 'c', label: 'Evaporation' }], error: null,
  links: { reader: '/learn/library/material-a', lesson: null, practice: null }, actions: { retry: false, cancel: false, delete: true, addToPlan: true },
}
const parse = (links: unknown) => materialSchema.parse({ ...raw, links })
const show = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)
beforeEach(() => { configure({ asyncUtilTimeout: 5000 }); vi.clearAllMocks(); mocks.config.mockResolvedValue(config) })
afterEach(() => { cleanup(); configure({ asyncUtilTimeout: 1000 }) })

describe('B08 material schema carries the lesson link and the server reason', () => {
  it('keeps the 0.4.0 shape: a local route or null', () => {
    expect(parse({ reader: '/learn/library/material-a', lesson: null, practice: null }).links).toMatchObject({ lesson: null, lessonDisabledReason: null })
    expect(parse({ reader: null, lesson: '/learn/lesson/new?materialId=material-a', practice: null }).links.lesson).toBe('/learn/lesson/new?materialId=material-a')
    expect(materialSchema.safeParse({ ...raw, links: { reader: null, lesson: 'https://evil.test/x', practice: null } }).success).toBe(false)
    expect(materialSchema.safeParse({ ...raw, links: { reader: null, lesson: '/dashboard', practice: null } }).success).toBe(false)
  })
  it('turns an enabled actionable lesson link into the real start route and a disabled one into its reason', () => {
    const enabled = parse({ reader: null, practice: null, lesson: { link: { route: 'LESSON', id: 'material-a', planItemId: 'item-1' }, enabled: true, disabledReason: null } })
    expect(enabled.links.lesson).toBe('/learn/lesson/new?materialId=material-a&planItemId=item-1')
    const disabled = parse({ reader: null, practice: null, lesson: { link: { route: 'LESSON', id: 'material-a' }, enabled: false, disabledReason: 'Lessons are paused until tomorrow.' } })
    expect(disabled.links.lesson).toBeNull()
    expect(disabled.links).toMatchObject({ lessonDisabledReason: 'Lessons are paused until tomorrow.' })
    // An id that could escape the route is never turned into a link.
    expect(parse({ reader: null, practice: null, lesson: { link: { route: 'LESSON', id: '../admin' }, enabled: true, disabledReason: null } }).links.lesson).toBeNull()
  })
  it('accepts lessonsAvailable true when the server says lessons really work', () => {
    expect(materialConfigSchema.safeParse(config).success).toBe(true)
    expect(materialConfigSchema.safeParse({ ...config, lessonsAvailable: false }).success).toBe(true)
    // B09 shipped: the server reports practiceAvailable true once practice is enabled for the school (the old literal-false schema broke the whole library).
    expect(materialConfigSchema.safeParse({ ...config, practiceAvailable: true }).success).toBe(true)
  })
})

describe('Start lesson in the library and reader', () => {
  it('shows Start lesson only when the server link is present and enabled', async () => {
    const enabled = parse({ reader: '/learn/library/material-a', lesson: '/learn/lesson/new?materialId=material-a', practice: null })
    mocks.list.mockResolvedValue({ items: [enabled], total: 1, page: 1, limit: 20 })
    show(<MaterialLibrary />)
    const card = (await screen.findByRole('heading', { name: 'Water source' })).closest('div')!.parentElement!
    expect(within(card).getByRole('link', { name: 'Start lesson' })).toHaveAttribute('href', '/learn/lesson/new?materialId=material-a')
    expect(within(card).queryByTestId('lesson-unavailable')).not.toBeInTheDocument()
  })
  it('shows the server reason instead of a working-looking control when lessons are disabled', async () => {
    const disabled = parse({ reader: '/learn/library/material-a', practice: null, lesson: { link: { route: 'LESSON', id: 'material-a' }, enabled: false, disabledReason: 'Lessons are paused until tomorrow.' } })
    mocks.list.mockResolvedValue({ items: [disabled], total: 1, page: 1, limit: 20 })
    show(<MaterialLibrary />)
    expect(await screen.findByTestId('lesson-unavailable')).toHaveTextContent('Lessons are paused until tomorrow.')
    expect(screen.queryByRole('link', { name: 'Start lesson' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start lesson' })).not.toBeInTheDocument()
  })
  it('says nothing about lessons when the server gave no link and no reason (as before B08)', async () => {
    mocks.list.mockResolvedValue({ items: [parse(raw.links)], total: 1, page: 1, limit: 20 })
    show(<MaterialLibrary />)
    await screen.findByRole('heading', { name: 'Water source' })
    expect(screen.queryByRole('link', { name: 'Start lesson' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('lesson-unavailable')).not.toBeInTheDocument()
  })
  it('the reader offers Start lesson, or the reason, or the earlier explanation', async () => {
    mocks.detail.mockResolvedValue({ ...parse({ reader: null, practice: null, lesson: '/learn/lesson/new?materialId=material-a' }), source: { text: 'Water cycles.', anchors: [] }, analysis: null })
    show(<MaterialReader id="material-a" />)
    expect(await screen.findByRole('link', { name: 'Start lesson' })).toHaveAttribute('href', '/learn/lesson/new?materialId=material-a')
    cleanup()
    mocks.detail.mockResolvedValue({ ...parse({ reader: null, practice: null, lesson: { link: null, enabled: false, disabledReason: 'Your family settings do not allow lessons.' } }), source: { text: 'Water cycles.', anchors: [] }, analysis: null })
    show(<MaterialReader id="material-a" />)
    expect(await screen.findByTestId('lesson-unavailable')).toHaveTextContent('Your family settings do not allow lessons.')
    cleanup()
    mocks.detail.mockResolvedValue({ ...parse(raw.links), source: { text: 'Water cycles.', anchors: [] }, analysis: null })
    show(<MaterialReader id="material-a" />)
    expect(await screen.findByTestId('lesson-unavailable')).toHaveTextContent('does not create a lesson or practice activity')
  })
})
