import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TutorLoopApiError, setTutorLoopFixtureMode } from '@/lib/api/tutor-loop/client'
import { getTutorFixture } from '@/lib/api/tutor-loop/fixtures'
import { tutorPracticeApi, type MockBuild } from '@/lib/api/tutor-loop/practice'
import { TutorShellProvider } from '@/components/tutor-loop/shell/tutor-shell-context'
import { PracticeSetScreen } from '@/components/tutor-loop/practice/practice-session'
import { MockBuilder } from '@/components/tutor-loop/practice/mock-builder'
import { MockSittingScreen } from '@/components/tutor-loop/practice/mock-sitting'
import { ShortLessonScreen } from '@/components/tutor-loop/lesson/short-lesson'
import { ShortLessonStarter } from '@/components/tutor-loop/lesson/lesson-entry'
import { MockReviewScreen } from '@/components/tutor-loop/practice/mock-review'

const push = vi.fn()
const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => '/learn/practice',
  useSearchParams: () => new URLSearchParams(),
}))
const wrap = (ui: React.ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><TutorShellProvider>{ui}</TutorShellProvider></QueryClientProvider>)
}
const question = {
  kind: 'MCQ', prompt: 'What colour does blue litmus turn in an acid?', options: [{ id: 'a', text: 'Blue' }, { id: 'b', text: 'Red' }],
  itemIndex: 0, questionId: 'q1', hintsAvailable: 3, sourceLink: null, timeLimitSec: null, attemptsAllowed: 3, attemptNo: 1,
}
const receipt = (correct: boolean, attemptNo = 1) => ({ sessionId: 's', itemId: 'i', attemptId: `at${attemptNo}`, attemptNo, gradingStatus: 'NOT_NEEDED', score: correct ? 1 : 0, correct, confidence: 'SURE', replay: false })
const build = (over: Partial<MockBuild>): MockBuild => ({ ...(getTutorFixture('mockBuildShortfall') as MockBuild), ...over })
const exam = { id: 'e1', goalId: 'g1', title: 'Board exams', date: '2027-03-02', passMarkPercent: null, revision: 1 }

