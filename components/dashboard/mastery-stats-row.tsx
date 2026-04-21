import type { MasteryAnalyticsStats } from '@/lib/types'

interface MasteryStatsRowProps {
  stats: MasteryAnalyticsStats
}

export function MasteryStatsRow({ stats }: MasteryStatsRowProps) {
  const cards = [
    {
      label: 'Total Attempts',
      value: stats.totalAttempts,
      icon: '📊',
      iconBg: 'bg-primary/10',
    },
    {
      label: 'Success Rate',
      value: `${stats.passRate}%`,
      icon: '✅',
      iconBg: 'bg-green-50',
    },
    {
      label: 'Avg Score',
      value: `${stats.avgScore.toFixed(1)}/10`,
      icon: '📈',
      iconBg: 'bg-blue-50',
    },
    {
      label: 'Avg Difficulty',
      value: stats.avgEF.toFixed(2),
      icon: '🧠',
      iconBg: 'bg-purple-50',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
        >
          <div className="mb-2 flex items-center justify-between">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-base ${card.iconBg}`}
            >
              {card.icon}
            </div>
          </div>
          <div className="font-mono text-[26px] font-extrabold leading-none text-foreground">
            {card.value}
          </div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {card.label}
          </div>
        </div>
      ))}
    </div>
  )
}
