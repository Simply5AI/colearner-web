import type { Metadata } from 'next'
import { getAuthHeaders } from '@/lib/api/auth-headers'
import {
  getMasteryStats,
  getDailyPassRates,
  getTypeBreakdown,
  getConceptLedger,
  getProgressInsights,
} from '@/lib/api/progress'
import { getRoadmaps } from '@/lib/api/roadmap'
import { TopBar } from '@/components/shared/TopBar'
import { MasteryStatsRow } from '@/components/dashboard/mastery-stats-row'
import { DailyPassRateChart } from '@/components/dashboard/daily-pass-rate-chart'
import { TypeBreakdown } from '@/components/dashboard/type-breakdown'
import { ConceptMasteryLedger } from '@/components/dashboard/concept-mastery-ledger'
import { MasteryRangePills } from '@/components/dashboard/mastery-range-pills'
import { StudyPlanFilter } from '@/components/dashboard/study-plan-filter'
import { EmptyStudyPlanCta } from '@/components/shared/empty-study-plan-cta'
import {
  FocusNextCard,
  MasteryDistributionChart,
  ReviewLoadChart,
  WeeklyActivityChart,
} from '@/components/dashboard/progress-insights'

export const metadata: Metadata = {
  title: 'Progress',
}

interface MasteryPageProps {
  searchParams: Promise<{ range?: string; roadmapId?: string }>
}

export default async function MasteryPage({ searchParams }: MasteryPageProps) {
  const params = await searchParams
  const range = (params.range as '7d' | '30d' | 'all') || '30d'
  const roadmapId = params.roadmapId
  const headers = await getAuthHeaders()

  const roadmapsResp = await getRoadmaps(headers).catch(() => ({ roadmaps: [] }))
  const planOptions = roadmapsResp.roadmaps
    .filter((r) => r.id && r.title)
    .map((r) => ({ id: r.id, title: r.title }))

  if (planOptions.length === 0) {
    return (
      <>
        <TopBar title="Progress" subtitle="Understand what is improving, what needs review, and where to focus next." />
        <div className="space-y-6 p-7">
          <EmptyStudyPlanCta variant="progress" />
        </div>
      </>
    )
  }

  const [stats, daily, byType, ledger, insights] = await Promise.all([
    getMasteryStats(headers, range, roadmapId),
    getDailyPassRates(headers, range === 'all' ? '30d' : range, roadmapId),
    getTypeBreakdown(headers, roadmapId),
    getConceptLedger(headers, { roadmapId }),
    getProgressInsights(headers, range, roadmapId),
  ])

  return (
    <>
      <TopBar title="Progress" subtitle="Understand what is improving, what needs review, and where to focus next.">
        <div className="flex items-center gap-2">
          <StudyPlanFilter plans={planOptions} />
          <MasteryRangePills />
        </div>
      </TopBar>
      <div className="space-y-6 p-7">
        <MasteryStatsRow stats={stats} dueThisWeek={insights.nextReviewSummary.dueThisWeek} />

        <div className="grid gap-4 lg:grid-cols-2">
          <DailyPassRateChart data={daily} />
          <TypeBreakdown data={byType} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <WeeklyActivityChart insights={insights} />
          <MasteryDistributionChart insights={insights} />
          <ReviewLoadChart insights={insights} />
          <FocusNextCard insights={insights} />
        </div>

        <ConceptMasteryLedger data={ledger.data} total={ledger.total} />
      </div>
    </>
  )
}
