import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getAuthHeaders } from '@/lib/api/auth-headers'
import { ApiError } from '@/lib/api/client'
import { getSessionSummary } from '@/lib/api/recall'
import { CelebrationHero } from '@/components/recall/celebration-hero'
import { SummaryStatsGrid } from '@/components/recall/summary-stats-grid'
import { QuestionBreakdownTable } from '@/components/recall/question-breakdown-table'

export const metadata: Metadata = {
  title: 'Session results | CoLearner',
}

export default async function EnrolledRecallSummaryPage({
  params,
}: {
  params: Promise<{ clonedPlanId: string; sessionId: string }>
}) {
  const { clonedPlanId, sessionId } = await params

  let headers: Record<string, string>
  try {
    headers = await getAuthHeaders()
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect('/api/auth/force-signout')
    }
    throw err
  }

  const summary = await getSessionSummary(headers, sessionId)

  return (
    <div className="space-y-6 p-7">
      <Link
        href={`/learn/enrolled/${clonedPlanId}`}
        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), '-ml-2')}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to plan
      </Link>

      <CelebrationHero passRate={summary.passRate} avgScore={summary.avgScore} />

      <SummaryStatsGrid
        passedCount={summary.passedCount}
        totalQuestions={summary.totalQuestions}
        avgScore={summary.avgScore}
        totalTimeSeconds={summary.totalTimeSeconds}
        streak={summary.streakCurrent}
      />

      <QuestionBreakdownTable results={summary.results} />
    </div>
  )
}