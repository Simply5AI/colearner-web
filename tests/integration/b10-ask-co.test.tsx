import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { id: 'learner-a' } } }) }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/learn/lesson/lesson-fixture',
  useSearchParams: () => new URLSearchParams(),
}))

import { LearnIdentityProvider } from '@/components/learn/learn-common'
import { AskCoEntry, AskCoLauncher } from '@/components/co/co-launcher'
import { GROUNDING_FOOTER, parentVisibilityNote, pendingLabel } from '@/components/co/co-model'
import type { SendStorage, PendingSend } from '@/components/co/turn-sender'
import { createCoMock, type MockOptions } from '@/components/co/dev/co-mock'
import { coBands, fixtureLessonId, fixtureMaterialId, guidanceText, photoReason, topics, voiceReason } from '@/components/co/dev/co-fixtures'
import { installFakeSpeech, removeSpeech, type FakeSpeech } from '@/components/lesson/dev/fake-speech'
import type { LearnBand } from '@/lib/api/learn'

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

const memory = (): SendStorage => {
  const data = new Map<string, PendingSend>()
  return { get: key => data.get(key) ?? null, set: (key, value) => { data.set(key, value) }, remove: key => { data.delete(key) } }
}
type Setup = Partial<MockOptions> & { band: LearnBand; slowAfterMs?: number; storage?: SendStorage | 'default'; entry?: boolean }
function setup(options: Setup) {
  const { slowAfterMs, storage, entry, ...mockOptions } = options
  const server = createCoMock(mockOptions)
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => server.fetch(input, init)))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const common = { band: options.band, pollBaseMs: 15, slowAfterMs: slowAfterMs ?? 60000, storage: storage === 'default' ? undefined : storage ?? memory() }
  const view = render(<QueryClientProvider client={client}><LearnIdentityProvider scope="account:learner-a:unselected" band={null}>
    {entry
      ? <AskCoEntry materialId={fixtureMaterialId} {...common} />
      : <AskCoLauncher context={{ kind: 'LESSON', lessonId: fixtureLessonId, stepIndex: 1 }} materialHref={`/learn/library/${fixtureMaterialId}`} {...common} />}
  </LearnIdentityProvider></QueryClientProvider>)
  return { server, view }
}
const opener = () => screen.getByRole('button', { name: 'Ask Co' })
/** Opens the dialog without waiting for the chat (for states where Ask Co cannot answer). */
async function openRaw() { fireEvent.click(opener()); return screen.findByRole('dialog', { name: 'Ask Co' }) }
/** Opens the dialog and waits until the chat itself is ready (the context was available). */
async function openPanel() { const dialog = await openRaw(); await within(dialog).findByRole('textbox'); return dialog }
const textbox = () => screen.getByRole('textbox') as HTMLTextAreaElement
const sendButton = (band: LearnBand) => screen.getByRole('button', { name: band === 'kids' ? 'Ask' : 'Send' })
function type(text: string) { fireEvent.change(textbox(), { target: { value: text } }) }
function ask(band: LearnBand, text: string) { type(text); fireEvent.click(sendButton(band)) }
const announcer = () => screen.getByTestId('co-announcer')
const turnPosts = (server: ReturnType<typeof createCoMock>) => server.calls.filter(call => call.method === 'POST' && call.path.endsWith('/turns'))

