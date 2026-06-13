export interface PlanAggregateAnalytics {
  planId: string
  enrollmentCount: number
  avgProgress: number
  avgExamScore: number
  hardestTopic: string
  strongestTopic: string
  scoreDistribution: { range: string; count: number }[]
  engagementTrend: { date: string; sessions: number }[]
}

export interface PlanRosterEntry {
  studentUserId: string
  studentName: string
  studentEmail: string
  progressPercent: number
  masteryLevel: 'new' | 'learning' | 'review' | 'mastered' | 'excel'
  lastActiveAt: string | null
  lastExamScore: number | null
}

export const planAnalyticsFixtures: Record<string, PlanAggregateAnalytics> = {
  'plan-algorithms-101': {
    planId: 'plan-algorithms-101',
    enrollmentCount: 12,
    avgProgress: 58,
    avgExamScore: 74,
    hardestTopic: 'Graph Theory',
    strongestTopic: 'Sorting Algorithms',
    scoreDistribution: [
      { range: '0-49', count: 1 },
      { range: '50-69', count: 4 },
      { range: '70-89', count: 5 },
      { range: '90-100', count: 2 },
    ],
    engagementTrend: [
      { date: '2026-06-07', sessions: 8 },
      { date: '2026-06-08', sessions: 12 },
      { date: '2026-06-09', sessions: 10 },
      { date: '2026-06-10', sessions: 15 },
      { date: '2026-06-11', sessions: 11 },
      { date: '2026-06-12', sessions: 14 },
    ],
  },
}

export const planRosterFixtures: Record<string, PlanRosterEntry[]> = {
  'plan-algorithms-101': [
    {
      studentUserId: 'student-demo',
      studentName: 'Demo Student',
      studentEmail: 'student@demo.colearner.ai',
      progressPercent: 42,
      masteryLevel: 'learning',
      lastActiveAt: '2026-06-12T18:30:00.000Z',
      lastExamScore: 78,
    },
    {
      studentUserId: 'student-2',
      studentName: 'Alex Chen',
      studentEmail: 'alex@school.edu',
      progressPercent: 67,
      masteryLevel: 'review',
      lastActiveAt: '2026-06-11T14:00:00.000Z',
      lastExamScore: 85,
    },
  ],
}