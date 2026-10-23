import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { id: 'learner-fixture' } } }) }))
import { TeacherLessonReader } from '@/components/learn/teacher-lesson-reader'
import { LearnIdentityProvider } from '@/components/learn/learn-common'
import { PlanDetailView } from '@/components/learn/learn-plan'
import { learnApi } from '@/lib/api/learn'
import { planFixture } from '@/components/learn/dev/learn-fixtures'
import { learnerLessonView, withTeacherLesson } from '@/app/dev/learn/teacher-lesson/harness'
import { studentLessonViewSchema } from '@/lib/api/teaching/lesson-schema'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
beforeEach(() => vi.clearAllMocks())
const view = () => studentLessonViewSchema.parse(learnerLessonView())

it('shows From your teacher, never an AI label, and steps with Back and Next', () => {
  render(<TeacherLessonReader view={view()} band="tweens" />)
  expect(screen.getByTestId('from-teacher')).toHaveTextContent('From your teacher')
  expect(document.body.textContent).not.toMatch(/Made by Co|Co draft|AI-generated|Co made this/)
  expect(screen.getByTestId('lesson-progress')).toHaveTextContent('Step 1 of 5')
  expect(screen.getByRole('button', { name: /Back/ })).toBeDisabled()
  fireEvent.click(screen.getByTestId('lesson-next'))
  expect(screen.getByTestId('lesson-progress')).toHaveTextContent('Step 2 of 5')
  expect(screen.getByRole('heading', { name: 'Add the tops, keep the bottom' })).toHaveFocus()
  expect(within(screen.getByTestId('lesson-sources')).getByRole('link', { name: 'Mr. Thomas notes' })).toHaveAttribute('href', '/learn/library/mat-pdf')
})
it('renders plain text only: markup in a block stays text and no link comes from a block', () => {
  const hostile = view(); hostile.steps[0]!.blocks = [{ type: 'TEXT', text: '<img src=x onerror=alert(1)> <a href="javascript:alert(1)">click</a>' }]
  const { container } = render(<TeacherLessonReader view={hostile} band="teens" />)
  expect(container.querySelector('img')).toBeNull(); expect(container.querySelector('a[href^="javascript"]')).toBeNull()
  expect(container).toHaveTextContent('<img src=x onerror=alert(1)>')
})
it('a check calls the server, shows its feedback and is not stored; an error keeps the answer', async () => {
  const onCheck = vi.fn().mockResolvedValueOnce({ correct: false, feedback: 'The bottom number stays 8.', correctOptionId: null }).mockRejectedValueOnce(new Error('Learning services are unavailable right now.')).mockResolvedValueOnce({ correct: true, feedback: 'Yes.', correctOptionId: 'opt-b' })
  render(<TeacherLessonReader view={view()} band="tweens" onCheck={onCheck} />)
  for (let step = 0; step < 3; step += 1) fireEvent.click(screen.getByTestId('lesson-next'))
  fireEvent.click(screen.getByRole('radio', { name: '5/16' })); fireEvent.click(screen.getByRole('button', { name: 'Check my answer' }))
  expect(await screen.findByTestId('check-result')).toHaveAttribute('data-correct', 'false')
  expect(onCheck).toHaveBeenCalledWith(3, 'opt-a')
  fireEvent.click(screen.getByRole('radio', { name: '5/8' })); fireEvent.click(screen.getByRole('button', { name: 'Check my answer' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('unavailable')
  expect(screen.getByRole('radio', { name: '5/8' })).toBeChecked()
  fireEvent.click(screen.getByRole('button', { name: 'Check my answer' }))
  await waitFor(() => expect(screen.getByTestId('check-result')).toHaveAttribute('data-correct', 'true'))
  expect(screen.getByRole('radio', { name: '5/8' })).toBeDisabled()
  expect(screen.getByText(/not a grade and is not saved/)).toBeVisible()
})
it('preview mode gives no feedback and says why', () => {
  render(<TeacherLessonReader view={view()} band="kids" mode="preview" />)
  for (let step = 0; step < 3; step += 1) fireEvent.click(screen.getByTestId('lesson-next'))
  expect(screen.getByTestId('preview-check-note')).toHaveTextContent('Preview only')
  expect(screen.queryByRole('button', { name: 'Check my answer' })).toBeNull()
})
it('finishing shows the key terms', () => {
  render(<TeacherLessonReader view={view()} band="teens" />)
  for (let step = 0; step < 4; step += 1) fireEvent.click(screen.getByTestId('lesson-next'))
  fireEvent.click(screen.getByTestId('lesson-finish-step'))
  expect(screen.getByTestId('lesson-done')).toHaveTextContent('Denominator')
})

function fetchReturning(payload: unknown, status = 200) { vi.stubGlobal('fetch', vi.fn(async () => Response.json(status === 200 ? { statusCode: 200, data: payload, timestamp: 'x' } : payload, { status }))) }
it('learnApi refuses a teacher lesson payload that carries the answer key (parse failure, not a silent strip)', async () => {
  const leaked = learnerLessonView() as unknown as { steps: { check: Record<string, unknown> | null }[] }
  leaked.steps[3]!.check!.correctOptionId = 'opt-b'
  fetchReturning({ planId: 'p', topicId: 't', version: 2, publishedAt: '2026-10-22T08:00:00Z', view: leaked })
  await expect(learnApi.teacherLesson('p', 't')).rejects.toMatchObject({ status: 502 })
  const withFeedback = learnerLessonView() as unknown as { steps: { check: { options: Record<string, unknown>[] } | null }[] }
  withFeedback.steps[3]!.check!.options[0]!.feedback = 'x'
  fetchReturning({ planId: 'p', topicId: 't', version: 2, publishedAt: '2026-10-22T08:00:00Z', view: withFeedback })
  await expect(learnApi.teacherLesson('p', 't')).rejects.toMatchObject({ status: 502 })
  fetchReturning({ planId: 'p', topicId: 't', version: 2, publishedAt: '2026-10-22T08:00:00Z', view: learnerLessonView() })
  await expect(learnApi.teacherLesson('p', 't')).resolves.toMatchObject({ version: 2 })
})
it('a missing lesson is the same plain failure whatever the reason', async () => {
  fetchReturning({ code: 'LESSON_UNAVAILABLE' }, 404)
  await expect(learnApi.teacherLesson('p', 't')).rejects.toMatchObject({ status: 404 })
})

function plan(withLesson: boolean) {
  const { detail } = planFixture('tweens'); const topicId = detail.phases[1]!.topics[0]!.id
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><LearnIdentityProvider scope="b12:test" band="tweens"><PlanDetailView detail={withLesson ? withTeacherLesson(detail, topicId) : detail} band="tweens" /></LearnIdentityProvider></QueryClientProvider>)
}
it('the lesson link appears in the topic only when the plan carries a published teacher lesson', () => {
  plan(true); expect(screen.getAllByTestId('teacher-lesson-link')).toHaveLength(1)
  expect(screen.getByTestId('teacher-lesson-link')).toHaveTextContent('From your teacher'); cleanup()
  plan(false); expect(screen.queryByTestId('teacher-lesson-link')).toBeNull()
})
it('opening the lesson loads it with the strict schema and shows the reader; a 404 shows a plain message', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ statusCode: 200, data: { planId: 'plan-assigned', topicId: 't', version: 2, publishedAt: '2026-10-22T08:00:00Z', view: learnerLessonView() }, timestamp: 'x' })))
  plan(true)
  fireEvent.click(within(screen.getByTestId('teacher-lesson-link')).getByRole('button', { name: 'Open lesson' }))
  expect(await screen.findByTestId('teacher-lesson')).toBeVisible()
  fireEvent.click(within(screen.getByTestId('teacher-lesson-link')).getByRole('button', { name: 'Close lesson' }))
  expect(screen.queryByTestId('teacher-lesson')).toBeNull()
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ code: 'LESSON_UNAVAILABLE' }, { status: 404 })))
  fireEvent.click(within(screen.getByTestId('teacher-lesson-link')).getByRole('button', { name: 'Open lesson' }))
  expect(await screen.findByText('This lesson is not available right now.')).toBeVisible()
})
it('an older server without the teacherLesson field still parses (additive and optional)', async () => {
  const { detail } = planFixture('tweens')
  fetchReturning(detail)
  await expect(learnApi.plan('plan-assigned')).resolves.toBeTruthy()
  fetchReturning(withTeacherLesson(detail, detail.phases[0]!.topics[0]!.id))
  const parsed = await learnApi.plan('plan-assigned'); expect(parsed.phases[0]!.topics[0]!.teacherLesson).toMatchObject({ version: 2 })
})
