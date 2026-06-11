import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminLearningOverview } from '@/components/admin/admin-learning/overview'
import { AdminLearningMastery } from '@/components/admin/admin-learning/mastery'
import { AdminLearningSessions } from '@/components/admin/admin-learning/sessions'
import { AdminLearningRoadmaps } from '@/components/admin/admin-learning/roadmaps'
import type {
  AdminLearningMasteryResponse,
  AdminLearningOverviewResponse,
  AdminLearningRoadmapsResponse,
  AdminLearningSessionsResponse,
} from '@/lib/api/admin'

const replaceMock = vi.hoisted(() => vi.fn())
const refreshMock = vi.hoisted(() => vi.fn())
const conceptAttemptsMock = vi.hoisted(() => vi.fn())
const sessionDetailMock = vi.hoisted(() => vi.fn())
const roadmapDetailMock = vi.hoisted(() => vi.fn())
let searchParamsValue = ''

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/users/user-1/learning/mastery',
  useRouter: () => ({ replace: replaceMock, refresh: refreshMock }),
  useSearchParams: () => new URLSearchParams(searchParamsValue),
}))

vi.mock('recharts', () => ({
  Cell: () => null,
  Pie: () => null,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
}))

vi.mock('@/lib/api/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/admin')>()
  return {
    ...actual,
    getAdminLearningConceptAttempts: conceptAttemptsMock,
    getAdminLearningSessionDetail: sessionDetailMock,
    getAdminLearningRoadmapDetail: roadmapDetailMock,
  }
})

const user = {
  id: 'user-1',
  email: 'learner@example.com',
  name: 'Learner One',
  avatarUrl: null,
  systemRole: 'MEMBER',
  status: 'ACTIVE' as const,
  org: { id: 'org-1', name: 'Demo Org', slug: 'demo', type: 'TEAM' },
  deletedAt: null,
  suspendedAt: null,
}

function overviewFixture(): AdminLearningOverviewResponse {
  return {
    user,
    stats: { mastered: 12, attempts: 30, lastActiveAt: '2026-05-21T00:00:00.000Z' },
    streak: { current: 3, longest: 9 },
    masterySummary: { mastered: 12, learning: 5, weak: 2 },
    goals: [{ id: 'goal-1', title: 'Pass finals', status: 'ACTIVE', targetDate: '2026-06-01T00:00:00.000Z', icon: null, color: null }],
    roadmaps: [{
      id: 'roadmap-1',
      title: 'Algebra',
      description: null,
      status: 'ACTIVE',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-20T00:00:00.000Z',
      totalConcepts: 10,
      masteredConcepts: 4,
      progressPercent: 40,
      generation: { model: 'gpt-test', promptVersion: null, durationMs: null, generatedAt: '2026-05-20T00:00:00.000Z' },
      isGenerationSlow: false,
    }],
    recentActivity: [{ id: 'a1', action: 'completed', subject: 'RecallSession', subjectId: 's1', metadata: { score: 92 }, createdAt: '2026-05-21T00:00:00.000Z' }],
  }
}

function masteryFixture(): AdminLearningMasteryResponse {
  return {
    items: [{
      id: 'concept-1',
      title: 'Variables',
      level: 'MASTERED',
      reviewEase: 2.7,
      attempts: 3,
      correctPercent: 67,
      lastReviewedAt: '2026-05-18T00:00:00.000Z',
      nextReviewAt: '2026-05-25T00:00:00.000Z',
      source: { id: 'extraction-1', title: 'Algebra Notes' },
    }],
    summary: { NEW: 0, LEARNING: 1, REVIEW: 1, MASTERED: 4, WEAK: 2 },
    sources: [{ id: 'extraction-1', title: 'Algebra Notes' }],
    nextCursor: '50',
  }
}

function sessionsFixture(): AdminLearningSessionsResponse {
  return {
    items: [{
      id: 'session-1',
      status: 'COMPLETED',
      score: 92,
      totalQuestions: 5,
      correctCount: 4,
      durationSeconds: 252,
      startedAt: '2026-05-21T00:00:00.000Z',
      completedAt: '2026-05-21T00:04:12.000Z',
      attempts: 5,
      conceptCount: 2,
      concepts: ['Variables', 'Equations'],
      source: { id: 'extraction-1', title: 'Algebra Notes' },
    }],
    sources: [{ id: 'extraction-1', title: 'Algebra Notes' }],
    nextCursor: null,
  }
}

function roadmapsFixture(): AdminLearningRoadmapsResponse {
  return {
    items: [{
      id: 'roadmap-1',
      title: 'Physics',
      description: null,
      status: 'GENERATING',
      createdAt: '2026-05-21T00:00:00.000Z',
      updatedAt: '2026-05-21T00:00:00.000Z',
      totalConcepts: 5,
      masteredConcepts: 2,
      progressPercent: 40,
      generation: { model: 'gpt-test', promptVersion: 'v1', durationMs: 1200, generatedAt: '2026-05-21T00:00:00.000Z' },
      isGenerationSlow: true,
    }],
    nextCursor: null,
  }
}

