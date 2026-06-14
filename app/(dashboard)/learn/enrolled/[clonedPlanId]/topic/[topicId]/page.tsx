import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { EnrolledTopicView } from '@/components/student/enrolled-topic-view'
import { getAuthHeaders } from '@/lib/api/auth-headers'
import { fetchStudentEnrolledPlan } from '@/lib/api/student-plans'
import { findTreeNode } from '@/lib/teacher/plan-tree-utils'

export const metadata: Metadata = {
  title: 'Topic | CoLearner',
}

export default async function EnrolledTopicPage({
  params,
}: {
  params: Promise<{ clonedPlanId: string; topicId: string }>
}) {
  const { clonedPlanId, topicId } = await params
  const headers = await getAuthHeaders()
  const plan = await fetchStudentEnrolledPlan(headers, clonedPlanId)

  if (!plan || !findTreeNode(plan.tree, topicId)) {
    notFound()
  }

  return (
    <div className="p-7">
      <EnrolledTopicView plan={plan} topicId={topicId} />
    </div>
  )
}