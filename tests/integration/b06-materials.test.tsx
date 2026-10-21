import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
const mocks = vi.hoisted(() => ({ config: vi.fn(), list: vi.fn(), detail: vi.fn(), import: vi.fn(), bulk: vi.fn(), retry: vi.fn(), cancel: vi.fn(), push: vi.fn(), search: '' }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { id: 'learner-a' } } }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }), useSearchParams: () => new URLSearchParams(mocks.search) }))
vi.mock('@/lib/api/materials', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/api/materials')>()
  return { ...original, materialApi: mocks }
})
import { MaterialLibrary } from '@/components/materials/material-library'
import { MaterialImport } from '@/components/materials/material-import'
import { MaterialReader } from '@/components/materials/material-reader'
import { PageCamera } from '@/components/materials/page-camera'

const config = {
  enabled: true, band: 'teens', sources: [{ type: 'text', label: 'Pasted text', available: true, reason: null }, { type: 'image', label: 'Photo', available: false, reason: 'Image reading and face redaction are unavailable.' }],
  limits: { maxFiles: 3, maxPages: 3, maxBytes: 2000000, maxTextLength: 10000, dailyLimit: 5, usedToday: 2 }, subjects: [{ id: 'subject-a', name: 'Science' }], plans: [{ id: 'plan-a', title: 'My science plan' }], faceRedaction: { verified: false }, lessonsAvailable: false, practiceAvailable: false,
}
const item = {
  id: 'material-a', title: 'Water source', sourceType: 'text', subjectId: 'subject-a', subjectName: 'Science', planId: null, planTitle: null, createdAt: '2026-10-15T00:00:00Z', updatedAt: '2026-10-15T00:00:00Z', status: 'ready', stage: 'ready', progress: 100, jobId: 'job-a', sourceVersionRef: 'source-v1', concepts: [{ id: 'concept-a', label: 'Evaporation' }], error: null, links: { reader: '/learn/library/material-a', lesson: null, practice: null }, actions: { retry: false, cancel: false, delete: true, addToPlan: true }, source: { text: 'The source water text.', anchors: [] }, analysis: null,
}
function show(component: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}>{component}</QueryClientProvider>)
}
beforeEach(() => {
  configure({ asyncUtilTimeout: 10000 })
  vi.clearAllMocks(); mocks.search = ''
  mocks.config.mockResolvedValue(config)
  mocks.list.mockResolvedValue({ items: [item], total: 1, page: 1, limit: 20 })
  mocks.detail.mockResolvedValue(item)
  mocks.bulk.mockResolvedValue({ updatedIds: [item.id] })
  mocks.import.mockResolvedValue({ items: [item] })
})
afterEach(() => { cleanup(); configure({ asyncUtilTimeout: 1000 }) })

describe('B06 library and durable import UI', () => {
  it('renders actual metadata and filters, then performs only permitted bulk actions', async () => {
    show(<MaterialLibrary />)
    await screen.findByRole('heading', { name: 'Water source' })
    expect(screen.queryByRole('link', { name: 'Start lesson' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Search your library'), { target: { value: 'Water' } })
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Water', page: 1 })))
    fireEvent.click(await screen.findByLabelText('Select Water source'))
    fireEvent.change(screen.getByLabelText('Plan for selected material'), { target: { value: 'plan-a' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add to plan' }))
    await waitFor(() => expect(mocks.bulk).toHaveBeenCalledWith('addToPlan', ['material-a'], 'plan-a'))
  })
  it('asks for a concrete delete confirmation and does not offer protected selection', async () => {
    mocks.list.mockResolvedValue({ items: [item, { ...item, id: 'shared', title: 'Assigned shared source', actions: { retry: false, cancel: false, delete: false, addToPlan: false } }], total: 2, page: 1, limit: 20 })
    show(<MaterialLibrary />)
    await screen.findByRole('heading', { name: 'Water source' })
    expect(screen.queryByLabelText('Select Assigned shared source')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Select Water source'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }))
    expect(mocks.bulk).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))
    await waitFor(() => expect(mocks.bulk).toHaveBeenCalledWith('delete', ['material-a'], undefined))
  })
  it('shows source locks and keeps a failed text draft with the same idempotency key', async () => {
    mocks.import.mockRejectedValue(new Error('Temporarily unavailable'))
    show(<MaterialImport />)
    await screen.findByLabelText('Material title')
    fireEvent.click(screen.getByRole('button', { name: /Photo/ }))
    expect(screen.getByRole('button', { name: 'Read this material' })).toBeDisabled()
    expect(screen.getAllByText(/Image reading and face redaction are unavailable/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Pasted text' }))
    fireEvent.change(screen.getByLabelText('Material title'), { target: { value: 'Water source' } })
    fireEvent.change(screen.getByLabelText('Add to subject'), { target: { value: 'subject-a' } })
    fireEvent.change(screen.getByLabelText(/Paste the source text/), { target: { value: 'Water evaporates.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Read this material' }))
    await screen.findByText('Temporarily unavailable')
    const first = mocks.import.mock.calls[0]?.[0]
    expect(screen.getByLabelText(/Paste the source text/)).toHaveValue('Water evaporates.')
    fireEvent.click(screen.getByRole('button', { name: 'Read this material' }))
    await waitFor(() => expect(mocks.import).toHaveBeenCalledTimes(2))
    expect(mocks.import.mock.calls[1]?.[0].idempotencyKey).toBe(first.idempotencyKey)
  })
  it('returns to saved jobs by URL, polls server state and never calls the import again', async () => {
    mocks.search = 'material=material-a'
    mocks.detail.mockResolvedValue({ ...item, status: 'processing', stage: 'concepts', progress: 60, actions: { ...item.actions, cancel: true } })
    mocks.cancel.mockResolvedValue({ ...item, status: 'cancelled', stage: 'cancelled' })
    show(<MaterialImport />)
    await screen.findByText('Finding key ideas')
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '60')
    expect(mocks.import).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel processing' }))
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledWith('material-a'))
  })
  it('shows source text separately and blocks a revoked reader', async () => {
    show(<MaterialReader id="material-a" />)
    await screen.findByText('The source water text.')
    expect(screen.getByText('Evaporation')).toBeInTheDocument()
    cleanup()
    mocks.detail.mockRejectedValue(new Error('This material is unavailable or you no longer have access.'))
    show(<MaterialReader id="material-a" />)
    await screen.findByRole('alert')
    expect(screen.queryByText('The source water text.')).not.toBeInTheDocument()
  })
  it('explains camera permission denial and keeps an upload fallback with truthful safety copy', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')) } })
    show(<PageCamera band="tweens" maxPages={3} maxBytes={2000000} faceRedactionVerified={false} submitting={false} unavailableReason="Image processor unavailable." onSubmit={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open camera' }))
    await screen.findByText(/Camera permission was denied/)
    expect(screen.getByText(/Automatic face blurring is unavailable/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Upload a photo instead/)).toBeInTheDocument()
  })
})