describe('Admin learning views', () => {
  beforeEach(() => {
    searchParamsValue = ''
    replaceMock.mockReset()
    refreshMock.mockReset()
    conceptAttemptsMock.mockReset()
    sessionDetailMock.mockReset()
    roadmapDetailMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders overview KPIs, chart, activity, and learning tabs', () => {
    render(<AdminLearningOverview data={overviewFixture()} />)

    expect(screen.getByText('Learner One')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /mastery/i })).toHaveAttribute('href', '/admin/users/user-1/learning/mastery')
    expect(screen.getByText('Concepts mastered')).toBeInTheDocument()
    expect(screen.getAllByText('12').length).toBeGreaterThan(0)
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
    expect(screen.getByText('Pass finals')).toBeInTheDocument()
    expect(screen.getByText('Algebra')).toBeInTheDocument()
    expect(screen.getByText(/RecallSession/)).toBeInTheDocument()
  })

  it('updates mastery filters and opens question history', async () => {
    const user = userEvent.setup()
    conceptAttemptsMock.mockResolvedValue({
      items: [{
        id: 'attempt-1',
        questionId: 'question-1',
        questionText: 'What is a variable?',
        correctAnswer: 'A symbol for a value',
        userAnswer: 'A letter',
        isCorrect: false,
        score: 4,
        feedback: 'Needs more precision',
        timeSpentSeconds: 20,
        createdAt: '2026-05-21T00:00:00.000Z',
        sessionId: 'session-1',
        sessionScore: 72,
      }],
      nextCursor: '1',
    })
    render(<AdminLearningMastery data={masteryFixture()} user={overviewFixture().user} authHeaders={{ Authorization: 'Bearer token' }} />)

    await user.type(screen.getByPlaceholderText(/search concepts/i), 'calc')
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(expect.stringContaining('search=calc'), { scroll: false })
    })

    await user.click(screen.getByLabelText('Learning level'))
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Review' }))
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(expect.stringContaining('levels=REVIEW'), { scroll: false })
    })

    await user.click(screen.getByRole('button', { name: /view question history/i }))
    await waitFor(() => {
      expect(conceptAttemptsMock).toHaveBeenCalledWith(
        { Authorization: 'Bearer token' },
        'user-1',
        'concept-1',
        { cursor: undefined }
      )
    })
    expect(await screen.findByText('A symbol for a value')).toBeInTheDocument()
    expect(screen.getByText('Load more attempts')).toBeInTheDocument()
  })

  it('filters sessions by source and opens detail with answer keys', async () => {
    const user = userEvent.setup()
    sessionDetailMock.mockResolvedValue({
      session: sessionsFixture().items[0],
      attempts: [{
        id: 'attempt-1',
        questionId: 'question-1',
        questionText: 'Explain variables',
        correctAnswer: 'Variables name values that can change.',
        userAnswer: 'A very long free-text answer about symbols and values. '.repeat(8),
        isCorrect: true,
        score: 1,
        feedback: 'Good',
        timeSpentSeconds: 30,
        createdAt: '2026-05-21T00:00:00.000Z',
        concept: { id: 'concept-1', title: 'Variables' },
      }],
    })
    render(<AdminLearningSessions data={sessionsFixture()} user={overviewFixture().user} authHeaders={{ Authorization: 'Bearer token' }} />)

    await user.click(screen.getByLabelText('Session source'))
    await user.click(await screen.findByRole('option', { name: 'Algebra Notes' }))
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(expect.stringContaining('sourceId=extraction-1'), { scroll: false })
    })

    await user.click(screen.getByRole('button', { name: /view session detail/i }))

    expect(await screen.findByText(/very long free-text answer/i)).toBeInTheDocument()
    expect(screen.getByText('Variables name values that can change.')).toBeInTheDocument()
    expect(screen.getByText('Show full answer')).toBeInTheDocument()
  })

  it('polls while roadmaps are generating', () => {
    vi.useFakeTimers()
    render(<AdminLearningRoadmaps data={roadmapsFixture()} user={overviewFixture().user} authHeaders={{ Authorization: 'Bearer token' }} />)

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(refreshMock).toHaveBeenCalled()
  })

  it('renders roadmap progress and opens detail', async () => {
    const user = userEvent.setup()
    roadmapDetailMock.mockResolvedValue({
      ...roadmapsFixture().items[0],
      goal: null,
      subject: null,
      phases: [{
        id: 'phase-1',
        title: 'Foundations',
        description: 'Start here',
        sortOrder: 1,
        items: [{
          id: 'item-1',
          title: 'Forces intro',
          status: 'COMPLETED',
          sourceType: 'YOUTUBE',
          extraction: { id: 'extraction-1', title: 'Forces Video', status: 'COMPLETED' },
        }],
      }],
      concepts: [{ id: 'rc-1', conceptId: 'concept-1', title: 'Forces', description: null, masteryState: 'MASTERED', phase: null, addedAt: '2026-05-21T00:00:00.000Z', updatedAt: '2026-05-21T00:00:00.000Z' }],
    })
    render(<AdminLearningRoadmaps data={roadmapsFixture()} user={overviewFixture().user} authHeaders={{ Authorization: 'Bearer token' }} />)

    expect(screen.getByText('Generation slow')).toBeInTheDocument()
    expect(screen.getByText('40%')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /view roadmap detail/i }))

    expect(await screen.findByText('Forces')).toBeInTheDocument()
    expect(screen.getByText('Foundations')).toBeInTheDocument()
    expect(screen.getByText('Forces intro')).toBeInTheDocument()
  })
})
