import { StrictMode, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { id: 'learner-a' } } }) }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => '/learn/lesson/lesson-fixture',
  useSearchParams: () => new URLSearchParams(),
}))

import { LearnIdentityProvider } from '@/components/learn/learn-common'
import { LessonScreen, LessonStartScreen } from '@/components/lesson/lesson-screen'
import { LessonFailed } from '@/components/lesson/lesson-states'
import { buildScript, stepName } from '@/components/lesson/lesson-model'
import { installFakeSpeech, removeSpeech, type FakeSpeech } from '@/components/lesson/dev/fake-speech'
import { answerKeys, fixtureLessonId, fixtureMaterialId, lessonBands, lessonContentFixture, lessonDetailFixture } from '@/components/lesson/dev/lesson-fixtures'
import { createLessonMock, type MockOptions } from '@/components/lesson/dev/lesson-mock'
import type { LearnBand } from '@/lib/api/learn'

type Band = LearnBand
// Several tests walk a whole five-step lesson through the mock server, which is slow on a busy machine.
vi.setConfig({ testTimeout: 40000 })
let speech: FakeSpeech | null = null
let restoreNone: (() => void) | null = null
beforeEach(() => { configure({ asyncUtilTimeout: 6000 }); vi.clearAllMocks(); document.documentElement.dir = 'ltr' })
afterEach(() => {
  cleanup(); configure({ asyncUtilTimeout: 1000 })
  speech?.restore(); speech = null
  restoreNone?.(); restoreNone = null
  vi.unstubAllGlobals()
  document.documentElement.dir = 'ltr'
})

const timing = { debounceMs: 5, retryBaseMs: 600000 }
function setup(options: Partial<MockOptions> & { band: Band }, ui?: React.ReactNode) {
  const server = createLessonMock(options)
  const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => server.fetch(input, init))
  vi.stubGlobal('fetch', fetcher)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const view = render(<QueryClientProvider client={client}><LearnIdentityProvider scope="account:learner-a:unselected" band={null}>
    {ui ?? <LessonScreen lessonId={fixtureLessonId} pollBaseMs={20} timing={timing} />}
  </LearnIdentityProvider></QueryClientProvider>)
  return { server, fetcher, view }
}
const puts = (server: ReturnType<typeof createLessonMock>) => server.calls.filter(call => call.method === 'PUT')
const callsTo = (server: ReturnType<typeof createLessonMock>, method: string, suffix: string) => server.calls.filter(call => call.method === method && call.path.endsWith(suffix))
const heading = (title: string) => screen.findByRole('heading', { level: 2, name: title })
const nextButton = () => screen.getByRole('button', { name: 'Next' })
async function goNext(title: string) { fireEvent.click(nextButton()); expect(await heading(title)).toBeInTheDocument() }
async function solve(band: Band) {
  const key = answerKeys[band]
  fireEvent.click(screen.getByRole('radio', { name: key.options.find(option => option.id === key.correctOptionId)!.text }))
  fireEvent.click(screen.getByRole('button', { name: /^Check/ }))
  await screen.findByText('That is the right one')
}
/** Opens the lesson and moves through the steps up to the given index, answering the check correctly. */
async function walk(band: Band, upTo: number) {
  const content = lessonContentFixture(band)
  await heading(content.steps[0]!.title)
  for (let index = 0; index < upTo; index++) {
    if (index === 2) await solve(band)
    await goNext(content.steps[index + 1]!.title)
  }
}

describe.each(lessonBands)('F-L7-01/03/04 player, %s band', band => {
  const content = lessonContentFixture(band)
  it('shows all five steps in order with the right Co pose, step name, citations and band layout', async () => {
    setup({ band })
    const poses: Record<number, string[]> = { 0: ['waving', 'curious'], 1: ['explaining', 'reading'], 2: ['asking'], 3: ['curious', 'explaining'], 4: ['celebrating', 'encouraging'] }
    await heading(content.steps[0]!.title)
    for (let index = 0; index < 5; index++) {
      const step = content.steps[index]!
      if (index > 0) { if (index === 3) await solve(band); await goNext(step.title) }
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(content.title)
      expect(screen.getByTestId('lesson-step')).toHaveTextContent(`Step ${index + 1} of 5 · ${stepName(step.kind, band)}`)
      expect(screen.getByRole('img', { name: `Step ${index + 1} of 5` })).toBeInTheDocument()
      const co = screen.getByTestId(band === 'teens' ? 'co-dock' : 'co-panel')
      expect(co).toHaveTextContent(step.coLine)
      expect(poses[index]).toContain(co.querySelector('svg')!.getAttribute('data-co-state'))
      expect(co.querySelector('svg')!.getAttribute('data-co-band')).toBe(band)
      // Every sourced step has citation chips back to the learner's own material; the intro may have none.
      if (step.sources.length === 0) expect(screen.queryByTestId('source-chips')).not.toBeInTheDocument()
      else {
        const chips = within(screen.getByTestId('source-chips')).getAllByRole('link')
        expect(chips.length).toBeGreaterThan(0)
        for (const chip of chips) expect(chip).toHaveAttribute('href', `/learn/library/${fixtureMaterialId}`)
        expect(chips[0]).toHaveTextContent(/^From (page|section) /)
      }
    }
  })
  it('labels the lesson as Co-generated from the learner material and lists what the material does not cover', async () => {
    setup({ band })
    await walk(band, 4)
    expect(screen.getAllByText(band === 'kids' ? 'Co made this' : 'Made by Co with AI').length).toBeGreaterThan(0)
    expect(screen.getAllByText(band === 'kids' ? 'from your pages' : 'from your material').length).toBeGreaterThan(0)
    const unknowns = screen.getByTestId('unknowns')
    expect(within(unknowns).getByRole('heading', { name: 'Not in your material' })).toBeInTheDocument()
    for (const item of content.unknowns) expect(within(unknowns).getByText(item)).toBeInTheDocument()
  })
  it('renders the band-specific blocks and nothing the lesson did not provide', async () => {
    setup({ band })
    await heading(content.steps[0]!.title)
    expect(screen.getByRole('region', { name: 'What you will learn' })).toBeInTheDocument()
    await goNext(content.steps[1]!.title)
    expect(document.querySelectorAll('img').length).toBe(0)
    if (band === 'kids') {
      expect(within(screen.getByTestId('lesson-step')).getAllByRole('listitem').length).toBeGreaterThanOrEqual(4)
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    }
    if (band === 'tweens') expect(screen.getByRole('table')).toBeInTheDocument()
    if (band === 'teens') {
      const table = screen.getByRole('table')
      expect(within(table).getByRole('columnheader', { name: 'In acid' })).toBeInTheDocument()
      expect(within(table).getByRole('rowheader', { name: 'Methyl orange' })).toBeInTheDocument()
      expect(within(screen.getByLabelText('Key terms')).getByText('Indicator.')).toBeInTheDocument()
    }
  })
})

