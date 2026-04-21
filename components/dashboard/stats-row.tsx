import type { DashboardStats } from '@/lib/types'
import { cn } from '@/lib/utils'

interface StatsRowProps {
  stats: DashboardStats
}

interface StatCardConfig {
  label: string
  value: string | number
  icon: string
  iconBg: string
  change?: string
  changeDir?: 'up' | 'down'
}

export function StatsRow({ stats }: StatsRowProps) {
  const cards: StatCardConfig[] = [
    {
      label: 'Questions Answered',
      value: stats.totalRecalls,
      icon: '📥',
      iconBg: 'bg-primary/10',
    },
    {
      label: 'Success Rate',
      value: `${stats.passRate}%`,
      icon: '✅',
      iconBg: 'bg-green-50',
    },
    {
      label: 'Active Topics',
      value: stats.activeConcepts,
      icon: '🧠',
      iconBg: 'bg-blue-50',
    },
    {
      label: 'Day Streak',
      value: stats.streak,
      icon: '🔥',
      iconBg: 'bg-amber-50',
      change: `best: ${stats.bestStreak}`,
      changeDir: 'up',
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
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg text-base',
                card.iconBg
              )}
            >
              {card.icon}
            </div>
            {card.change && (
              <span
                className={cn(
                  'flex items-center gap-0.5 text-[10px] font-bold',
                  card.changeDir === 'up'
                    ? 'text-green-600'
                    : 'text-destructive'
                )}
              >
                {card.change}
              </span>
            )}
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
