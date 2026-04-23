import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RoadmapsPageClient } from '@/components/roadmap/roadmaps-page-client'

const pushMock = vi.hoisted(() => vi.fn())
const createRoadmapMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
}))

const unifiedData = vi.hoisted(() => ({
  studyPlans: [] as any[],
  roadmaps: [] as any[],
  goalsWithoutRoadmap: [] as any[],
}))

vi.mock('@/lib/hooks/use-roadmap', () => ({
  useUnifiedRoadmaps: () => ({ data: unifiedData, isLoading: false }),
  useCreateRoadmap: () => ({
    mutateAsync: createRoadmapMock,
    isPending: false,
  }),
  useDeleteRoadmap: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}))

vi.mock('@/lib/hooks/use-goals', () => ({
  useDeleteGoal: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}))

vi.mock('@/lib/hooks/use-learner-terms', () => ({
  useLearnerTerms: () => ({
    planLabel: 'Study Plan',
    plansLabel: 'Study Plans',
    newPlanLabel: 'New Study Plan',
    goalLabel: 'Goal',
    goalsLabel: 'Goals',
    pageSubtitle: 'AI-generated learning paths, syllabus imports, and exam prep plans',
  }),
}))

vi.mock('@/components/roadmap/create-roadmap-modal', () => ({
  CreateRoadmapModal: () => null,
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <RoadmapsPageClient />
    </QueryClientProvider>
  )
}

describe('RoadmapsPageClient', () => {
  beforeEach(() => {
    pushMock.mockReset()
    createRoadmapMock.mockReset()
    unifiedData.roadmaps = []
    unifiedData.goalsWithoutRoadmap = []
    unifiedData.studyPlans = [
      {
        type: 'goal_recommendation',
        id: 'goal-1',
        sortDate: '2026-04-01T00:00:00.000Z',
        roadmap: null,
        goal: {
          id: 'goal-1',
          orgId: 'org-1',
          userId: 'user-1',
          title: 'Master .NET',
          description: 'Build confidence with .NET fundamentals',
          targetDate: null,
          status: 'ACTIVE',
          icon: null,
          color: null,
          learningGoalTag: null,
          sortOrder: 0,
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
      },
      {
        type: 'roadmap',
        id: 'roadmap-1',
        sortDate: '2026-03-01T00:00:00.000Z',
        goal: null,
        roadmap: {
          id: 'roadmap-1',
          orgId: 'org-1',
          userId: 'user-1',
          title: 'Full-Stack Web Development',
          description: 'A practical path through frontend and backend basics',
          mode: 'TOPIC',
          status: 'ACTIVE',
          goalId: null,
          totalPhases: 2,
          examDate: null,
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
          phases: [
            {
              id: 'phase-1',
              roadmapId: 'roadmap-1',
              phaseNumber: 1,
              title: 'Foundations',
              description: null,
              sortOrder: 0,
              items: [
                {
                  id: 'item-1',
                  phaseId: 'phase-1',
                  title: 'HTML Basics',
                  url: null,
                  sourceType: 'WEB',
                  description: null,
                  durationMin: 20,
                  status: 'CAPTURED',
                  extractionId: 'extraction-1',
                  sortOrder: 0,
                  metadata: null,
                },
              ],
            },
          ],
          goal: null,
        },
      },
    ]
  })

  it('renders recommendations and roadmaps in one list without split headings', () => {
    renderPage()

    expect(screen.getByText('Master .NET')).toBeInTheDocument()
    expect(screen.getByText('Full-Stack Web Development')).toBeInTheDocument()
    expect(screen.getByText('Recommended')).toBeInTheDocument()
    expect(screen.queryByText(/without study plans/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/your study plans/i)).not.toBeInTheDocument()
  })

  it('generates a study plan from a goal recommendation and opens the new roadmap', async () => {
    createRoadmapMock.mockResolvedValue({ roadmap: { id: 'roadmap-new' } })

    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /generate study plan/i }))

    expect(createRoadmapMock).toHaveBeenCalledWith({
      mode: 'TOPIC',
      topic: 'Master .NET',
      goalId: 'goal-1',
    })
    expect(pushMock).toHaveBeenCalledWith('/roadmaps/roadmap-new')
  })
})