describe('F-L7-01 embedded check with hint ladder (never reveals the answer first)', () => {
  it.each(lessonBands)('%s: Next stays locked until the server says the pick was right', async band => {
    const key = answerKeys[band]
    const { server } = setup({ band, step: 2, completed: [0, 1] })
    await heading(lessonContentFixture(band).steps[2]!.title)
    // Before any answer there is no correctness marker anywhere and the answer is not in the page.
    expect(document.querySelector('[data-option-state]')).toBeNull()
    expect(document.body.innerHTML).not.toContain('correctOptionId')
    for (const option of key.options) expect(document.body.textContent).not.toContain(option.feedback)
    expect(nextButton()).toBeDisabled()
    expect(screen.getByTestId('next-locked')).toHaveTextContent('Answer the question correctly to go on.')
    // The arrow key cannot skip a locked check either.
    fireEvent.keyDown(document.body, { key: 'ArrowRight' })
    expect(screen.getByTestId('lesson-step')).toHaveTextContent('Step 3 of 5')

    const wrong = key.options.find(option => option.id !== key.correctOptionId)!
    fireEvent.click(screen.getByRole('radio', { name: wrong.text }))
    fireEvent.click(screen.getByRole('button', { name: /^Check/ }))
    const feedback = await screen.findByText(wrong.feedback)
    expect(feedback.closest('[data-feedback-kind]')).toHaveAttribute('data-feedback-kind', 'incorrect')
    expect(feedback.closest('[role="status"]')).not.toBeNull()
    expect(nextButton()).toBeDisabled()
    expect(screen.getByText('You tried this one')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('That is the right one')
    expect(callsTo(server, 'POST', '/check')[0]!.body).toEqual({ stepIndex: 2, optionId: wrong.id })

    const right = key.options.find(option => option.id === key.correctOptionId)!
    fireEvent.click(screen.getByRole('radio', { name: right.text }))
    expect(screen.queryByText(wrong.feedback)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Check/ }))
    const good = await screen.findByText(right.feedback)
    expect(good.closest('[data-feedback-kind]')).toHaveAttribute('data-feedback-kind', 'correct')
    expect(await screen.findByText('That is the right one')).toBeInTheDocument()
    await waitFor(() => expect(nextButton()).toBeEnabled())
    await waitFor(() => expect(puts(server).some(call => (call.body as { completedStep?: number }).completedStep === 2)).toBe(true))
    expect(screen.queryByRole('button', { name: /^Check/ })).not.toBeInTheDocument()
  })

  it('opens the hint ladder one rung at a time: nudge, the lesson hint, then where to look', async () => {
    setup({ band: 'tweens', step: 2, completed: [0, 1] })
    await heading('Try one')
    const ladder = screen.getByTestId('hint-ladder')
    expect(within(ladder).queryByRole('heading')).not.toBeInTheDocument()
    expect(ladder).toHaveTextContent('0 of 3 hints shown')
    fireEvent.click(within(ladder).getByRole('button', { name: 'Need help?' }))
    expect(within(ladder).getByRole('heading', { name: 'Nudge' })).toBeInTheDocument()
    expect(within(ladder).queryByText('Think about what the bottom number tells you.')).not.toBeInTheDocument()
    expect(screen.getByTestId('co-panel').querySelector('svg')!.getAttribute('data-co-state')).toBe('hinting')
    fireEvent.click(within(ladder).getByRole('button', { name: 'Show next hint' }))
    expect(within(ladder).getByRole('heading', { name: 'Hint' })).toBeInTheDocument()
    expect(within(ladder).getByText('Think about what the bottom number tells you.')).toBeInTheDocument()
    fireEvent.click(within(ladder).getByRole('button', { name: 'Show next hint' }))
    expect(within(ladder).getByRole('heading', { name: 'Look back' })).toBeInTheDocument()
    expect(within(ladder).getByText(/From section 2\.1/)).toBeInTheDocument()
    expect(ladder).toHaveTextContent('3 of 3 hints shown')
    expect(within(ladder).getByRole('button', { name: 'All hints shown' })).toBeDisabled()
    // The ladder never says which option is right.
    expect(ladder.textContent).not.toContain(answerKeys.tweens.options[0]!.text)
  })

  it('skips the lesson-hint rung when the server supplied no hint instead of inventing one', async () => {
    const server = createLessonMock({ band: 'teens', step: 2, completed: [0, 1] })
    const original = server.fetch
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await original(input, init)
      if (init?.method && init.method !== 'GET') return response
      const body = await response.json()
      body.data.content.steps[2].check.hint = null
      return new Response(JSON.stringify(body), { status: 200 })
    }))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><LearnIdentityProvider scope="a"><LessonScreen lessonId={fixtureLessonId} timing={timing} /></LearnIdentityProvider></QueryClientProvider>)
    await heading('Quick check')
    expect(screen.getByTestId('hint-ladder')).toHaveTextContent('0 of 2 hints shown')
  })

  it('sends one check request even if the button is pressed twice, and keeps the choice when the request fails', async () => {
    const { server, fetcher } = setup({ band: 'kids', step: 2, completed: [0, 1] })
    await heading('Tap the roots!')
    fireEvent.click(screen.getByRole('radio', { name: 'The roots' }))
    const button = screen.getByRole('button', { name: 'Check!' })
    fireEvent.click(button); fireEvent.click(button)
    await screen.findByText('That is the right one')
    expect(callsTo(server, 'POST', '/check')).toHaveLength(1)
    cleanup()
    // A failed check keeps the selection and explains.
    const failing = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => String(input).endsWith('/check') ? new Response(JSON.stringify({ message: 'down' }), { status: 503 }) : server.fetch(input, init))
    vi.stubGlobal('fetch', failing)
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><LearnIdentityProvider scope="a"><LessonScreen lessonId={fixtureLessonId} timing={timing} /></LearnIdentityProvider></QueryClientProvider>)
    await heading('Tap the roots!')
    fireEvent.click(screen.getByRole('radio', { name: 'The stem' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check!' }))
    expect(await screen.findByTestId('check-error')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'The stem' })).toBeChecked()
    expect(fetcher).toBeDefined()
  })

  it('on resume a step already answered right shows a gentle note and lets Next through', async () => {
    setup({ band: 'tweens', step: 2, completed: [0, 1, 2] })
    await heading('Try one')
    expect(screen.getByTestId('check-already-done')).toBeInTheDocument()
    expect(nextButton()).toBeEnabled()
  })
})

