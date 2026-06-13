import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { planAnalyticsFixtures } from '@/lib/fixtures/teacher-analytics'

export async function GET(
  _req: Request,
  context: { params: Promise<{ planId: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const { planId } = await context.params
  const analytics = planAnalyticsFixtures[planId]
  if (!analytics) {
    return NextResponse.json({
      planId,
      enrollmentCount: 0,
      avgProgress: 0,
      avgExamScore: 0,
      hardestTopic: '—',
      strongestTopic: '—',
      scoreDistribution: [],
      engagementTrend: [],
    })
  }

  return NextResponse.json(analytics)
}