import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mocks = vi.hoisted(() => ({ create: vi.fn(), noteCreate: vi.fn() }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { id: 'learner-a' } } }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/learn/library/m1', useSearchParams: () => new URLSearchParams() }))
vi.mock('@/lib/api/analogies', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/api/analogies')>()
  return { ...original, analogiesApi: { create: mocks.create }, actualApi: original.analogiesApi }
})
vi.mock('@/lib/api/notes', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/api/notes')>()
  return { ...original, notesApi: { ...original.notesApi, create: mocks.noteCreate } }
})

import { AnalogyPanel } from '@/components/analogy/analogy-panel'
import { LearnIdentityProvider } from '@/components/learn/learn-common'
import { LearnApiError } from '@/lib/api/learn-request'
// @ts-expect-error actualApi exists only in the test mock
import { actualApi as realApi, analogyFailureMessage, analogyNoteBody, type AnalogyCard } from '@/lib/api/analogies'

const concepts = [{ ref: 'c1', label: 'Chlorophyll' }, { ref: 'c2', label: 'Photosynthesis' }]
const card: AnalogyCard = {
  title: 'Chlorophyll is a sun catcher',
  analogy: 'A leaf is like a kitchen that runs on sunshine.',
  howItMaps: [{ part: 'The cook', mapsTo: 'Chlorophyll' }, { part: 'The kitchen', mapsTo: 'The leaf' }],
  whereItBreaks: 'A cook decides what to make. Chlorophyll does not decide.',
  sourceQuote: 'Chlorophyll in the leaves absorbs sunlight.',
  sourceAnchorRef: 'a2',
}
function show(band: 'kids' | 'tweens' | 'teens' = 'teens', list = concepts) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><LearnIdentityProvider scope="learner-a" band={band}><AnalogyPanel materialId="m1" band={band} concepts={list} /></LearnIdentityProvider></QueryClientProvider>)
}
const choose = (ref: string) => fireEvent.change(screen.getByTestId('analogy-concept'), { target: { value: ref } })
beforeEach(() => {
  configure({ asyncUtilTimeout: 6000 })
  vi.clearAllMocks()
  mocks.noteCreate.mockImplementation(async input => ({ id: 'n1', ...input, createdAt: '', updatedAt: '' }))
})
afterEach(() => { cleanup(); configure({ asyncUtilTimeout: 1000 }) })