describe('F-L7-02 back, next, exit and persisted progress', () => {
  it('saves each completed step and the current step, and resumes where the learner stopped', async () => {
    const { server, view } = setup({ band: 'teens' })
    await heading('Why indicators matter')
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
    await goNext('Indicators and their colours')
    await waitFor(() => expect(puts(server)).toHaveLength(1))
    expect(puts(server)[0]!.body).toEqual({ currentStep: 1, completedStep: 0, revision: 0 })
    await waitFor(() => expect(screen.getByTestId('save-status')).toHaveTextContent('Your place is saved'))
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await heading('Why indicators matter')).toBeInTheDocument()
    await waitFor(() => expect(puts(server)).toHaveLength(2))
    expect(puts(server)[1]!.body).toEqual({ currentStep: 0, revision: 1 })
    await goNext('Indicators and their colours')
    await waitFor(() => expect(puts(server)).toHaveLength(3))
    expect(server.detail.progress).toMatchObject({ currentStep: 1, completedSteps: [0] })
    view.unmount()
    // A fresh visit opens on the saved step.
    render(<QueryClientProvider client={new QueryClient()}><LearnIdentityProvider scope="a"><LessonScreen lessonId={fixtureLessonId} timing={timing} /></LearnIdentityProvider></QueryClientProvider>)
    expect(await heading('Indicators and their colours')).toBeInTheDocument()
    expect(screen.getByTestId('lesson-step')).toHaveTextContent('Step 2 of 5')
  })

  it('retries a failed save with the same request, so a step is never recorded twice', async () => {
    const { server } = setup({ band: 'tweens', progressFailures: 1 })
    await heading('Pieces of a whole')
    await goNext('Same size pieces')
    await waitFor(() => expect(screen.getByTestId('save-status')).toHaveAttribute('data-status', 'error'))
    expect(screen.getByTestId('save-status')).toHaveTextContent('We could not save your place yet.')
    // The learner keeps going while the save is pending.
    fireEvent.click(screen.getByRole('button', { name: 'Retry saving' }))
    await waitFor(() => expect(screen.getByTestId('save-status')).toHaveAttribute('data-status', 'saved'))
    const writes = puts(server)
    expect(writes).toHaveLength(2)
    expect(writes[0]!.body).toEqual(writes[1]!.body)
    expect(server.detail.progress.completedSteps).toEqual([0])
  })

  it('adopts the server progress after a conflict and still records the step once', async () => {
    const { server } = setup({ band: 'teens', conflictOnce: true })
    await heading('Why indicators matter')
    await goNext('Indicators and their colours')
    await waitFor(() => expect(screen.getByTestId('save-status')).toHaveAttribute('data-status', 'saved'))
    const sequence = server.calls.filter(call => call.method === 'PUT' || (call.method === 'GET' && call.path.endsWith('/lesson-fixture'))).map(call => call.method)
    expect(sequence.slice(-3)).toEqual(['PUT', 'GET', 'PUT'])
    expect(puts(server)[1]!.body).toMatchObject({ revision: 1, completedStep: 0 })
    expect(server.detail.progress.completedSteps).toEqual([0])
  })

  it('moves with the arrow keys (logical direction in RTL), asks before leaving on Escape, and reaches Ask Co with /', async () => {
    const { server } = setup({ band: 'teens' })
    await heading('Why indicators matter')
    fireEvent.keyDown(document.body, { key: 'ArrowRight' })
    expect(await heading('Indicators and their colours')).toBeInTheDocument()
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' })
    expect(await heading('Why indicators matter')).toBeInTheDocument()
    document.documentElement.dir = 'rtl'
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' })
    expect(await heading('Indicators and their colours')).toBeInTheDocument()
    fireEvent.keyDown(document.body, { key: 'ArrowRight' })
    expect(await heading('Why indicators matter')).toBeInTheDocument()
    document.documentElement.dir = 'ltr'
    // "/" focuses the (disabled) Ask Co control.
    fireEvent.keyDown(document.body, { key: '/' })
    expect(screen.getByRole('button', { name: 'Ask Co' })).toHaveFocus()
    // Escape asks, it does not leave.
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(await screen.findByRole('dialog', { name: 'Leave this lesson?' })).toBeInTheDocument()
    expect(nav.push).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Keep learning' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(nav.push).not.toHaveBeenCalled()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    fireEvent.click(await screen.findByRole('button', { name: 'Leave lesson' }))
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/learn/home'))
    expect(server.calls.length).toBeGreaterThan(0)
  })

  it('the close button asks first, and typing in a note box keeps / and the arrows for the field', async () => {
    setup({ band: 'teens' })
    await heading('Why indicators matter')
    fireEvent.click(screen.getByRole('button', { name: 'Close lesson' }))
    expect(await screen.findByRole('dialog', { name: 'Leave this lesson?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep learning' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Save to revision notes' }))
    const box = await screen.findByLabelText('Write a note about step 1')
    box.focus()
    fireEvent.keyDown(box, { key: '/' })
    fireEvent.keyDown(box, { key: 'ArrowRight' })
    expect(box).toHaveFocus()
    expect(screen.getByTestId('lesson-step')).toHaveTextContent('Step 1 of 5')
  })

  it('leaves the arrow keys to a radio group', async () => {
    setup({ band: 'tweens', step: 2, completed: [0, 1, 2] })
    await heading('Try one')
    const radio = screen.getAllByRole('radio')[0]!
    radio.focus()
    fireEvent.keyDown(radio, { key: 'ArrowRight' })
    expect(screen.getByTestId('lesson-step')).toHaveTextContent('Step 3 of 5')
  })

  it('moves focus to the new step heading and announces the step in a live region', async () => {
    setup({ band: 'tweens' })
    const first = await heading('Pieces of a whole')
    await waitFor(() => expect(first).toHaveFocus())
    expect(screen.getByTestId('lesson-announcer')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByTestId('lesson-announcer')).toHaveTextContent('Step 1 of 5: Intro. Pieces of a whole')
    fireEvent.click(nextButton())
    const second = await heading('Same size pieces')
    await waitFor(() => expect(second).toHaveFocus())
    expect(screen.getByTestId('lesson-announcer')).toHaveTextContent('Step 2 of 5: Explain. Same size pieces')
  })

  it('opens inside a focused frame: the rest of the page is inert while the lesson is open and restored after', async () => {
    const { view } = setup({ band: 'teens' })
    await heading('Why indicators matter')
    const frame = document.querySelector('[data-lesson-frame]')!
    expect(frame).toHaveAttribute('aria-label', 'Lesson: Acids, bases and salts')
    expect(frame.closest('[inert]')).toBeNull()
    expect(view.container).toHaveAttribute('inert')
    view.unmount()
    expect(document.querySelector('[data-lesson-frame]')).toBeNull()
    expect(view.container).not.toHaveAttribute('inert')
  })
})

describe('F-L7-05 on-device read-aloud', () => {
  it.each(lessonBands)('%s: never autoplays, speaks only on request, highlights the spoken word and stops on step change', async band => {
    speech = installFakeSpeech()
    setup({ band })
    const content = lessonContentFixture(band)
    await heading(content.steps[0]!.title)
    const button = await screen.findByRole('button', { name: band === 'kids' ? 'Read to me' : 'Listen' })
    expect(speech.spoken).toHaveLength(0)
    fireEvent.click(button)
    const script = buildScript(content.steps[0]!)
    expect(speech.spoken).toEqual([script.text])
    expect(speech.current()!.voice!.localService).toBe(true)
    expect(speech.current()!.rate).toBe(band === 'kids' ? 0.85 : 1)
    await screen.findByRole('button', { name: band === 'kids' ? 'Stop' : 'Stop reading' })
    // The first word is highlighted from the engine's word boundary.
    speech.boundary(0)
    const first = script.segments[0]!.words[0]!
    await waitFor(() => expect(screen.getByText(first, { selector: 'mark' })).toHaveAttribute('aria-current', 'true'))
    speech.boundary(script.text.indexOf(script.segments[0]!.words[1]!))
    await waitFor(() => expect(screen.getByText(script.segments[0]!.words[1]!, { selector: 'mark' })).toBeInTheDocument())
    // Changing step stops the voice, and the next step does not start by itself.
    const before = speech.cancelled
    fireEvent.click(nextButton())
    await heading(content.steps[1]!.title)
    expect(speech.cancelled).toBeGreaterThan(before)
    expect(speech.current()).toBeNull()
    expect(speech.spoken).toHaveLength(1)
    expect(document.querySelector('mark')).toBeNull()
  })

  it('stops speaking when the lesson closes', async () => {
    speech = installFakeSpeech()
    const { view } = setup({ band: 'kids' })
    await heading('Meet the plant')
    fireEvent.click(await screen.findByRole('button', { name: 'Read to me' }))
    expect(speech.current()).not.toBeNull()
    view.unmount()
    expect(speech.current()).toBeNull()
  })

  it('has no read-aloud control at all when the browser has no speech engine, and the text lesson still works', async () => {
    restoreNone = removeSpeech()
    setup({ band: 'kids' })
    await heading('Meet the plant')
    expect(screen.queryByRole('button', { name: /read to me|listen|stop/i })).not.toBeInTheDocument()
    expect(document.querySelector('[data-speech="unavailable"]')).toHaveTextContent('Your device cannot read out loud. You can read along!')
    await goNext('What each part does')
  })

  it('offers no read-aloud when the only voices are network voices (nothing may leave the device)', async () => {
    speech = installFakeSpeech({ voices: [{ name: 'Network voice', lang: 'en-US', localService: false }] })
    setup({ band: 'teens' })
    await heading('Why indicators matter')
    expect(screen.queryByRole('button', { name: /listen/i })).not.toBeInTheDocument()
    expect(document.querySelector('[data-speech="unavailable"]')).toHaveTextContent('Read aloud is not available on this device.')
    expect(speech.spoken).toHaveLength(0)
  })
})

describe('F-L7-07 revision notes (ages 10 to 17 only)', () => {
  it('kids get no notes control and the server is never asked to save one', async () => {
    const { server } = setup({ band: 'kids' })
    await heading('Meet the plant')
    await goNext('What each part does')
    expect(screen.queryByRole('button', { name: /notes/i })).not.toBeInTheDocument()
    expect(callsTo(server, 'POST', '/notes')).toHaveLength(0)
  })

  it('tweens write, see and delete private notes; a failed save keeps the draft', async () => {
    const { server } = setup({ band: 'tweens', notes: true })
    await heading('Pieces of a whole')
    fireEvent.click(screen.getByRole('button', { name: /My notes/ }))
    const box = await screen.findByLabelText('Write a note about step 1')
    expect(screen.getByRole('list', { name: 'Your notes' })).toHaveTextContent('Remember: the bottom number stays the same.')
    fireEvent.change(box, { target: { value: 'Same size pieces add up.' } })
    expect(screen.getByText('24 of 500 characters. Only you can see your notes.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }))
    await waitFor(() => expect(screen.getByRole('list', { name: 'Your notes' })).toHaveTextContent('Same size pieces add up.'))
    expect(callsTo(server, 'POST', '/notes')[0]!.body).toEqual({ stepIndex: 0, text: 'Same size pieces add up.' })
    expect(box).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: /Delete note from step 2/ }))
    await waitFor(() => expect(screen.getByRole('list', { name: 'Your notes' })).not.toHaveTextContent('Remember'))
    expect(callsTo(server, 'DELETE', '/notes/note-1')).toHaveLength(1)
  })

  it('keeps a draft when saving fails', async () => {
    const { server } = setup({ band: 'tweens' })
    const original = server.fetch
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => String(input).endsWith('/notes') ? new Response('{}', { status: 503 }) : original(input, init)))
    await heading('Pieces of a whole')
    fireEvent.click(screen.getByRole('button', { name: /My notes/ }))
    const box = await screen.findByLabelText('Write a note about step 1')
    fireEvent.change(box, { target: { value: 'Keep me' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }))
    expect(await screen.findByText(/Your note could not be saved|unavailable/i)).toBeInTheDocument()
    expect(box).toHaveValue('Keep me')
  })

  it('teens save to revision notes, including a lesson key term by its index', async () => {
    const { server } = setup({ band: 'teens' })
    await heading('Why indicators matter')
    await goNext('Indicators and their colours')
    fireEvent.click(screen.getByRole('button', { name: 'Save to revision notes: Salt' }))
    await waitFor(() => expect(callsTo(server, 'POST', '/notes')).toHaveLength(1))
    expect(callsTo(server, 'POST', '/notes')[0]!.body).toEqual({ stepIndex: 1, termIndex: 1 })
    fireEvent.click(screen.getByRole('button', { name: /^Save to revision notes\s*\d*$/ }))
    await waitFor(() => expect(screen.getByRole('list', { name: 'Your notes' })).toHaveTextContent('Salt: A compound formed when an acid reacts with a base.'))
  })
})

