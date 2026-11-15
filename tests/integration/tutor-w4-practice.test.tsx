import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setTutorLoopFixtureMode } from '@/lib/api/tutor-loop/client'
import { TutorShellProvider } from '@/components/tutor-loop/shell/tutor-shell-context'
import { PracticeHub } from '@/components/tutor-loop/practice/practice-hub'
import { MockResultScreen } from '@/components/tutor-loop/practice/mock-result'
import { MockSittingScreen } from '@/components/tutor-loop/practice/mock-sitting'
import { ShortLessonScreen } from '@/components/tutor-loop/lesson/short-lesson'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/learn/practice',
  useSearchParams: () => new URLSearchParams(),
}))

const wrap = (ui: React.ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><TutorShellProvider>{ui}</TutorShellProvider></QueryClientProvider>)
}

describe('W4 practice, mock and lesson (fixtures)', () => {
  beforeEach(() => setTutorLoopFixtureMode(true))
  afterEach(() => setTutorLoopFixtureMode(null))

  it('shows due review, topic chips, and opens the topic sheet with In short', async () => {
    wrap(<PracticeHub />)
    expect(await screen.findByText(/Today’s review/)).toBeTruthy()
    await userEvent.click(await screen.findByRole('button', { name: /Acids, bases and salts/ }))
    expect(await screen.findByText(/Acids turn blue litmus red/)).toBeTruthy()
    expect(screen.getByText('Question set')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Short lesson/ })).toBeTruthy()
  })

  it('opens the topic sheet from topicId and the exam tab with readiness and past mocks', async () => {
    wrap(<PracticeHub initialTab="exam" initialTopicId="10000000-0000-4000-8000-000000000004" />)
    expect(await screen.findByRole('dialog', { name: /Acids, bases and salts/ })).toBeTruthy()
    expect(await screen.findByText(/60% ready/)).toBeTruthy()
    expect(screen.getByText('Past mocks')).toBeTruthy()
  })

  it('shows the sitting with the tutor away, a timer and a navigator', async () => {
    wrap(<MockSittingScreen sessionId="10000000-0000-4000-8000-000000000006" />)
    expect(await screen.findByText(/is away until you finish/)).toBeTruthy()
    expect(await screen.findByRole('timer')).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Question navigator' })).toBeTruthy()
    expect(await screen.findByText('What colour does blue litmus turn in an acid?')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /hint/i })).toBeNull()
  })

  it('shows the mock result by topic with suggested actions', async () => {
    wrap(<MockResultScreen sessionId="10000000-0000-4000-8000-000000000006" />)
    expect(await screen.findByText('60%')).toBeTruthy()
    expect(screen.getByText('Acids, bases and salts')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Practise acids and bases/ })).toBeTruthy()
  })

  it('walks the four lesson cards to Lesson done', async () => {
    wrap(<ShortLessonScreen lessonId="10000000-0000-4000-8000-000000000018" />)
    expect(await screen.findByText('The idea')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Try it')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Finish' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
