import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type React from 'react'
import { SessionConfigPanel } from '@/components/recall/session-config-panel'
import { RecallSession } from '@/components/recall/recall-session'
import { createRecallSession, getAttemptDiagnosis, getSessionQuestions, submitRecallAnswer } from '@/lib/api/recall'
import { getExtraction } from '@/lib/api/extraction'
import { useRecallStore } from '@/lib/stores/recall-store'
import type { AnswerResult, QuestionWithMeta } from '@/lib/types'

vi.mock('@/lib/api/recall', () => ({
  createRecallSession: vi.fn(),
  getSessionQuestions: vi.fn(),
  submitRecallAnswer: vi.fn(),
  skipRecallQuestion: vi.fn(),
  completeRecallSession: vi.fn(),
  getAttemptDiagnosis: vi.fn(),
}))

vi.mock('@/lib/api/extraction', () => ({
  getExtraction: vi.fn(),
}))

vi.mock('@/components/tutor/tutor-fab', () => ({
  TutorFAB: () => null,
}))

vi.mock('@/components/tutor/tutor-drawer', () => ({
  TutorDrawer: () => null,
}))

vi.mock('@/components/recall/tutoring-panel', () => ({
  TutoringPanel: () => null,
}))

const mockedCreateRecallSession = vi.mocked(createRecallSession)
const mockedGetSessionQuestions = vi.mocked(getSessionQuestions)
const mockedSubmitRecallAnswer = vi.mocked(submitRecallAnswer)
const mockedGetAttemptDiagnosis = vi.mocked(getAttemptDiagnosis)
const mockedGetExtraction = vi.mocked(getExtraction)

const headers = { Authorization: 'Bearer token' }

const baseQuestion: QuestionWithMeta = {
  id: 'question-1',
  text: 'Explain vector similarity.',
  type: 'FREE_TEXT',
  intent: 'DIRECT',
  conceptId: 'concept-1',
  conceptTitle: 'Vector similarity',
  extractionId: 'extraction-1',
  sortOrder: 0,
  answered: false,
  skipped: false,
}

const wrongAnswer: AnswerResult = {
  attemptId: 'attempt-1',
  isCorrect: false,
  score: 3,
  feedback: 'Not quite.',
  correctAnswer: 'Compare the angle between vectors.',
  reviewScheduleDelta: {
    reviewEaseBefore: 2.5,
    reviewEaseAfter: 2.3,
    intervalBefore: 1,
    intervalAfter: 0,
    repsBefore: 1,
    repsAfter: 0,
  },
  correctCount: 0,
  totalAttempts: 1,
  accuracy: 0,
}

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>,
  )
}

async function renderAnsweredSession(question: QuestionWithMeta, result: AnswerResult) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  mockedGetSessionQuestions.mockResolvedValueOnce([question])
  mockedGetExtraction.mockResolvedValue({
    id: 'extraction-1',
    title: 'Vectors',
  } as Awaited<ReturnType<typeof getExtraction>>)
  mockedSubmitRecallAnswer.mockResolvedValueOnce(result)

  renderWithQueryClient(<RecallSession sessionId="session-1" authHeaders={headers} />)

  expect(await screen.findByText(question.text)).toBeInTheDocument()
  if (question.type === 'MULTIPLE_CHOICE' || question.type === 'TRUE_FALSE') {
    await user.click(screen.getByRole('button', { name: /option alpha/i }))
    await user.click(screen.getByRole('button', { name: /confirm answer/i }))
  } else {
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'My answer' } })
    await user.click(screen.getByRole('button', { name: /submit answer/i }))
  }
  await waitFor(async () => {
    expect(await screen.findAllByText(result.feedback)).not.toHaveLength(0)
  })
}

describe('agentic recall frontend integration', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockedCreateRecallSession.mockReset()
    mockedGetSessionQuestions.mockReset()
    mockedSubmitRecallAnswer.mockReset()
    mockedGetAttemptDiagnosis.mockReset()
    mockedGetExtraction.mockReset()
    useRecallStore.getState().reset()
  })

  afterEach(() => {
    vi.useRealTimers()
    useRecallStore.getState().reset()
  })

  it('uses the selected time budget when starting a session', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mockedCreateRecallSession.mockResolvedValueOnce({
      id: 'session-1',
      orgId: 'org-1',
      userId: 'user-1',
      extractionId: 'extraction-1',
      status: 'IN_PROGRESS',
      totalQuestions: 10,
      startedAt: '2026-05-16T00:00:00.000Z',
      createdAt: '2026-05-16T00:00:00.000Z',
    })

    render(
      <SessionConfigPanel
        extractionId="extraction-1"
        authHeaders={headers}
        selectedConceptIds={['concept-1', 'concept-2']}
        conceptCount={2}
      />,
    )

    await user.click(screen.getByRole('button', { name: '45 min' }))
    await user.click(screen.getByRole('button', { name: /start practice session/i }))

    await waitFor(() => {
      expect(mockedCreateRecallSession).toHaveBeenCalledWith(
        headers,
        expect.objectContaining({ availableMinutes: 45 }),
      )
    })
  })

  it('polls and shows a diagnosis after a wrong free-text answer', async () => {
    mockedGetAttemptDiagnosis
      .mockResolvedValueOnce({ ready: false })
      .mockResolvedValueOnce({
        ready: true,
        classification: 'CONFUSED_WITH',
        explanation: 'You treated cosine similarity like dot product magnitude.',
        createdAt: '2026-05-16T00:00:00.000Z',
      })

    await renderAnsweredSession(baseQuestion, wrongAnswer)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })
    expect(mockedGetAttemptDiagnosis).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })
    expect(await screen.findByText('Tutor explanation')).toBeInTheDocument()
    expect(screen.getByText(/cosine similarity like dot product magnitude/i)).toBeInTheDocument()
  })

  it('does not poll for correct answers', async () => {
    await renderAnsweredSession(baseQuestion, { ...wrongAnswer, isCorrect: true, score: 9, feedback: 'Correct!' })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000)
    })

    expect(mockedGetAttemptDiagnosis).not.toHaveBeenCalled()
  })

  it('does not poll for wrong multiple-choice answers', async () => {
    await renderAnsweredSession(
      { ...baseQuestion, type: 'MULTIPLE_CHOICE', options: ['Option alpha', 'Option beta'] },
      wrongAnswer,
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000)
    })

    expect(mockedGetAttemptDiagnosis).not.toHaveBeenCalled()
  })

  it('stops polling after the 15 second cap and does not render the panel', async () => {
    mockedGetAttemptDiagnosis.mockResolvedValue({ ready: false })

    await renderAnsweredSession(baseQuestion, wrongAnswer)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000)
    })

    expect(mockedGetAttemptDiagnosis.mock.calls.length).toBeLessThanOrEqual(8)
    expect(screen.queryByText('Tutor explanation')).not.toBeInTheDocument()
  })

  it('keeps existing feedback when diagnosis is not ready or errors', async () => {
    mockedGetAttemptDiagnosis
      .mockResolvedValueOnce({ ready: false })
      .mockRejectedValueOnce(new Error('network'))

    await renderAnsweredSession(baseQuestion, wrongAnswer)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000)
    })

    expect(screen.getByText('Not quite.')).toBeInTheDocument()
    expect(screen.queryByText('Tutor explanation')).not.toBeInTheDocument()
  })
})