describe('B08 integration: a term saved with the notes panel closed', () => {
  it('shows NOTE_LIMIT_REACHED in plain words instead of failing silently', async () => {
    const { server } = setup({ band: 'teens' })
    const original = server.fetch
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => String(input).endsWith('/notes') ? new Response(JSON.stringify({ statusCode: 409, code: 'NOTE_LIMIT_REACHED', message: 'This lesson has the most notes it can hold.' }), { status: 409 }) : original(input, init)))
    await heading('Why indicators matter')
    await goNext('Indicators and their colours')
    fireEvent.click(screen.getByRole('button', { name: 'Save to revision notes: Salt' }))
    expect(await screen.findByText(/saved as many notes as fit/)).toBeInTheDocument()
  })
})

describe('F-L7-06 Ask Co (B10) is present but honestly unavailable', () => {
  it.each(lessonBands)('%s: the control carries the server reason and does nothing', async band => {
    const { server } = setup({ band })
    await heading(lessonContentFixture(band).steps[0]!.title)
    const ask = screen.getByRole('button', { name: 'Ask Co' })
    expect(ask).toHaveAttribute('aria-disabled', 'true')
    expect(ask).toHaveAccessibleDescription(lessonDetailFixture(band).askCo.reason!)
    expect(screen.getByText(lessonDetailFixture(band).askCo.reason!)).toBeVisible()
    const before = server.calls.length
    fireEvent.click(ask)
    expect(server.calls.length).toBe(before)
    expect(screen.queryByRole('textbox', { name: /ask/i })).not.toBeInTheDocument()
    if (band === 'kids') expect(ask.className).toContain('rounded-full')
  })
})

