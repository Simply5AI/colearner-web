import type { Metadata } from 'next'
import { getAuthHeaders } from '@/lib/api/auth-headers'
import {
  getMasteryStats,
  getDailyPassRates,
  getTypeBreakdown,
  getConceptLedger,
} from '@/lib/api/mastery'
import { getRoadmaps } from '@/lib/api/roadmap'
import { TopBar } from '@/components/shared/TopBar'
import { MasteryStatsRow } from '@/components/dashboard/mastery-stats-row'
import { DailyPassRateChart } from '@/components/dashboard/daily-pass-rate-chart'
import { TypeBreakdown } from '@/components/dashboard/type-breakdown'
import { ConceptMasteryLedger } from '@/components/dashboard/concept-mastery-ledger'
import { MasteryRangePills } from '@/components/dashboard/mastery-range-pills'
import { StudyPlanFilter } from '@/components/dashboard/study-plan-filter'
import { EmptyStudyPlanCta } from '@/components/shared/empty-study-plan-cta'

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
        <TopBar title="Progress" subtitle="Track your learning progress" />
        <div className="space-y-6 p-7">
          <EmptyStudyPlanCta variant="progress" />
        </div>
      </>
    )
  }

  const [stats, daily, byType, ledger] = await Promise.all([
    getMasteryStats(headers, range, roadmapId),
    getDailyPassRates(headers, range === 'all' ? '30d' : range, roadmapId),
    getTypeBreakdown(headers, roadmapId),
    getConceptLedger(headers, { roadmapId }),
  ])

  return (
    <>
      <TopBar title="Progress" subtitle="Track your learning progress">
        <div className="flex items-center gap-2">
          <StudyPlanFilter plans={planOptions} />
          <MasteryRangePills />
        </div>
      </TopBar>
      <div className="space-y-6 p-7">
        <MasteryStatsRow stats={stats} />

        <div className="grid gap-4 lg:grid-cols-2">
          <DailyPassRateChart data={daily} />
          <TypeBreakdown data={byType} />
        </div>

        <ConceptMasteryLedger data={ledger.data} total={ledger.total} />
      </div>
    </>
  )
}
