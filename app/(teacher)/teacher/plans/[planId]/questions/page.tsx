import Link from 'next/link'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { fetchTeacherPlan } from '@/lib/api/teacher-plans'
import { QuestionsListView } from '@/components/teacher/questions/questions-list-view'
import { TeacherPage } from '@/components/teacher/teacher-page'
import { Button } from '@/components/ui/button'
import { fetchTeacherQuestions } from '@/lib/api/teacher-questions'

export default async function TeacherPlanQuestionsPage({
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

  const questions = await fetchTeacherQuestions(headers, { planId })

  return (
    <TeacherPage
      title="Question bank"
      subtitle={plan.title}
      actions={
        <Button asChild variant="outline">
          <Link href={`/teacher/plans/${planId}`}>Back to editor</Link>
        </Button>
      }
    >
      <QuestionsListView planId={planId} planTree={plan.tree} initialQuestions={questions} />
    </TeacherPage>
  )
}