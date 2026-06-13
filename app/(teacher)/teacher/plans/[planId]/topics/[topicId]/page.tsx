import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { fetchTeacherPlan } from '@/lib/api/teacher-plans'
import { TopicDeepView } from '@/components/teacher/plans/topic-deep-view'
import { TeacherPage } from '@/components/teacher/teacher-page'
import { findTreeNode } from '@/lib/teacher/plan-tree-utils'

export default async function TeacherTopicDeepViewPage({
  params,
}: {
  params: Promise<{ planId: string; topicId: string }>
}) {
  const { planId, topicId } = await params
  const session = await auth()
  const headers: Record<string, string> = {}
  if (session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`
  }
  const plan = await fetchTeacherPlan(headers, planId)

  if (!plan || !findTreeNode(plan.tree, topicId)) {
    notFound()
  }

  return (
    <TeacherPage title="Topic view" subtitle={plan.title}>
      <TopicDeepView plan={plan} topicId={topicId} />
    </TeacherPage>
  )
}