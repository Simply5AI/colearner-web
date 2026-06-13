import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { fetchTeacherPlan } from '@/lib/api/teacher-plans'
import { QuestionForm } from '@/components/teacher/questions/question-form'
import { TeacherPage } from '@/components/teacher/teacher-page'

export default async function TeacherQuestionNewPage({
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
    <TeacherPage title="New question" subtitle={plan.title}>
      <QuestionForm planId={planId} />
    </TeacherPage>
  )
}