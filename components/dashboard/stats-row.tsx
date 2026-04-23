import type { ComponentType } from 'react'
import { Brain, CheckCircle2, Flame, HelpCircle } from 'lucide-react'
import type { DashboardStats } from '@/lib/types'
import { cn } from '@/lib/utils'

interface StatsRowProps {
  stats: DashboardStats
}

interface StatCardConfig {
  label: string
  value: string | number
  icon: ComponentType<{ className?: string }>
  iconBg: string
  iconColor: string
  helper: string
  change?: string
  changeDir?: 'up' | 'down'
}

export function StatsRow({ stats }: StatsRowProps) {
  const cards: StatCardConfig[] = [
    {
      label: 'Questions Answered',
      value: stats.totalRecalls,
      icon: HelpCircle,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      helper: 'Recall reps completed',
    },
    {
      label: 'Success Rate',
      value: `${stats.passRate}%`,
      icon: CheckCircle2,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
      helper: stats.passRate >= 70 ? 'Strong retention' : 'Room to reinforce',
    },
    {
      label: 'Active Topics',
      value: stats.activeConcepts,
      icon: Brain,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      helper: 'Concepts in rotation',
    },
    {
      label: 'Day Streak',
      value: stats.streak,
      icon: Flame,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      helper: 'Keep the chain alive',
      change: `best: ${stats.bestStreak}`,
      changeDir: 'up',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="mb-3 flex items-center justify-between">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg',
                card.iconBg
              )}
            >
              <card.icon className={cn('h-4 w-4', card.iconColor)} />
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
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {card.label}
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">{card.helper}</div>
        </div>
      ))}
    </div>
  )
}
