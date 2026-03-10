import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuthHeaders } from '@/lib/api/auth-headers'
import { getSessionSummary } from '@/lib/api/recall'
import { ApiError } from '@/lib/api/client'
import { CelebrationHero } from '@/components/recall/celebration-hero'
import { SummaryStatsGrid } from '@/components/recall/summary-stats-grid'
import { QuestionBreakdownTable } from '@/components/recall/question-breakdown-table'
import { NextActionsGrid } from '@/components/recall/next-actions-grid'

export const metadata: Metadata = {
  title: 'Session Summary',
}

export default async function SessionSummaryPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params

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
  const hasFailedQuestions = summary.results.some((r) => !r.isCorrect && !r.skipped)

  return (
    <div className="space-y-6">
      <CelebrationHero passRate={summary.passRate} avgScore={summary.avgScore} />

      <SummaryStatsGrid
        passedCount={summary.passedCount}
        totalQuestions={summary.totalQuestions}
        avgScore={summary.avgScore}
        totalTimeSeconds={summary.totalTimeSeconds}
        streak={summary.streakCurrent}
      />

      <QuestionBreakdownTable results={summary.results} />

      <NextActionsGrid
        sessionId={sessionId}
        hasFailedQuestions={hasFailedQuestions}
      />
    </div>
  )
}