describe('F-L7-08 completion (partial by design: no invented reward)', () => {
  it.each(lessonBands)('%s: finishing records completion once and shows an honest Lesson done card', async band => {
    const { server } = setup({ band })
    await walk(band, 4)
    const finish = screen.getByRole('button', { name: 'Finish' })
    fireEvent.click(finish); fireEvent.click(finish)
    const done = await screen.findByRole('heading', { name: 'Lesson done!' })
    await waitFor(() => expect(done).toHaveFocus())
    expect(callsTo(server, 'POST', '/complete')).toHaveLength(1)
    expect(server.detail.progress.completedSteps).toEqual([0, 1, 2, 3, 4])
    expect(server.detail.progress.completedAt).not.toBeNull()
    const practice = screen.getByRole('button', { name: 'Practice now' })
    expect(practice).toBeDisabled()
    expect(screen.getByText('Practice opens when practice ships.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back home' })).toHaveAttribute('href', '/learn/home')
    expect(screen.getByRole('link', { name: 'Back to my material' })).toHaveAttribute('href', `/learn/library/${fixtureMaterialId}`)
    expect(document.body.textContent).not.toMatch(/\bXP\b|sticker|streak|readiness|league|level up|reward|review schedule/i)
    expect(document.body.textContent).not.toMatch(/%/)
    expect(document.querySelector('[data-lesson-frame]')).toBeNull()
  })

  it('reopening a finished lesson shows the card first, and looking again writes nothing', async () => {
    const { server } = setup({ band: 'tweens', state: 'done' })
    await screen.findByRole('heading', { name: 'Lesson done!' })
    expect(screen.getByText('What this lesson covered')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Look at the lesson again' }))
    expect(await heading('Pieces of a whole')).toBeInTheDocument()
    expect(screen.getByTestId('save-status')).toHaveTextContent('Looking again. Nothing is saved.')
    await goNext('Same size pieces')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    await heading('Pieces of a whole')
    await new Promise(resolve => setTimeout(resolve, 80))
    expect(puts(server)).toHaveLength(0)
    expect(callsTo(server, 'POST', '/complete')).toHaveLength(0)
  })

  it('shows a clear error and keeps the lesson open when completing fails', async () => {
    const { server } = setup({ band: 'teens', step: 4, completed: [0, 1, 2, 3] })
    const original = server.fetch
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => String(input).endsWith('/complete') ? new Response('{"code":"X"}', { status: 503 }) : original(input, init)))
    await heading('Recap')
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Lesson done!' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Finish' })).toBeEnabled()
  })
})

