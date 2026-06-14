import Link from 'next/link'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { fetchTeacherPlan } from '@/lib/api/teacher-plans'
import { PlanAnalyticsView } from '@/components/teacher/analytics/plan-analytics-view'
import { TeacherPage } from '@/components/teacher/teacher-page'
import { Button } from '@/components/ui/button'
import { fetchPlanAggregate, fetchPlanRoster } from '@/lib/api/teacher-analytics'

export default async function TeacherPlanAnalyticsPage({
  params,
}: {
  params: Promise<{ planId: string }>
}) {
  const { planId } = await params
  const session = await auth()
  if (!session?.accessToken) return null

  const headers: Record<string, string> = { Authorization: `Bearer ${session.accessToken}` }
  const plan = await fetchTeacherPlan(headers, planId)
  if (!plan) notFound()

  const [aggregate, roster] = await Promise.all([
    fetchPlanAggregate(headers, planId),
    fetchPlanRoster(headers, planId),
  ])

  return (
    <TeacherPage
      title="Plan analytics"
      subtitle={plan.title}
      actions={
        <Button asChild variant="outline">
          <Link href={`/teacher/plans/${planId}`}>Back to editor</Link>
        </Button>
      }
    >
      <PlanAnalyticsView
        planId={planId}
        aggregate={aggregate}
        roster={roster}
      />
    </TeacherPage>
  )
}