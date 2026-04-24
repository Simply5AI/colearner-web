import { BarChart3, CalendarClock, CheckCircle2, TrendingUp } from 'lucide-react'
import type { MasteryAnalyticsStats } from '@/lib/types'

interface MasteryStatsRowProps {
  stats: MasteryAnalyticsStats
  dueThisWeek?: number
}

export function MasteryStatsRow({ stats, dueThisWeek = 0 }: MasteryStatsRowProps) {
  const cards = [
    {
      label: 'Total Attempts',
      value: stats.totalAttempts,
      icon: BarChart3,
      iconBg: 'bg-primary/10 text-primary',
    },
    {
      label: 'Success Rate',
      value: `${stats.passRate}%`,
      icon: CheckCircle2,
      iconBg: 'bg-green-50 text-green-700',
    },
    {
      label: 'Avg Score',
      value: `${stats.avgScore.toFixed(1)}/10`,
      icon: TrendingUp,
      iconBg: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Due This Week',
      value: dueThisWeek,
      icon: CalendarClock,
      iconBg: 'bg-amber-50 text-amber-700',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            className="rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.iconBg}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div className="font-mono text-[26px] font-extrabold leading-none text-foreground">
              {card.value}
            </div>
            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {card.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}
