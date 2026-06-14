import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { EnrolledPlanDetail } from '@/components/student/enrolled-plan-detail'
import { getAuthHeaders } from '@/lib/api/auth-headers'
import { fetchStudentEnrolledPlan } from '@/lib/api/student-plans'

export const metadata: Metadata = {
  title: 'Enrolled Plan | CoLearner',
}

export default async function EnrolledPlanDetailPage({
  params,
}: {
  params: Promise<{ clonedPlanId: string }>
}) {
  const { clonedPlanId } = await params
  const headers = await getAuthHeaders()
  const plan = await fetchStudentEnrolledPlan(headers, clonedPlanId)

  if (!plan) {
    notFound()
  }

  return (
    <div className="p-7">
      <EnrolledPlanDetail plan={plan} />
    </div>
  )
}