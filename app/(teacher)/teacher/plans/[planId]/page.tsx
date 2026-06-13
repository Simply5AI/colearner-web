import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { fetchTeacherPlan } from '@/lib/api/teacher-plans'
import { PlanEditor } from '@/components/teacher/plans/plan-editor'
import { TeacherPage } from '@/components/teacher/teacher-page'

export default async function TeacherPlanEditorPage({
  params,
}: {
  params: Promise<{ planId: string }>
}) {
  const { planId } = await params
  const session = await auth()
  const headers: Record<string, string> = {}
  if (session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`
  }
  const plan = await fetchTeacherPlan(headers, planId)

  if (!plan) {
    notFound()
  }

  return (
    <TeacherPage title="Plan editor" subtitle="Organize modules, topics, and assessments.">
      <PlanEditor initialPlan={plan} />
    </TeacherPage>
  )
}