describe('states: generating, failed, hidden, unavailable and denied', () => {
  it('shows progress while Co makes the lesson, keeps polling, then opens the lesson', async () => {
    const { server } = setup({ band: 'tweens', state: 'generating', generatingPolls: 4 })
    expect(await screen.findByRole('heading', { name: 'Co is making your lesson' })).toBeInTheDocument()
    expect(document.querySelector('[data-state="generating"]')).toHaveTextContent('Made by Co with AI')
    expect(await heading('Pieces of a whole')).toBeInTheDocument()
    expect(server.calls.filter(call => call.method === 'GET').length).toBeGreaterThanOrEqual(4)
  })

  it('lets the learner stop a lesson that is being made', async () => {
    const { server } = setup({ band: 'teens', state: 'generating', generatingPolls: 50 })
    await screen.findByRole('heading', { name: 'Co is making your lesson' })
    fireEvent.click(screen.getByRole('button', { name: 'Stop making this lesson' }))
    expect(await screen.findByText('This lesson was stopped')).toBeInTheDocument()
    expect(callsTo(server, 'POST', '/cancel')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Make it again' })).toHaveAttribute('href', `/learn/lesson/new?materialId=${fixtureMaterialId}`)
  })

  it('failed and retryable: one retry request makes the next version and the learner follows it to its new id', async () => {
    function Switching() { const [id, setId] = useState(fixtureLessonId); return <LessonScreen lessonId={id} onLessonChanged={setId} pollBaseMs={20} timing={timing} /> }
    const { server } = setup({ band: 'kids', state: 'failed' }, <Switching />)
    expect(await screen.findByRole('heading', { name: 'Co could not make this lesson' })).toBeInTheDocument()
    expect(screen.getByText('Co could not finish this lesson. You can try again.')).toBeInTheDocument()
    const retry = screen.getByRole('button', { name: 'Try again' })
    fireEvent.click(retry); fireEvent.click(retry)
    expect(await heading('Meet the plant')).toBeInTheDocument()
    expect(callsTo(server, 'POST', '/retry')).toHaveLength(1)
    expect(server.calls.some(call => call.path === `/lessons/${fixtureLessonId}-v2`)).toBe(true)
  })

  it('by default a retry moves to the new lesson page, and refreshes in place when the id is the same', async () => {
    const { server } = setup({ band: 'tweens', state: 'failed' })
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith(`/learn/lesson/${fixtureLessonId}-v2`))
    expect(callsTo(server, 'POST', '/retry')).toHaveLength(1)
  })

  it('failed for good offers no "Start again" (the server would answer with the same failed lesson); only a changed permission does', () => {
    const view = render(<LessonFailed band="teens" failure={{ code: 'insufficient_source', retryable: false }} onRetry={() => undefined} retrying={false} startHref="/learn/lesson/new?materialId=m1" />)
    expect(screen.queryByRole('link', { name: 'Start again' })).not.toBeInTheDocument()
    view.rerender(<LessonFailed band="teens" failure={{ code: 'authorization_changed', retryable: false }} onRetry={() => undefined} retrying={false} startHref="/learn/lesson/new?materialId=m1" />)
    expect(screen.getByRole('link', { name: 'Start again' })).toHaveAttribute('href', '/learn/lesson/new?materialId=m1')
  })

  it('failed for good: no retry button, a truthful reason, and a way back', async () => {
    setup({ band: 'teens', state: 'failed-final' })
    expect(await screen.findByText('There is not enough in this material to make a good lesson. Try adding more.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to my library' })).toHaveAttribute('href', '/learn/library')
    expect(document.body.textContent).not.toContain('insufficient_source')
  })

  it('LESSON_ACCESS_CHANGED hides the lesson text and offers help', async () => {
    setup({ band: 'tweens', state: 'access-changed' })
    expect(await screen.findByRole('heading', { name: 'This lesson is hidden for now' })).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('Pieces of a whole')
    expect(screen.getByRole('link', { name: /See what.s needed/ })).toHaveAttribute('href', '/learn/link')
  })

  it('access withdrawn while the lesson is open: the write is refused and the lesson text is hidden at once', async () => {
    const { server } = setup({ band: 'teens', revokeOnProgress: true })
    await heading('Why indicators matter')
    fireEvent.click(nextButton())
    expect(await screen.findByRole('heading', { name: 'This lesson is hidden for now' })).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('Indicators and their colours')
    expect(puts(server)).toHaveLength(1)
  })

  it('denied (404) shows no detail and no retry; unavailable (503) offers retry', async () => {
    setup({ band: 'teens', state: 'denied' })
    expect(await screen.findByRole('heading', { name: 'You cannot open this' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    cleanup()
    setup({ band: 'teens', state: 'unavailable' })
    expect(await screen.findByRole('heading', { name: 'This could not load' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('shows a loading state while the lesson is requested', async () => {
    setup({ band: 'kids', state: 'loading' })
    expect(await screen.findByRole('status', { name: 'Opening your lesson' })).toBeInTheDocument()
  })

  it('refuses a payload that carries the answer key and shows an error instead of the lesson', async () => {
    const server = createLessonMock({ band: 'teens' })
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = await (await server.fetch(input, init)).json()
      body.data.content.steps[2].check.correctOptionId = 'pink'
      return new Response(JSON.stringify(body), { status: 200 })
    }))
    render(<QueryClientProvider client={new QueryClient()}><LearnIdentityProvider scope="a"><LessonScreen lessonId={fixtureLessonId} timing={timing} /></LearnIdentityProvider></QueryClientProvider>)
    expect(await screen.findByRole('heading', { name: 'This could not load' })).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('Why indicators matter')
  })
})

describe('/learn/lesson/new starts or resumes the lesson once', () => {
  const start = (options: Partial<MockOptions>, props: { materialId?: string | null; planItemId?: string | null } = {}) =>
    setup({ band: 'tweens', ...options }, <StrictMode><LessonStartScreen materialId={props.materialId === undefined ? fixtureMaterialId : props.materialId} planItemId={props.planItemId} /></StrictMode>)

  const planItem = '3f2b1c9e-6d1a-4c55-9a53-0d9c5e2f7b10'
  it('asks the server once (even in StrictMode) and moves to the lesson page', async () => {
    const { server } = start({}, { planItemId: planItem })
    expect(screen.getByRole('status', { name: 'Getting your lesson ready' })).toBeInTheDocument()
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith(`/learn/lesson/${fixtureLessonId}`))
    expect(callsTo(server, 'POST', '/lessons')).toHaveLength(1)
    expect(callsTo(server, 'POST', '/lessons')[0]!.body).toEqual({ materialId: fixtureMaterialId, planItemId: planItem })
    expect(nav.replace).toHaveBeenCalledTimes(1)
  })

  it('never sends a plan item id the platform would reject (it takes a uuid only), such as a plan id or a hand-made value', async () => {
    const { server } = start({}, { planItemId: 'plan-7' })
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith(`/learn/lesson/${fixtureLessonId}`))
    expect(callsTo(server, 'POST', '/lessons')).toHaveLength(1)
    expect(callsTo(server, 'POST', '/lessons')[0]!.body).toEqual({ materialId: fixtureMaterialId })
  })

  it('still starts the lesson when the platform does not know the plan item (404), by asking again without it', async () => {
    const server = createLessonMock({ band: 'tweens' })
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const sent = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : {}
      return init?.method === 'POST' && 'planItemId' in sent ? new Response(JSON.stringify({ statusCode: 404, message: 'Plan item unavailable', error: 'Not Found' }), { status: 404 }) : server.fetch(input, init)
    })
    vi.stubGlobal('fetch', fetcher)
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><LearnIdentityProvider scope="account:learner-a:unselected" band={null}><StrictMode><LessonStartScreen materialId={fixtureMaterialId} planItemId={planItem} /></StrictMode></LearnIdentityProvider></QueryClientProvider>)
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith(`/learn/lesson/${fixtureLessonId}`))
    const posts = fetcher.mock.calls.filter(call => call[1]?.method === 'POST').map(call => JSON.parse(call[1]!.body as string))
    expect(posts).toEqual([{ materialId: fixtureMaterialId, planItemId: planItem }, { materialId: fixtureMaterialId }])
  })

  it('does not hide a 404 for the material itself behind the plan item fallback', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ statusCode: 404, message: 'Material unavailable', error: 'Not Found' }), { status: 404 }))
    vi.stubGlobal('fetch', fetcher)
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><LearnIdentityProvider scope="account:learner-a:unselected" band={null}><LessonStartScreen materialId={fixtureMaterialId} planItemId={planItem} /></LearnIdentityProvider></QueryClientProvider>)
    expect(await screen.findByRole('heading', { name: 'You cannot open this' })).toBeInTheDocument()
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it('asks the learner to choose a material when none (or a malformed one) is given', async () => {
    const { server } = start({}, { materialId: null })
    expect(screen.getByRole('heading', { name: 'Choose something to learn from' })).toBeInTheDocument()
    expect(server.calls).toHaveLength(0)
    cleanup()
    const second = start({}, { materialId: '../admin' })
    expect(screen.getByRole('heading', { name: 'Choose something to learn from' })).toBeInTheDocument()
    expect(second.server.calls).toHaveLength(0)
  })

  it.each([
    ['MATERIAL_NOT_READY', 'This material is not ready yet', false],
    ['CONSENT_REQUIRED', 'A grown-up needs to help first', false],
    ['CHILD_PROFILE_REQUIRED', 'Your profile needs finishing first', false],
    ['POLICY_BLOCKED', 'Not right now', true],
    ['LESSONS_UNAVAILABLE', 'Lessons are not ready yet', false],
    ['DAILY_LESSON_LIMIT', 'That is enough lessons for today', true],
  ])('%s shows a plain reason', async (code, title, retry) => {
    start({ startError: code })
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
    expect(!!screen.queryByRole('button', { name: 'Try again' })).toBe(retry)
    expect(screen.getByRole('link', { name: 'Back to my library' })).toBeInTheDocument()
    expect(nav.replace).not.toHaveBeenCalled()
    if (code === 'POLICY_BLOCKED') expect(screen.getByText(/paused until tomorrow/)).toBeInTheDocument()
    if (code === 'CONSENT_REQUIRED' || code === 'CHILD_PROFILE_REQUIRED') expect(screen.getByRole('link', { name: /See what.s needed/ })).toBeInTheDocument()
    expect(document.body.textContent).not.toContain(code)
  })

  it('Try again repeats the one request', async () => {
    const { server } = start({ startError: 'DAILY_LESSON_LIMIT' })
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(callsTo(server, 'POST', '/lessons')).toHaveLength(2))
  })
})

