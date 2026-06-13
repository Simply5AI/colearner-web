import Link from 'next/link'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { fetchTeacherPlan } from '@/lib/api/teacher-plans'
import { EnrollmentsView } from '@/components/teacher/enrollments/enrollments-view'
import { TeacherPage } from '@/components/teacher/teacher-page'
import { Button } from '@/components/ui/button'
import { listPlanEnrollments, listPlanInviteCodes } from '@/lib/teacher/enrollments-dev-store'

export default async function TeacherPlanEnrollmentsPage({
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

  return (
    <TeacherPage
      title="Enrollments"
      subtitle={plan.title}
      actions={
        <Button asChild variant="outline">
          <Link href={`/teacher/plans/${planId}`}>Back to editor</Link>
        </Button>
      }
    >
      <EnrollmentsView
        planId={planId}
        initialEnrollments={listPlanEnrollments(planId)}
        initialInviteCodes={listPlanInviteCodes(planId)}
      />
    </TeacherPage>
  )
}