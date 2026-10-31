import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
const mocks = vi.hoisted(() => ({ config: vi.fn(), detail: vi.fn(), original: vi.fn(), getDocument: vi.fn() }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { id: 'learner-a' } } }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams('') }))
vi.mock('@/components/co/co-launcher', () => ({ AskCoEntry: () => <div data-testid="ask-co-entry" /> }))
vi.mock('@/lib/api/materials', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/api/materials')>()
  return { ...original, materialApi: { config: mocks.config, detail: mocks.detail, original: mocks.original } }
})
vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, getDocument: mocks.getDocument }))
import { MaterialReader } from '@/components/materials/material-reader'
import { MaterialApiError } from '@/lib/api/material-request'

const config = { enabled: true, band: 'teens', sources: [], limits: { maxFiles: 3, maxPages: 3, maxBytes: 2000000, maxTextLength: 10000, dailyLimit: 5, usedToday: 0 }, subjects: [], plans: [], faceRedaction: { verified: false }, lessonsAvailable: true, practiceAvailable: false }
const base = {
  id: 'material-a', title: 'Cell notes', sourceType: 'pdf', subjectId: null, subjectName: 'Science', planId: null, planTitle: null, createdAt: '2026-10-15T00:00:00Z', updatedAt: '2026-10-15T00:00:00Z', status: 'ready', stage: 'ready', progress: 100, jobId: 'job-a', sourceVersionRef: 'v1', concepts: [{ id: 'concept-a', label: 'Mitochondria' }], error: null,
  links: { reader: '/learn/library/material-a', lesson: '/learn/lesson/new?materialId=material-a', practice: null, original: '/api/v1/materials/material-a/original' }, actions: { retry: false, cancel: false, delete: true, addToPlan: true }, source: { text: 'Cells have parts.', anchors: [] }, analysis: null,
}
function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MaterialReader id="material-a" /></QueryClientProvider>)
}
const pdfDoc = { numPages: 3, destroy: vi.fn(), getPage: vi.fn(async () => ({ getViewport: () => ({ width: 10, height: 10 }), render: () => ({ promise: Promise.resolve() }) })) }
beforeEach(() => {
  configure({ asyncUtilTimeout: 10000 })
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn()
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({})) as never
  mocks.config.mockResolvedValue(config)
  mocks.detail.mockResolvedValue(base)
  mocks.original.mockResolvedValue({ blob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }), type: 'application/pdf' })
  mocks.getDocument.mockReturnValue({ promise: Promise.resolve(pdfDoc) })
})
afterEach(() => cleanup())

describe('DEMO-A material reader', () => {
  it('opens a PDF material on the Original tab with page navigation and zoom', async () => {
    show()
    await screen.findByTestId('pdf-viewer')
    expect(screen.getByTestId('reader-tab-original')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('pdf-page-label')).toHaveTextContent('Page 1 of 3')
    fireEvent.click(screen.getByLabelText('Next page'))
    expect(screen.getByTestId('pdf-page-label')).toHaveTextContent('Page 2 of 3')
    fireEvent.click(screen.getByLabelText('Zoom in'))
    expect(screen.getByTestId('pdf-zoom-label')).toHaveTextContent('125%')
    fireEvent.click(screen.getByTestId('reader-tab-text'))
    expect(screen.getByTestId('reader-text')).toHaveTextContent('Cells have parts.')
    fireEvent.click(screen.getByTestId('reader-tab-ideas'))
    expect(screen.getByTestId('reader-ideas')).toHaveTextContent('Mitochondria')
    expect(screen.getByRole('link', { name: 'Start lesson' })).toBeInTheDocument()
  })
  it('hides Original and defaults to Text for non-PDF sources and materials without an original', async () => {
    mocks.detail.mockResolvedValue({ ...base, sourceType: 'docx' })
    show()
    await screen.findByTestId('reader-text')
    expect(screen.queryByTestId('reader-tab-original')).not.toBeInTheDocument()
    expect(mocks.original).not.toHaveBeenCalled()
    cleanup()
    mocks.detail.mockResolvedValue({ ...base, links: { ...base.links, original: null } })
    show()
    await screen.findByTestId('reader-text')
    expect(screen.queryByTestId('reader-tab-original')).not.toBeInTheDocument()
  })
  it('keeps the lesson-unavailable note and shows the study tools rail', async () => {
    mocks.detail.mockResolvedValue({ ...base, sourceType: 'text', links: { ...base.links, lesson: null, original: null } })
    show()
    await screen.findByTestId('lesson-unavailable')
    expect(screen.getByTestId('ask-co-entry')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('rail-tab-notes'))
    expect(screen.getByTestId('rail-tab-notes')).toHaveAttribute('aria-selected', 'true')
  })
  it('shows a friendly unavailable state when the original is gone', async () => {
    mocks.original.mockRejectedValue(new MaterialApiError(404, 'x', 'ORIGINAL_UNAVAILABLE'))
    show()
    await screen.findByTestId('pdf-unavailable')
  })
  it('shows a retryable error and recovers on retry', async () => {
    mocks.original.mockRejectedValueOnce(new MaterialApiError(503, 'x'))
    show()
    const alert = await screen.findByTestId('pdf-error')
    expect(alert).toHaveTextContent('could not be opened')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByTestId('pdf-viewer')
  })
  it('falls back to the browser viewer when pdf.js cannot read the file', async () => {
    mocks.getDocument.mockImplementation(() => ({ promise: Promise.reject(new Error('bad pdf')) }))
    show()
    const frame = await screen.findByTestId('pdf-frame')
    expect(frame).toHaveAttribute('src', 'blob:x')
    await waitFor(() => expect(frame).toBeInTheDocument())
  })
})