describe.each(coBands)('F-L8-01/02/03 the Ask Co panel, %s band', band => {
  const topic = topics[band]

  it('opens a dialog with Co, the AI label, suggestions, the source, the parent note, the voice note and the grounding footer; it has no microphone', async () => {
    setup({ band })
    const dialog = await openPanel()
    expect(within(dialog).getByRole('heading', { name: 'Ask Co' })).toBeInTheDocument()
    expect(within(dialog).getAllByText('Co is an AI helper').length).toBeGreaterThan(0)
    const suggestions = await within(dialog).findByTestId('co-suggestions')
    const shown = band === 'kids' ? topic.suggestions.slice(0, 3) : topic.suggestions
    for (const text of shown) expect(within(suggestions).getByRole('button', { name: text })).toBeInTheDocument()
    if (band === 'kids') for (const button of within(suggestions).getAllByRole('button')) expect(button.className).toContain('min-h-16')
    expect(within(dialog).getByTestId('co-source')).toHaveTextContent(`About ${topic.title}`)
    expect(within(dialog).getByRole('link', { name: 'Open in library' })).toHaveAttribute('href', `/learn/library/${fixtureMaterialId}`)
    expect(within(dialog).getByTestId('co-parent-note')).toHaveTextContent(parentVisibilityNote(band, band === 'teens' ? 'SUMMARY' : 'FULL'))
    expect(within(dialog).getByTestId('co-grounding-note')).toHaveTextContent(GROUNDING_FOOTER)
    const voice = within(dialog).getByTestId('co-voice-note')
    expect(voice).toHaveTextContent('Voice isn’t available yet')
    expect(voice).toHaveTextContent(voiceReason)
    expect(dialog.textContent).not.toContain(photoReason)
    // No microphone, waveform, listening or transcript anywhere in the panel.
    expect(within(dialog).queryByRole('button', { name: /mic|microphone|record|dictat|hold to talk|speak to co/i })).toBeNull()
    expect(dialog.querySelector('[data-co-state="listening"]')).toBeNull()
    expect(dialog.textContent).not.toMatch(/waveform|transcript|listening…|I’m listening/i)
    // Typed input everywhere, with the band's limit.
    expect(textbox().maxLength).toBe({ kids: 300, tweens: 500, teens: 1000 }[band])
  })

  it('shows the real thinking state, then a sourced answer with a source chip and follow-up chips, and never partial text', async () => {
    const { server } = setup({ band, polls: 12 })
    const dialog = await openPanel()
    fireEvent.click(await within(dialog).findByRole('button', { name: topic.suggestions[0]! }))
    const pending = await within(dialog).findByTestId('co-pending')
    expect(pending).toHaveTextContent(pendingLabel(band))
    expect(pending.querySelector('[data-co-state="thinking"]')).not.toBeNull()
    expect(within(dialog).queryByTestId('co-reply-text')).toBeNull()
    await waitFor(() => expect(announcer()).toHaveTextContent(pendingLabel(band)))
    const reply = await within(dialog).findByTestId('co-reply')
    expect(within(reply).getByTestId('co-reply-text')).toHaveTextContent(topic.answer)
    expect(within(dialog).queryByTestId('co-pending')).toBeNull()
    const chip = within(within(reply).getByTestId('co-sources')).getByRole('link')
    expect(chip).toHaveTextContent(`From ${topic.source.label}`)
    expect(chip).toHaveAttribute('href', `/learn/library/${fixtureMaterialId}`)
    expect(within(reply).queryByTestId('co-beyond')).toBeNull()
    expect(within(reply).getByText('Co is an AI helper')).toBeInTheDocument()
    expect(within(reply).getByTestId('co-suggestions').querySelectorAll('button').length).toBeLessThanOrEqual(3)
    await waitFor(() => expect(announcer()).toHaveTextContent(`Co answered. ${topic.answer}`))
    expect(server.created).toBe(1)
    // The question asked is shown, and the field is free for the next one.
    expect(within(dialog).getByTestId('co-learner')).toHaveTextContent(topic.suggestions[0]!)
    expect(textbox().value).toBe('')
  })

  it('shows "Beyond your material" and its note only when the reply says so', async () => {
    setup({ band })
    const dialog = await openPanel()
    ask(band, topic.question)
    const first = await within(dialog).findByTestId('co-reply')
    expect(within(first).queryByTestId('co-beyond')).toBeNull()
    ask(band, 'Tell me what is beyond that')
    await waitFor(() => expect(within(dialog).getAllByTestId('co-reply')).toHaveLength(2))
    const beyond = within(dialog).getAllByTestId('co-reply')[1]!
    expect(within(beyond).getByTestId('co-beyond')).toHaveTextContent('Beyond your material')
    expect(within(beyond).getByTestId('co-beyond-note')).toHaveTextContent(topic.beyondNote)
    expect(within(beyond).queryByTestId('co-sources')).toBeNull()
    // Only one tag in the whole conversation: the first reply stays unmarked.
    expect(within(dialog).getAllByTestId('co-beyond')).toHaveLength(1)
  })

  it('shows a safety redirect as a shield, "Safety check" and the code-owned guidance, verbatim and alone', async () => {
    const { server } = setup({ band })
    const dialog = await openPanel()
    ask(band, 'I want to hurt myself')
    const safety = await within(dialog).findByTestId('co-safety')
    expect(within(safety).getByTestId('co-safety-label')).toHaveTextContent('Safety check')
    expect(within(safety).getByTestId('co-reply-text').textContent).toBe(guidanceText[band].TRUSTED_ADULT)
    expect(safety.querySelector('svg.lucide-shield-check')).not.toBeNull()
    expect(safety).toHaveAttribute('data-origin', 'CODE')
    expect(within(safety).getByText('Safety message from CoLearner')).toBeInTheDocument()
    expect(within(safety).queryByTestId('co-sources')).toBeNull()
    expect(within(safety).queryByTestId('co-suggestions')).toBeNull()
    expect(within(safety).queryByTestId('co-beyond')).toBeNull()
    expect(within(dialog).queryByTestId('co-pending')).toBeNull()
    await waitFor(() => expect(announcer()).toHaveTextContent(`Safety check. ${guidanceText[band].TRUSTED_ADULT}`))
    // The pre-filter answered at once: no polling was needed.
    expect(server.calls.filter(call => call.method === 'GET' && /\/turns\//.test(call.path))).toHaveLength(0)
  })

  it('shows an explicit failure and retries as a NEW turn (the platform makes one) that replaces the failed one, with no second message of the learner', async () => {
    const { server } = setup({ band })
    const dialog = await openPanel()
    ask(band, 'please fail this one')
    const failed = await within(dialog).findByTestId('co-failed')
    expect(failed).toHaveTextContent('Co could not answer that.')
    expect(failed).toHaveTextContent('You can try again.')
    expect(failed.textContent).not.toMatch(/generation_failed/)
    await waitFor(() => expect(announcer()).toHaveTextContent('Co could not answer that'))
    fireEvent.click(within(failed).getByRole('button', { name: 'Try again' }))
    await within(dialog).findByTestId('co-reply')
    expect(within(dialog).queryByTestId('co-failed')).toBeNull()
    expect(server.created).toBe(1)
    expect(within(dialog).getAllByTestId('co-turn')).toHaveLength(1)
    // The retry POST is answered with the new turn, which is then the one polled; the failed turn is not read again.
    const retry = server.calls.find(call => call.method === 'POST' && call.path.endsWith('/retry'))!
    const failedId = retry.path.split('/')[5]!
    expect(server.turns.map(turn => turn.id)).toHaveLength(2)
    const polledAfter = server.calls.slice(server.calls.indexOf(retry) + 1).filter(call => call.method === 'GET' && /\/turns\//.test(call.path))
    expect(polledAfter.length).toBeGreaterThan(0)
    expect(polledAfter.every(call => !call.path.includes(`/turns/${failedId}`))).toBe(true)
  })

  it('allows one pending turn per conversation: send and suggestions wait, the field stays free, and Stop waiting is offered after a while', async () => {
    const { server } = setup({ band, slowAfterMs: 120 })
    const dialog = await openPanel()
    ask(band, 'this will take forever')
    await within(dialog).findByTestId('co-pending')
    type('A second question')
    expect(sendButton(band)).toBeDisabled()
    expect(textbox().value).toBe('A second question')
    expect(textbox()).not.toBeDisabled()
    expect(within(dialog).getByTestId('co-hint')).toHaveTextContent('You can write your next question while you wait')
    fireEvent.keyDown(textbox(), { key: 'Enter' })
    expect(turnPosts(server)).toHaveLength(1)
    const stop = await within(dialog).findByRole('button', { name: 'Stop waiting' })
    fireEvent.click(stop)
    await within(dialog).findByTestId('co-stopped')
    await waitFor(() => expect(sendButton(band)).not.toBeDisabled())
    fireEvent.click(sendButton(band))
    await within(dialog).findByTestId('co-reply')
    expect(turnPosts(server)).toHaveLength(2)
  })

  it('never double-sends: a lost answer is retried with the SAME clientTurnId and text, and the server holds one turn', async () => {
    const { server } = setup({ band, lostResponses: 1 })
    const dialog = await openPanel()
    ask(band, 'Why is it so?')
    const alert = await within(dialog).findByTestId('co-error')
    expect(alert).toHaveTextContent('We could not send that. Your message is kept, so try again.')
    expect(textbox()).toHaveAttribute('readonly')
    expect(textbox().value).toBe('Why is it so?')
    fireEvent.click(screen.getByRole('button', { name: 'Send again' }))
    await within(dialog).findByTestId('co-reply')
    const posts = turnPosts(server)
    expect(posts).toHaveLength(2)
    expect(posts[1]!.body).toEqual(posts[0]!.body)
    expect((posts[0]!.body as { clientTurnId: string }).clientTurnId).toMatch(/^[0-9a-f-]{36}$/)
    expect(server.created).toBe(1)
    expect(within(dialog).getAllByTestId('co-turn')).toHaveLength(1)
    expect(textbox()).not.toHaveAttribute('readonly')
  })

  it('keeps the unconfirmed message across renders with the real sessionStorage, and clears it once the server took it', async () => {
    window.sessionStorage.clear()
    const { server } = setup({ band, lostResponses: 1, storage: 'default' })
    const dialog = await openPanel()
    ask(band, 'Same words, same id')
    await within(dialog).findByTestId('co-error')
    const key = Object.keys(window.sessionStorage).find(item => item.startsWith('colearner:co:turn:'))
    expect(key).toBeDefined()
    // Typing in the locked field changes nothing; the stored message is the one that is sent again.
    fireEvent.change(textbox(), { target: { value: 'something else' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send again' }))
    await within(dialog).findByTestId('co-reply')
    const posts = turnPosts(server)
    expect(posts).toHaveLength(2)
    expect(posts[1]!.body).toEqual(posts[0]!.body)
    expect(server.created).toBe(1)
    expect(window.sessionStorage.getItem(key!)).toBeNull()
  })

  it('keeps the draft and says why when the server refuses a new message', async () => {
    setup({ band, turnError: 'TURN_LIMIT_REACHED' })
    const dialog = await openPanel()
    ask(band, 'One more please')
    expect(await within(dialog).findByTestId('co-error')).toHaveTextContent('You have asked Co a lot today. Come back tomorrow.')
    expect(textbox().value).toBe('One more please')
    expect(within(dialog).queryByTestId('co-turn')).toBeNull()
  })

  it('shows the code-owned policy reason when Ask Co is switched off by policy while starting', async () => {
    setup({ band, startError: 'CO_DISABLED_BY_POLICY' })
    const dialog = await openPanel()
    ask(band, 'Hello there')
    expect(await within(dialog).findByTestId('co-error')).toHaveTextContent('Your school or family settings do not allow Ask Co right now.')
    expect(textbox().value).toBe('Hello there')
  })

  it('reopens with the history of this conversation and announces only new replies', async () => {
    const { server } = setup({ band, state: 'history' })
    const dialog = await openPanel()
    await waitFor(() => expect(within(dialog).getAllByTestId('co-turn')).toHaveLength(2))
    expect(within(dialog).getAllByTestId('co-learner').map(node => node.textContent)).toEqual([`You asked: ${topic.question}`, `You asked: ${topic.beyondQuestion}`])
    expect(within(dialog).getAllByTestId('co-reply')).toHaveLength(2)
    expect(within(dialog).getAllByTestId('co-beyond')).toHaveLength(1)
    expect(within(dialog).queryByTestId('co-empty')).toBeNull()
    expect(announcer()).toBeEmptyDOMElement()
    expect(server.calls.some(call => call.method === 'GET' && call.path === `/co/conversations/${server.ids.conversationId}`)).toBe(true)
  })

  it('resumes a turn that was still being answered when the panel was closed', async () => {
    setup({ band, state: 'pending' })
    const dialog = await openPanel()
    await within(dialog).findByTestId('co-pending')
    await waitFor(() => expect(within(dialog).getAllByTestId('co-reply')).toHaveLength(3))
    await waitFor(() => expect(announcer()).toHaveTextContent('Co answered.'))
  })

  it('says so when the earlier questions cannot be loaded, and still lets the learner ask', async () => {
    setup({ band, state: 'history-failed' })
    const dialog = await openPanel()
    expect(await within(dialog).findByTestId('co-problem')).toBeInTheDocument()
    expect(textbox()).toBeInTheDocument()
  })
})

describe('F-L8-03 teens choose Simple or Exam-style; younger learners do not', () => {
  it('sends the style and shows the key points that come back', async () => {
    const { server } = setup({ band: 'teens' })
    const dialog = await openPanel()
    const group = await within(dialog).findByRole('group', { name: 'Answer style' })
    expect(within(group).getByRole('radio', { name: 'Simple' })).toBeChecked()
    fireEvent.click(within(group).getByRole('radio', { name: 'Exam-style' }))
    ask('teens', topics.teens.question)
    const reply = await within(dialog).findByTestId('co-reply')
    expect(turnPosts(server)[0]!.body).toMatchObject({ style: 'EXAM', stepIndex: 1 })
    const points = within(reply).getByTestId('co-key-points')
    for (const point of topics.teens.keyPoints) expect(within(points).getByText(point)).toBeInTheDocument()
    expect(reply.textContent).toContain(topics.teens.examAnswer)
  })
  it('renders no key points for the simple style', async () => {
    const { server } = setup({ band: 'teens' })
    const dialog = await openPanel()
    ask('teens', topics.teens.question)
    const reply = await within(dialog).findByTestId('co-reply')
    expect(turnPosts(server)[0]!.body).toMatchObject({ style: 'SIMPLE' })
    expect(within(reply).queryByTestId('co-key-points')).toBeNull()
  })
  it.each(['kids', 'tweens'] as const)('%s have no style choice and send none', async band => {
    const { server } = setup({ band })
    const dialog = await openPanel()
    await within(dialog).findByTestId('co-empty')
    expect(within(dialog).queryByRole('group', { name: 'Answer style' })).toBeNull()
    ask(band, topics[band].question)
    await within(dialog).findByTestId('co-reply')
    expect(turnPosts(server)[0]!.body).not.toHaveProperty('style')
  })
})

describe('F-L8-07 keyboard, focus and closing', () => {
  it('Esc closes a panel with no draft and focus returns to the opener', async () => {
    setup({ band: 'teens' })
    const button = opener()
    button.focus()
    const dialog = await openPanel()
    await within(dialog).findByTestId('co-empty')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(button).toHaveFocus())
  })
  it('asks before closing when a question was typed but not sent, and keeps the draft', async () => {
    setup({ band: 'tweens' })
    const dialog = await openPanel()
    await within(dialog).findByTestId('co-empty')
    type('A question I am still writing')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    const confirm = await within(dialog).findByTestId('co-confirm-close')
    expect(confirm).toHaveTextContent('Close without sending?')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(within(confirm).getByRole('button', { name: 'Keep writing' })).toHaveFocus()
    // Esc again keeps the panel and puts the confirmation away.
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('co-confirm-close')).toBeNull())
    expect(textbox().value).toBe('A question I am still writing')
    fireEvent.click(screen.getByRole('button', { name: 'Close Ask Co' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
  it('closes at once with the close button when nothing is pending', async () => {
    setup({ band: 'kids' })
    const button = opener()
    button.focus()
    await openPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Close Ask Co' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(button).toHaveFocus())
  })
  it('sends with Enter, adds a line with Shift+Enter, and ignores Enter while composing', async () => {
    const { server } = setup({ band: 'teens' })
    const dialog = await openPanel()
    await within(dialog).findByTestId('co-empty')
    type('Line one')
    fireEvent.keyDown(textbox(), { key: 'Enter', shiftKey: true })
    expect(turnPosts(server)).toHaveLength(0)
    fireEvent.keyDown(textbox(), { key: 'Enter', isComposing: true })
    expect(turnPosts(server)).toHaveLength(0)
    fireEvent.keyDown(textbox(), { key: 'Enter' })
    await within(dialog).findByTestId('co-reply')
    expect(turnPosts(server)).toHaveLength(1)
  })
  it('moves focus to the field for tweens and teens', async () => {
    setup({ band: 'teens' })
    await openPanel()
    await waitFor(() => expect(textbox()).toHaveFocus())
  })
  it('leaves the keyboard closed for kids so the suggestion bubbles stay in view', async () => {
    setup({ band: 'kids' })
    await openPanel()
    await screen.findByTestId('co-empty')
    expect(textbox()).not.toHaveFocus()
    expect(screen.getByRole('heading', { name: 'Ask Co' })).toHaveFocus()
  })
  it('keeps the panel in the order a keyboard learner expects: heading, close, chat, field, send', async () => {
    setup({ band: 'tweens' })
    const dialog = await openPanel()
    await within(dialog).findByTestId('co-empty')
    const order = [...dialog.querySelectorAll<HTMLElement>('button, a[href], textarea, [role="region"][tabindex="0"]')].map(node => node.getAttribute('aria-label') ?? node.tagName)
    expect(order.indexOf('Close Ask Co')).toBeGreaterThanOrEqual(0)
    expect(order.indexOf('TEXTAREA')).toBeGreaterThan(order.indexOf('Close Ask Co'))
    expect(order.indexOf('Send')).toBeGreaterThan(order.indexOf('TEXTAREA'))
    expect(order[order.length - 1]).toBe('Send')
  })
})

describe('F-L8-05/F-L8-06 on-device read-aloud, no autoplay', () => {
  it('offers Listen only when the device has a local voice, never speaks on its own, and speaks the reply words when pressed', async () => {
    speech = installFakeSpeech({ autoplayMs: null })
    const { server } = setup({ band: 'tweens' })
    const dialog = await openPanel()
    ask('tweens', topics.tweens.question)
    const reply = await within(dialog).findByTestId('co-reply')
    expect(speech.spoken).toHaveLength(0)
    fireEvent.click(await within(reply).findByRole('button', { name: 'Listen' }))
    expect(speech.spoken).toEqual([topics.tweens.answer])
    expect(await within(reply).findByRole('button', { name: 'Stop reading' })).toBeInTheDocument()
    expect(server.created).toBe(1)
  })
  it('kids get a large "Read to me" button', async () => {
    speech = installFakeSpeech({ autoplayMs: null })
    setup({ band: 'kids' })
    const dialog = await openPanel()
    ask('kids', topics.kids.question)
    const reply = await within(dialog).findByTestId('co-reply')
    expect((await within(reply).findByRole('button', { name: 'Read to me' })).className).toContain('text-[length:var(--ds-h3)]')
  })
  it('hides the control completely when speech is not supported', async () => {
    restoreNone = removeSpeech()
    setup({ band: 'teens' })
    const dialog = await openPanel()
    ask('teens', topics.teens.question)
    const reply = await within(dialog).findByTestId('co-reply')
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(within(reply).queryByRole('button', { name: /Listen|Read to me|Stop/ })).toBeNull()
    expect(reply.textContent).not.toMatch(/read aloud|cannot read/i)
  })
})

describe('states of the context', () => {
  const cases: { state: NonNullable<MockOptions['state']>; text: RegExp }[] = [
    { state: 'unavailable', text: /Ask Co is not switched on for you yet\./ },
    { state: 'disabled', text: /Your school or family settings do not allow Ask Co right now\./ },
    { state: 'not-ready', text: /Your material is still being read\./ },
    { state: 'denied', text: /You cannot open this/ },
    { state: 'ended', text: /Your learning session ended/ },
    { state: 'unreachable', text: /Ask Co could not load/ },
  ]
  it.each(cases)('$state: a calm explanation, no input', async ({ state, text }) => {
    setup({ band: 'tweens', state })
    const dialog = await openRaw()
    await waitFor(() => expect(dialog.textContent).toMatch(text))
    expect(within(dialog).queryByRole('textbox')).toBeNull()
    expect(within(dialog).queryByTestId('co-suggestions')).toBeNull()
  })
  it('unreachable offers Try again; an ended session does not sign anyone out', async () => {
    setup({ band: 'teens', state: 'unreachable' })
    const dialog = await openRaw()
    expect(await within(dialog).findByRole('button', { name: 'Try again' })).toBeInTheDocument()
    cleanup()
    setup({ band: 'teens', state: 'ended' })
    const ended = await openRaw()
    await within(ended).findByText('Your learning session ended')
    expect(within(ended).queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(within(ended).queryByRole('link', { name: /sign in|log in/i })).toBeNull()
  })
  it('with no material context it points to the library instead of offering an ungrounded chat', async () => {
    setup({ band: 'kids', state: 'no-context' })
    const dialog = await openRaw()
    expect(await within(dialog).findByTestId('co-unavailable')).toHaveTextContent('Pick something to ask about')
    expect(within(dialog).getByRole('link', { name: 'Go to my library' })).toHaveAttribute('href', '/learn/library')
    expect(within(dialog).queryByRole('textbox')).toBeNull()
  })
  it('shows loading while the context is on its way', async () => {
    setup({ band: 'tweens', state: 'loading' })
    const dialog = await openRaw()
    expect(await within(dialog).findByTestId('co-loading')).toHaveTextContent('Opening Ask Co')
  })
})

describe('F-L8-01 the library item entry', () => {
  it('offers the real control when Ask Co is available for the material', async () => {
    const { server } = setup({ band: 'tweens', entry: true })
    expect(await screen.findByTestId('ask-co-entry')).toBeInTheDocument()
    expect(server.calls[0]!.path).toBe(`/co/context?materialId=${fixtureMaterialId}`)
    const dialog = await openPanel()
    ask('tweens', topics.tweens.question)
    await within(dialog).findByTestId('co-reply')
    const created = server.calls.find(call => call.method === 'POST' && call.path === '/co/conversations')
    expect(created!.body).toEqual({ context: { kind: 'MATERIAL', materialId: fixtureMaterialId } })
  })
  it.each(['unavailable', 'disabled', 'not-ready'] as const)('shows the server reason and no working control when %s', async state => {
    setup({ band: 'teens', state, entry: true })
    const control = await screen.findByTestId('ask-co-unavailable')
    expect(within(control).getByRole('button', { name: 'Ask Co' })).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(within(control).getByRole('button', { name: 'Ask Co' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(control.textContent!.length).toBeGreaterThan('Ask Co'.length)
  })
  it.each(['denied', 'unreachable', 'ended'] as const)('shows nothing at all when the context cannot be read (%s)', async state => {
    const { server } = setup({ band: 'teens', state, entry: true })
    await waitFor(() => expect(server.calls.length).toBeGreaterThan(0))
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(screen.queryByRole('button', { name: 'Ask Co' })).toBeNull()
  })
})