describe('W4 states', () => {
  beforeEach(() => { setTutorLoopFixtureMode(false); push.mockReset(); replace.mockReset() })
  afterEach(() => { setTutorLoopFixtureMode(null); vi.restoreAllMocks() })

  it('practice session: hint, confidence, wrong then retry then right, summary', async () => {
    vi.spyOn(tutorPracticeApi, 'item').mockResolvedValue({ index: 0, itemId: 'i', question } as never)
    vi.spyOn(tutorPracticeApi, 'hint').mockResolvedValue({ index: 0, itemId: 'i', level: 1, text: 'Think about acids.', remaining: 2 })
    const answer = vi.spyOn(tutorPracticeApi, 'answer').mockResolvedValueOnce(receipt(false)).mockResolvedValueOnce(receipt(true, 2))
    vi.spyOn(tutorPracticeApi, 'finish').mockResolvedValue({ sessionId: 's', status: 'COMPLETED' })
    vi.spyOn(tutorPracticeApi, 'nextStep').mockResolvedValue(getTutorFixture('nextStep') as never)
    wrap(<PracticeSetScreen sessionId="s" total={1} />)
    expect(await screen.findByText('Multiple choice')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Need a hint?' }))
    expect(await screen.findByText(/Think about acids/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Sure' }))
    await userEvent.click(screen.getByRole('radio', { name: /Blue/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(await screen.findByText(/Not yet/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await userEvent.click(await screen.findByRole('radio', { name: /Red/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(await screen.findByText(/Yes, that is right/)).toBeTruthy()
    expect(answer.mock.calls[0]![2].confidence).toBe('SURE')
    expect(answer.mock.calls[0]![2].clientAttemptId).not.toBe(answer.mock.calls[1]![2].clientAttemptId)
    await userEvent.click(screen.getByRole('button', { name: 'Finish' }))
    expect(await screen.findByText('Set done')).toBeTruthy()
    expect(screen.getByText('1 of 1 right first time')).toBeTruthy()
  })

  it('mock builder: shortfall offers a shorter mock and add material, never pads', async () => {
    vi.spyOn(tutorPracticeApi, 'createMockBuild').mockResolvedValue(build({ status: 'QUEUED' }))
    vi.spyOn(tutorPracticeApi, 'mockBuild').mockResolvedValue(build({}))
    const start = vi.spyOn(tutorPracticeApi, 'startMock').mockResolvedValue(getTutorFixture('mockSitting') as never)
    wrap(<MockBuilder exam={exam} topics={[]} onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Build my mock' }))
    expect(await screen.findByText(/only covers 7 of 10/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Add material' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /Start a shorter mock · 7 questions · 11 min/ }))
    expect(start.mock.calls[0]![1].acceptShorter).toBe(true)
    await waitFor(() => expect(push).toHaveBeenCalledWith(expect.stringContaining('/learn/practice/mock/')))
  })

  it('mock builder: failed build shows closed copy and retry; daily limit shows its own message', async () => {
    const create = vi.spyOn(tutorPracticeApi, 'createMockBuild').mockResolvedValueOnce(build({ status: 'QUEUED' }))
    vi.spyOn(tutorPracticeApi, 'mockBuild').mockResolvedValue(build({ status: 'FAILED', reasonCode: 'AI_UNAVAILABLE', retryable: true, alternatives: [] }))
    wrap(<MockBuilder exam={exam} topics={[]} onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Build my mock' }))
    expect(await screen.findByText(/Your tutor is resting/)).toBeTruthy()
    create.mockRejectedValueOnce(new TutorLoopApiError(429, 'x', 'DAILY_MOCK_LIMIT', 3600))
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await userEvent.click(screen.getByRole('button', { name: 'Build my mock' }))
    expect(await screen.findByText(/reached today’s limit for building mock exams/)).toBeTruthy()
  })

  it('sitting: shows the exam-conditions banner and tutor away; offline save shows reconnecting then recovers', async () => {
    vi.spyOn(tutorPracticeApi, 'sitting').mockResolvedValue(getTutorFixture('mockSitting') as never)
    vi.spyOn(tutorPracticeApi, 'mockItem').mockResolvedValue({
      index: 0, itemId: 'i', topicId: null, question: { ...question, hintsAvailable: 0, attemptsAllowed: 1 }, draft: { answer: null, flagged: false, revision: 0, savedAt: null },
    } as never)
    const save = vi.spyOn(tutorPracticeApi, 'saveMockItem')
      .mockRejectedValueOnce(new TutorLoopApiError(503, 'down'))
      .mockResolvedValue({ index: 0, itemId: 'i', answer: { kind: 'MCQ', optionId: 'b' }, flagged: false, revision: 1, savedAt: null })
    wrap(<MockSittingScreen sessionId="s" />)
    expect(await screen.findByText(/is away until you finish/)).toBeTruthy()
    expect(screen.getByText(/Exam conditions: no hints/)).toBeTruthy()
    await userEvent.click(await screen.findByRole('radio', { name: /Red/ }))
    expect(await screen.findByText(/Reconnecting/, undefined, { timeout: 3000 })).toBeTruthy()
    await waitFor(() => expect(screen.queryByText(/Reconnecting/)).toBeNull(), { timeout: 5000 })
    expect(save).toHaveBeenCalledTimes(2)
    // the retry sends the same revision, so the server stays idempotent
    expect(save.mock.calls[1]![2].revision).toBe(save.mock.calls[0]![2].revision)
  })

  it('sitting with conditions off is labelled a practice simulation', async () => {
    vi.spyOn(tutorPracticeApi, 'sitting').mockResolvedValue({ ...(getTutorFixture('mockSitting') as object), conditions: false } as never)
    vi.spyOn(tutorPracticeApi, 'mockItem').mockResolvedValue({ index: 0, itemId: 'i', question, draft: { answer: null, flagged: false, revision: 0, savedAt: null } } as never)
    wrap(<MockSittingScreen sessionId="s" />)
    expect(await screen.findByText(/Practice simulation/)).toBeTruthy()
  })

  it('review shows your answer, the right answer and the source', async () => {
    setTutorLoopFixtureMode(true)
    wrap(<MockReviewScreen sessionId="10000000-0000-4000-8000-000000000006" />)
    expect(await screen.findByText(/Your answer: Red/)).toBeTruthy()
    expect(screen.getByText(/Class notes · p\. 4/)).toBeTruthy()
  })

  it('practice answer: shows the explanation when present, tutor link when null', async () => {
    vi.spyOn(tutorPracticeApi, 'item').mockResolvedValue({ index: 0, itemId: 'i', question } as never)
    vi.spyOn(tutorPracticeApi, 'answer').mockResolvedValue({ ...receipt(true), explanation: 'Acids turn litmus red.' })
    wrap(<PracticeSetScreen sessionId="s" total={1} />)
    await userEvent.click(await screen.findByRole('radio', { name: /Red/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(await screen.findByText('Acids turn litmus red.')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Want to see why?' })).toBeNull()
  })

  it('practice answer without explanation keeps the tutor handoff', async () => {
    vi.spyOn(tutorPracticeApi, 'item').mockResolvedValue({ index: 0, itemId: 'i', question } as never)
    vi.spyOn(tutorPracticeApi, 'answer').mockResolvedValue({ ...receipt(true), explanation: null })
    wrap(<PracticeSetScreen sessionId="s" total={1} />)
    await userEvent.click(await screen.findByRole('radio', { name: /Red/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect((await screen.findByRole('link', { name: 'Want to see why?' })).getAttribute('href')).toContain('/learn/co')
  })

  it('short lesson: check then complete through the tutor routes', async () => {
    vi.spyOn(tutorPracticeApi, 'shortLesson').mockResolvedValue(getTutorFixture('shortLessonReady') as never)
    const check = vi.spyOn(tutorPracticeApi, 'checkLesson').mockResolvedValue({ correct: true, feedback: null, correctOptionId: 'red' })
    const complete = vi.spyOn(tutorPracticeApi, 'completeLesson').mockResolvedValue({ lessonId: 'l', completedAt: '2026-11-13T09:00:00Z' })
    vi.spyOn(tutorPracticeApi, 'nextStep').mockResolvedValue(getTutorFixture('nextStep') as never)
    wrap(<ShortLessonScreen lessonId="l" />)
    for (let k = 0; k < 3; k++) await userEvent.click(await screen.findByRole('button', { name: 'Next' }))
    await userEvent.click(await screen.findByRole('radio', { name: /It turns red/ }))
    expect(check).toHaveBeenCalledWith('l', 'red')
    await userEvent.click(await screen.findByRole('button', { name: 'Finish' }))
    expect(await screen.findByText('Lesson done')).toBeTruthy()
    expect(complete).toHaveBeenCalledWith('l')
  })

  it('short lesson: CHECK_REQUIRED on complete keeps the learner on the card', async () => {
    vi.spyOn(tutorPracticeApi, 'shortLesson').mockResolvedValue(getTutorFixture('shortLessonReady') as never)
    vi.spyOn(tutorPracticeApi, 'checkLesson').mockResolvedValue({ correct: true })
    vi.spyOn(tutorPracticeApi, 'completeLesson').mockRejectedValue(new TutorLoopApiError(409, 'x', 'CHECK_REQUIRED'))
    wrap(<ShortLessonScreen lessonId="l" />)
    for (let k = 0; k < 3; k++) await userEvent.click(await screen.findByRole('button', { name: 'Next' }))
    await userEvent.click(await screen.findByRole('radio', { name: /It turns red/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Finish' }))
    expect(await screen.findByText(/Answer the question correctly first/)).toBeTruthy()
  })

  it('starter falls back to the five-card lesson when AI is unavailable', async () => {
    vi.spyOn(tutorPracticeApi, 'createShortLesson').mockRejectedValue(new TutorLoopApiError(503, 'x', 'AI_UNAVAILABLE'))
    wrap(<ShortLessonStarter materialId="m-1234567" topicId="t-1234567" />)
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/learn/lesson/new?materialId=m-1234567'))
  })
})
