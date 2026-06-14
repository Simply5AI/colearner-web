import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { fetchTeacherPlan } from '@/lib/api/teacher-plans'
import { QuestionForm } from '@/components/teacher/questions/question-form'
import { TeacherPage } from '@/components/teacher/teacher-page'
import { fetchTeacherQuestion } from '@/lib/api/teacher-questions'

export default async function TeacherQuestionEditPage({
  params,
}: {
  params: Promise<{ planId: string; questionId: string }>
}) {
  const { planId, questionId } = await params
  const session = await auth()
  if (!session?.accessToken) return null

  const headers: Record<string, string> = { Authorization: `Bearer ${session.accessToken}` }
  const plan = await fetchTeacherPlan(headers, planId)
  const question = await fetchTeacherQuestion(headers, questionId)
  if (!plan || !question || question.planId !== planId) notFound()

  return (
    <TeacherPage title="Edit question" subtitle={plan.title}>
      <QuestionForm planId={planId} planTree={plan.tree} initialQuestion={question} />
    </TeacherPage>
  )
}