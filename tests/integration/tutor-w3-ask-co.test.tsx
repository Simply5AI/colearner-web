import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const co = vi.hoisted(() => ({
  getTutorContext: vi.fn(),
  listTutorSessions: vi.fn(),
  createTutorSession: vi.fn(),
  submitTutorTurn: vi.fn(),
  getTutorTurn: vi.fn(),
  getTutorSession: vi.fn(),
}))
vi.mock('@/lib/api/tutor-loop/co', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/api/tutor-loop/co')>()),
  ...co,
}))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { name: 'Rohan Mehta' } } }) }))
vi.mock('@/lib/api/tutor-loop/client', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/api/tutor-loop/client')>()
  return {
    ...actual,
    tutorLoopClient: {
      entry: vi.fn().mockResolvedValue({
        band: '14-17', scope: 'SCHOOL', needsOnboarding: false, needsConsent: false,
        capabilities: { canCreatePersonalPlan: true, canUseTutor: true, canUseMock: true, canUseMemory: true, findMaterial: 'HIDDEN' },
        tutorIdentity: { name: 'Sprig', icon: 'SPROUT' },
      }),
      plans: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    },
  }
})
vi.mock('@/lib/api/tutor-loop/profile', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/api/tutor-loop/profile')>()),
  getTutorProfile: vi.fn().mockResolvedValue({
    revision: 1, name: 'Sprig', icon: 'SPROUT', style: 'FRIENDLY', presence: 'AVAILABLE', nudgesEnabled: true,
    pinnedActions: ['EXPLAIN', 'QUIZ'], memoryOptIn: true, generalOptOut: true,
    accessibility: { textScale: 'NORMAL', easyRead: false, reducedMotion: false, readAloud: false },
  }),
}))

import { AskCoPage } from '@/components/tutor-loop/co/ask-co-page'
import { TutorCoApiError } from '@/lib/api/tutor-loop/co'

const baseContext = {
  context: { kind: 'GLOBAL' }, available: true, reasonCode: null, subjectRef: null, topicRef: null,
  source: null, suggestions: [], returnTo: null, groundingMode: 'MATERIAL_ONLY',
}
const wrap = (ui: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>
)

beforeEach(() => {
  vi.clearAllMocks()
  co.getTutorContext.mockResolvedValue(baseContext)
  co.listTutorSessions.mockResolvedValue({ items: [], nextCursor: null })
})

describe('W3 Ask Co page states', () => {
  it('shows the home view with the learner tutor name and quick actions', async () => {
    render(wrap(<AskCoPage initialContext={{ kind: 'GLOBAL' }} />))
    expect(await screen.findByRole('heading', { name: /Hi Rohan, I’m Sprig/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Explain a topic' })).toBeTruthy()
    expect(screen.getByText(/Answers come from your material/)).toBeTruthy()
  })

  it('shows the exam-away state and no composer', async () => {
    co.getTutorContext.mockRejectedValue(new TutorCoApiError(403, 'x', 'EXAM_CONDITIONS_ACTIVE'))
    render(wrap(<AskCoPage initialContext={{ kind: 'GLOBAL' }} />))
    expect(await screen.findByText(/is away during your exam/)).toBeTruthy()
    expect(screen.queryByLabelText(/Message/)).toBeNull()
  })

  it('shows resting when AI is unavailable and keeps the page usable', async () => {
    co.getTutorContext.mockResolvedValue({ ...baseContext, available: false, reasonCode: 'TUTOR_RESTING' })
    render(wrap(<AskCoPage initialContext={{ kind: 'GLOBAL' }} />))
    expect(await screen.findByText('Sprig is resting')).toBeTruthy()
    expect(screen.getByText(/sessions, library and practice still work/)).toBeTruthy()
  })

  it('offers retry when the context fails to load', async () => {
    co.getTutorContext.mockRejectedValueOnce(new TutorCoApiError(500, 'Something broke', 'X_ERR'))
    render(wrap(<AskCoPage initialContext={{ kind: 'GLOBAL' }} />))
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy()
  })

  it('sends a message, polls, and renders a cited reply plus a not-from-material block', async () => {
    co.createTutorSession.mockResolvedValue({ id: 's1', title: 'Acids', subjectRef: null, topicRef: null, status: 'OPEN', mode: 'ASK', lastTurnAt: null, expiresAt: null, turns: [], nextCursor: null })
    co.submitTutorTurn.mockResolvedValue({ id: 't1', sessionId: 's1', status: 'QUEUED', result: null, reasonCode: null, retryable: false, createdAt: 'x' })
    co.getTutorTurn.mockResolvedValue({
      id: 't1', sessionId: 's1', status: 'READY', reasonCode: null, retryable: false, createdAt: 'x',
      result: {
        move: 'EXPLAIN', question: null, brief: null, proposals: [], reasonCodes: ['LEARNER_ASKED'], disposition: 'TEACH',
        segments: [
          { source: 'MATERIAL', text: 'Acids give H+ ions.', citation: { materialId: 'm1', passageRef: 'p1', quote: 'Acids give H+ ions.', label: 'Class notes' } },
          { source: 'GENERAL', text: 'Vinegar is a weak acid.' },
        ],
      },
    })
    const { tutorPolling } = await import('@/components/tutor-loop/co/use-tutor-chat')
    tutorPolling.firstMs = 1
    tutorPolling.nextMs = 1
    render(wrap(<AskCoPage initialContext={{ kind: 'GLOBAL' }} />))
    await userEvent.type(await screen.findByLabelText('Message Sprig'), 'What is an acid?')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText('Acids give H+ ions.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Class notes/ })).toBeTruthy()
    expect(screen.getByText('Not from your material')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'I still don’t get it' })).toBeTruthy()
    await waitFor(() => expect(co.submitTutorTurn).toHaveBeenCalledWith('s1', expect.objectContaining({ text: 'What is an acid?', mode: 'ASK' })))
  })

  it('shows a friendly failure with retry on a failed turn', async () => {
    co.createTutorSession.mockResolvedValue({ id: 's1', title: 'x', subjectRef: null, topicRef: null, status: 'OPEN', mode: 'ASK', lastTurnAt: null, expiresAt: null, turns: [], nextCursor: null })
    co.submitTutorTurn.mockRejectedValue(new TutorCoApiError(503, 'Your tutor is resting. Try again soon.', 'TUTOR_RESTING'))
    render(wrap(<AskCoPage initialContext={{ kind: 'GLOBAL' }} />))
    await userEvent.type(await screen.findByLabelText('Message Sprig'), 'Hi')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText('Sprig is resting')).toBeTruthy()
  })
})
