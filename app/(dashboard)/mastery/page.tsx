import type { Metadata } from 'next'
import { getAuthHeaders } from '@/lib/api/auth-headers'
import {
  getMasteryStats,
  getDailyPassRates,
  getTypeBreakdown,
  getConceptLedger,
} from '@/lib/api/mastery'
import { TopBar } from '@/components/shared/TopBar'
import { MasteryStatsRow } from '@/components/dashboard/mastery-stats-row'
import { DailyPassRateChart } from '@/components/dashboard/daily-pass-rate-chart'
import { TypeBreakdown } from '@/components/dashboard/type-breakdown'
import { ConceptMasteryLedger } from '@/components/dashboard/concept-mastery-ledger'
import { MasteryRangePills } from '@/components/dashboard/mastery-range-pills'

export const metadata: Metadata = {
  title: 'Mastery Analytics',
}

interface MasteryPageProps {
  searchParams: Promise<{ range?: string }>
}

export default async function MasteryPage({ searchParams }: MasteryPageProps) {
  const params = await searchParams
  const range = (params.range as '7d' | '30d' | 'all') || '30d'
  const headers = await getAuthHeaders()

  const [stats, daily, byType, ledger] = await Promise.all([
    getMasteryStats(headers, range),
    getDailyPassRates(headers, range === 'all' ? '30d' : range),
    getTypeBreakdown(headers),
    getConceptLedger(headers),
  ])

  return (
    <>
      <TopBar title="Mastery Analytics" subtitle="Track your learning progress">
        <MasteryRangePills />
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