describe('platform behaviours confirmed after the contract (OpenAPI is the source of truth)', () => {
  it('a hidden lesson (READY, no content, LESSON_ACCESS_CHANGED) shows nothing of the lesson and every action is refused the same way', async () => {
    const { server } = setup({ band: 'tweens', state: 'access-changed' })
    expect(await screen.findByRole('heading', { name: 'This lesson is hidden for now' })).toBeInTheDocument()
    expect(server.detail.lesson).toMatchObject({ status: 'READY', failure: { code: 'LESSON_ACCESS_CHANGED', retryable: false } })
    expect(server.handle('PUT', '/lessons/lesson-fixture/progress', { currentStep: 1, revision: 0 })).toMatchObject({ status: 403, body: { code: 'LESSON_ACCESS_CHANGED' } })
  })

  it('does not show the AI pack or prompt release until the lesson is READY (the platform sends empty strings before)', async () => {
    const { server } = setup({ band: 'teens', state: 'generating', generatingPolls: 4 })
    await screen.findByRole('heading', { name: 'Co is making your lesson' })
    expect(server.detail.generatedBy).toEqual({ kind: 'AI', packVersion: '', promptRelease: '' })
    expect(document.body.textContent).not.toMatch(/AI pack|prompt release/)
    await heading('Why indicators matter')
    expect(document.body.textContent).toContain('AI pack 0.1.2, prompt release lesson-fixture-1')
  })

  it('completion Back home follows the HOME link the platform sends', async () => {
    setup({ band: 'kids', state: 'done' })
    expect(await screen.findByRole('link', { name: 'Back home' })).toHaveAttribute('href', '/learn/home')
  })

  it('a STEP_ORDER refusal is a real error, not a conflict to reload and repeat', async () => {
    const server = createLessonMock({ band: 'tweens' })
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => init?.method === 'PUT' ? new Response(JSON.stringify({ code: 'STEP_ORDER', message: 'x' }), { status: 409 }) : server.fetch(input, init))
    vi.stubGlobal('fetch', fetcher)
    render(<QueryClientProvider client={new QueryClient()}><LearnIdentityProvider scope="a"><LessonScreen lessonId={fixtureLessonId} timing={timing} /></LearnIdentityProvider></QueryClientProvider>)
    await heading('Pieces of a whole')
    fireEvent.click(nextButton())
    await waitFor(() => expect(screen.getByTestId('save-status')).toHaveAttribute('data-status', 'error'))
    expect(fetcher.mock.calls.filter(call => call[1]?.method === 'PUT')).toHaveLength(1)
    expect(fetcher.mock.calls.filter(call => !call[1]?.method || call[1].method === 'GET')).toHaveLength(1)
  })

  it('completions that queue up while saving fails never ask the platform for a current step past its first unfinished step', async () => {
    const { server } = setup({ band: 'teens', progressFailures: 1 })
    await heading('Why indicators matter')
    await goNext('Indicators and their colours')
    await waitFor(() => expect(screen.getByTestId('save-status')).toHaveAttribute('data-status', 'error'))
    // Offline: the learner moves on, so step 1 is also waiting to be recorded while the server knows nothing yet.
    await goNext('Quick check')
    await waitFor(() => expect(screen.getByTestId('save-status')).toHaveAttribute('data-status', 'saved'))
    expect(puts(server).map(call => call.body)).toEqual([
      { currentStep: 1, completedStep: 0, revision: 0 },
      { currentStep: 1, completedStep: 0, revision: 0 },
      { currentStep: 2, completedStep: 1, revision: 1 },
    ])
    expect(server.detail.progress).toMatchObject({ currentStep: 2, completedSteps: [0, 1] })
  })

  it('a step already completed is not sent again when moving on', async () => {
    const { server } = setup({ band: 'teens', step: 2, completed: [0, 1] })
    await heading('Quick check')
    await solve('teens')
    await waitFor(() => expect(puts(server).some(call => (call.body as { completedStep?: number }).completedStep === 2)).toBe(true))
    const before = puts(server).length
    await goNext('A neutralisation example')
    await waitFor(() => expect(puts(server).length).toBe(before + 1))
    expect(puts(server).at(-1)!.body).toEqual({ currentStep: 3, revision: expect.any(Number) })
  })
})