describe('AnalogyPanel', () => {
  it('needs an idea before it asks, then shows the card with every part', async () => {
    mocks.create.mockResolvedValue({ status: 'READY', analogy: card, conceptRef: 'c1' })
    show()
    const button = screen.getByRole('button', { name: /Explain with an analogy/ })
    expect(button).toBeDisabled()
    choose('c1')
    fireEvent.click(button)
    await screen.findByTestId('analogy-result')
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ materialId: 'm1', conceptRef: 'c1', conceptLabel: 'Chlorophyll', ageBand: '14-17', requestId: expect.any(String) }))
    expect(screen.getByTestId('analogy-title')).toHaveTextContent('Chlorophyll is a sun catcher')
    expect(screen.getByTestId('analogy-text')).toHaveTextContent('kitchen that runs on sunshine')
    expect(screen.getByTestId('analogy-maps')).toHaveTextContent('The cook')
    expect(screen.getByTestId('analogy-maps')).toHaveTextContent('Chlorophyll')
    expect(screen.getByTestId('analogy-breaks')).toHaveTextContent('Chlorophyll does not decide')
    expect(screen.getByTestId('analogy-quote')).toHaveTextContent('Chlorophyll in the leaves absorbs sunlight.')
  })

  it('shows a Co-themed loading state while the call runs', async () => {
    let finish: (value: unknown) => void = () => undefined
    mocks.create.mockReturnValue(new Promise(resolve => { finish = resolve }))
    show('tweens')
    choose('c2')
    fireEvent.click(screen.getByRole('button', { name: /Explain with an analogy/ }))
    expect(await screen.findByTestId('analogy-loading')).toHaveTextContent('Co is thinking')
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ ageBand: '10-13' }))
    finish({ status: 'READY', analogy: card, conceptRef: 'c2' })
    await screen.findByTestId('analogy-result')
    expect(screen.queryByTestId('analogy-loading')).toBeNull()
  })

  it('shows friendly copy for a retryable failure (never server text) and retries with a new request', async () => {
    mocks.create.mockResolvedValueOnce({ status: 'FAILED', code: 'invalid_output', retryable: true, message: 'RAW MODEL TEXT deepseek 502' })
    mocks.create.mockResolvedValueOnce({ status: 'READY', analogy: card, conceptRef: 'c1' })
    show()
    choose('c1')
    fireEvent.click(screen.getByRole('button', { name: /Explain with an analogy/ }))
    const failed = await screen.findByTestId('analogy-failed')
    expect(failed).toHaveTextContent(analogyFailureMessage('invalid_output'))
    expect(failed.textContent).not.toMatch(/RAW|deepseek|502/)
    fireEvent.click(screen.getByTestId('analogy-retry'))
    await screen.findByTestId('analogy-result')
    expect(mocks.create).toHaveBeenCalledTimes(2)
    const [first, second] = mocks.create.mock.calls.map(call => call[0].requestId)
    expect(first).not.toBe(second)
  })

  it('offers no retry for a refusal and a request the server turned down shows safe copy', async () => {
    mocks.create.mockResolvedValueOnce({ status: 'FAILED', code: 'insufficient_source', retryable: false })
    show()
    choose('c1')
    fireEvent.click(screen.getByRole('button', { name: /Explain with an analogy/ }))
    await screen.findByTestId('analogy-failed')
    expect(screen.queryByTestId('analogy-retry')).toBeNull()
    expect(screen.getByTestId('analogy-failed')).toHaveTextContent('enough about this idea')
    mocks.create.mockRejectedValueOnce(new LearnApiError(403, 'Your school or family has switched this off for now. Ask a grown-up if you have a question.', 'CO_DISABLED_BY_POLICY'))
    choose('c2')
    fireEvent.click(screen.getByRole('button', { name: /Explain with an analogy/ }))
    await waitFor(() => expect(screen.getByTestId('analogy-failed')).toHaveTextContent('switched this off'))
    expect(screen.queryByTestId('analogy-retry')).toBeNull()
  })

  it('saves the card to My pages as an ANALOGY with the idea and source anchor', async () => {
    mocks.create.mockResolvedValue({ status: 'READY', analogy: card, conceptRef: 'c1' })
    show()
    choose('c1')
    fireEvent.click(screen.getByRole('button', { name: /Explain with an analogy/ }))
    await screen.findByTestId('analogy-result')
    fireEvent.click(screen.getByRole('button', { name: 'Save to my pages' }))
    await screen.findByTestId('save-to-notes-saved')
    expect(mocks.noteCreate).toHaveBeenCalledWith(expect.objectContaining({ materialId: 'm1', kind: 'ANALOGY', title: 'Chlorophyll is a sun catcher', conceptRef: 'c1', sourceAnchorRef: 'a2', body: analogyNoteBody(card) }))
  })

  it('does not offer saving to the youngest learners but still explains', async () => {
    mocks.create.mockResolvedValue({ status: 'READY', analogy: card, conceptRef: 'c1' })
    show('kids')
    choose('c1')
    fireEvent.click(screen.getByRole('button', { name: /Explain with an analogy/ }))
    await screen.findByTestId('analogy-result')
    expect(screen.queryByRole('button', { name: 'Save to my pages' })).toBeNull()
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ ageBand: '6-9' }))
  })

  it('tells the learner to wait when there are no key ideas yet', () => {
    show('teens', [])
    expect(screen.getByTestId('analogy-no-ideas')).toBeInTheDocument()
    expect(screen.queryByTestId('analogy-make')).toBeNull()
  })
})

describe('analogies api', () => {
  const respond = (status: number, body: unknown) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })))
  afterEach(() => vi.unstubAllGlobals())
  it('parses a READY card from the data envelope and strips unknown top-level fields', async () => {
    respond(200, { data: { status: 'READY', analogy: card, conceptRef: 'c1', materialId: 'm1', packVersion: '0.1.8' } })
    expect(await realApi.create({ materialId: 'm1', conceptRef: 'c1', conceptLabel: 'x' })).toEqual({ status: 'READY', analogy: card, conceptRef: 'c1' })
  })
  it('keeps only code and retryable of a FAILED answer, and treats junk as a retryable failure', async () => {
    respond(200, { data: { status: 'FAILED', code: 'timeout', retryable: true, message: 'raw' } })
    expect(await realApi.create({ materialId: 'm1', conceptRef: 'c1', conceptLabel: 'x' })).toEqual({ status: 'FAILED', code: 'timeout', retryable: true })
    respond(200, { data: { status: 'READY', analogy: { ...card, answerKey: 'x' } } })
    expect(await realApi.create({ materialId: 'm1', conceptRef: 'c1', conceptLabel: 'x' })).toMatchObject({ status: 'FAILED', retryable: true })
  })
  it('rejects a refused request with safe copy and a dropped network as a retryable failure', async () => {
    respond(403, { code: 'CO_DISABLED_BY_POLICY', message: 'server text' })
    await expect(realApi.create({ materialId: 'm1', conceptRef: 'c1', conceptLabel: 'x' })).rejects.toMatchObject({ status: 403, code: 'CO_DISABLED_BY_POLICY' })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network') }))
    expect(await realApi.create({ materialId: 'm1', conceptRef: 'c1', conceptLabel: 'x' })).toEqual({ status: 'FAILED', code: 'timeout', retryable: true })
  })
})
