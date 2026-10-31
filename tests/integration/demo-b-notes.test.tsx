import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), config: vi.fn(), materials: vi.fn() }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { id: 'learner-a' } } }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/learn/notes', useSearchParams: () => new URLSearchParams() }))
vi.mock('@/lib/api/notes', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/api/notes')>()
  return { ...original, notesApi: { list: mocks.list, create: mocks.create, update: mocks.update, remove: mocks.remove } }
})
vi.mock('@/lib/api/materials', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/api/materials')>()
  return { ...original, materialApi: { ...original.materialApi, config: mocks.config, list: mocks.materials } }
})

import { LearnIdentityProvider } from '@/components/learn/learn-common'
import { SaveToNotesButton } from '@/components/notes/save-to-notes-button'
import { MaterialNotesPanel } from '@/components/notes/material-notes-panel'
import { MyPages } from '@/components/notes/my-pages'
import { CoReplyCard } from '@/components/co/co-reply'
import { LearnApiError } from '@/lib/api/learn-request'
import { sourcedReply, safetyReply, turnFixture } from '@/components/co/dev/co-fixtures'
import { fitNote, type StudyNote } from '@/lib/api/notes'
import { studentNavigation } from '@/components/roles/role-config'

const note = (over: Partial<StudyNote> = {}): StudyNote => ({
  id: 'n1', materialId: 'material-a', kind: 'NOTE', title: 'Photosynthesis', body: 'Plants turn light into sugar.', conceptRef: null, sourceAnchorRef: null,
  createdAt: '2026-10-28T10:00:00Z', updatedAt: '2026-10-28T10:00:00Z', ...over,
})
function show(ui: React.ReactNode, band: 'kids' | 'tweens' | 'teens' | null = null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><LearnIdentityProvider scope="learner-a" band={band}>{ui}</LearnIdentityProvider></QueryClientProvider>)
}
beforeEach(() => {
  configure({ asyncUtilTimeout: 6000 })
  vi.clearAllMocks()
  mocks.list.mockResolvedValue({ items: [note(), note({ id: 'n2', kind: 'CO_ANSWER', title: 'What is a leaf?', body: 'A leaf catches light.' })] })
  mocks.create.mockImplementation(async input => note({ id: 'new', ...input }))
  mocks.update.mockImplementation(async (id: string, changes: object) => note({ id, ...changes }))
  mocks.remove.mockResolvedValue(undefined)
  mocks.config.mockResolvedValue({ band: 'teens', subjects: [], plans: [] })
  mocks.materials.mockResolvedValue({ items: [{ id: 'material-a', title: 'Biology chapter 4' }], total: 1, page: 1, limit: 20 })
})
afterEach(() => { cleanup(); configure({ asyncUtilTimeout: 1000 }) })

describe('notes api helpers', () => {
  it('fits a long title and body to the server limits', () => {
    const fitted = fitNote({ kind: 'CO_ANSWER', title: ' '.concat('q'.repeat(300)), body: 'b'.repeat(9000) })
    expect(fitted.title.length).toBe(120)
    expect(fitted.body.length).toBe(8000)
    expect(fitNote({ kind: 'NOTE', title: '   ', body: 'x' }).title).toBe('My page')
  })
  it('puts My pages in the nav for teens and not for the youngest learners', () => {
    const labels = (band: 'kids' | 'teens') => studentNavigation(band, true).flatMap(group => group.items.map(item => item.label))
    expect(labels('teens')).toContain('My pages')
    expect(labels('kids').filter(label => label === 'My pages')).toHaveLength(1) // the kids Library keeps its own name
    expect(studentNavigation('kids', true).flatMap(group => group.items).find(item => item.href === '/learn/notes')).toBeUndefined()
  })
})

describe('SaveToNotesButton', () => {
  it('saves once, then says Saved with a link to My pages', async () => {
    const onSaved = vi.fn()
    show(<SaveToNotesButton materialId="material-a" kind="ANALOGY" title="Like a kitchen" body="A cell is a kitchen." conceptRef="c1" sourceAnchorRef="a1" onSaved={onSaved} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save to my pages' }))
    await screen.findByTestId('save-to-notes-saved')
    expect(mocks.create).toHaveBeenCalledWith({ materialId: 'material-a', kind: 'ANALOGY', title: 'Like a kitchen', body: 'A cell is a kitchen.', conceptRef: 'c1', sourceAnchorRef: 'a1' })
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'new' }))
    expect(screen.getByRole('link', { name: 'Open My pages' })).toHaveAttribute('href', '/learn/notes')
    expect(screen.queryByRole('button', { name: 'Save to my pages' })).not.toBeInTheDocument()
  })
  it('shows a plain retryable message when saving fails and never raw error text', async () => {
    mocks.create.mockRejectedValueOnce(new LearnApiError(503, 'Learning services are unavailable right now. Please try again.'))
    show(<SaveToNotesButton materialId="material-a" kind="NOTE" title="t" body="b" />)
    fireEvent.click(screen.getByRole('button', { name: 'Save to my pages' }))
    expect((await screen.findByTestId('save-to-notes-error')).textContent).toContain('You can try again')
    fireEvent.click(screen.getByRole('button', { name: 'Save to my pages' }))
    await screen.findByTestId('save-to-notes-saved')
    expect(mocks.create).toHaveBeenCalledTimes(2)
  })
  it('is not offered to the youngest learners', () => {
    show(<SaveToNotesButton materialId="material-a" kind="NOTE" title="t" body="b" />, 'kids')
    expect(screen.queryByRole('button', { name: 'Save to my pages' })).not.toBeInTheDocument()
  })
})

describe('MaterialNotesPanel', () => {
  it('lists this material’s pages, adds one, and deletes one after confirming', async () => {
    show(<MaterialNotesPanel materialId="material-a" band="teens" />)
    await screen.findByRole('heading', { name: 'Photosynthesis' })
    expect(mocks.list).toHaveBeenCalledWith({ materialId: 'material-a' })
    fireEvent.click(screen.getByTestId('add-note'))
    fireEvent.change(screen.getByLabelText('Write a page'), { target: { value: 'Chlorophyll is green.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save page' }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ materialId: 'material-a', kind: 'NOTE', title: 'Chlorophyll is green.', body: 'Chlorophyll is green.' }))
    const card = screen.getAllByTestId('note-card')[0]!
    fireEvent.click(within(card).getByRole('button', { name: /Delete/ }))
    expect(mocks.remove).not.toHaveBeenCalled()
    fireEvent.click(within(card).getByRole('button', { name: 'Yes, delete' }))
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith('n1'))
  })
  it('explains in friendly words that pages are for ages 10 and up', () => {
    show(<MaterialNotesPanel materialId="material-a" band="kids" />)
    expect(screen.getByTestId('notes-unavailable').textContent).toContain('ages 10 and up')
    expect(mocks.list).not.toHaveBeenCalled()
  })
})

describe('My pages', () => {
  it('shows pages across materials with a link back to the reader, filters by kind, and edits a page', async () => {
    show(<MyPages />)
    await screen.findByRole('heading', { name: 'Photosynthesis' })
    expect(screen.getAllByTestId('note-card')).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Open Biology chapter 4' })[0]).toHaveAttribute('href', '/learn/library/material-a')
    fireEvent.change(screen.getByLabelText('Kind of page'), { target: { value: 'CO_ANSWER' } })
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith({ kind: 'CO_ANSWER' }))
    fireEvent.change(screen.getByLabelText('Material'), { target: { value: 'material-a' } })
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith({ materialId: 'material-a', kind: 'CO_ANSWER' }))
    const card = (await screen.findAllByTestId('note-card'))[0]!
    fireEvent.click(within(card).getByRole('button', { name: /Edit/ }))
    fireEvent.change(within(card).getByLabelText('Title'), { target: { value: 'Renamed' } })
    fireEvent.click(within(card).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('n1', { title: 'Renamed', body: 'Plants turn light into sugar.' }))
  })
  it('has a themed empty state and a friendly failure with Try again', async () => {
    mocks.list.mockResolvedValueOnce({ items: [] })
    show(<MyPages />)
    await screen.findByText('No pages yet')
    cleanup()
    mocks.list.mockRejectedValueOnce(new LearnApiError(503, 'Learning services are unavailable right now. Please try again.'))
    show(<MyPages />)
    await screen.findByText('Your pages did not open')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
  it('gives the 6-9 band a friendly reason instead of a list', async () => {
    mocks.config.mockResolvedValue({ band: 'kids', subjects: [], plans: [] })
    show(<MyPages />)
    await screen.findByText('My pages are for ages 10 and up')
    expect(mocks.list).not.toHaveBeenCalled()
  })
})

describe('Ask Co reply: Save to my pages', () => {
  const turn = () => turnFixture({ id: 't1', ordinal: 1, learnerText: 'What is a leaf?', reply: sourcedReply('teens', 'EXAM') })
  it('saves the answer as a CO_ANSWER on the material in the library link', async () => {
    show(<CoReplyCard turn={turn()} band="teens" materialHref="/learn/library/material-a" onSuggestion={vi.fn()} canAsk suggestions={false} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Save to my pages' }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
    expect(mocks.create.mock.calls[0]![0]).toMatchObject({ materialId: 'material-a', kind: 'CO_ANSWER', title: 'What is a leaf?' })
    expect(mocks.create.mock.calls[0]![0].body).toContain(sourcedReply('teens', 'EXAM').text)
    expect(mocks.create.mock.calls[0]![0].body).toContain('Key points')
  })
  it('offers no save on a safety message', () => {
    show(<CoReplyCard turn={turnFixture({ id: 't2', ordinal: 2, learnerText: 'x', reply: safetyReply('teens') })} band="teens" materialHref="/learn/library/material-a" onSuggestion={vi.fn()} canAsk suggestions={false} />)
    expect(screen.queryByRole('button', { name: 'Save to my pages' })).not.toBeInTheDocument()
  })
  it('offers no save when there is no material to attach to', () => {
    show(<CoReplyCard turn={turn()} band="teens" materialHref={null} onSuggestion={vi.fn()} canAsk suggestions={false} />)
    expect(screen.queryByRole('button', { name: 'Save to my pages' })).not.toBeInTheDocument()
  })
})
