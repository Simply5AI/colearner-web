import Link from 'next/link'
import { Pencil, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CaptureStats } from '@/lib/types'

interface CaptureStatsBarProps {
  stats: CaptureStats
}

export function CaptureStatsBar({ stats }: CaptureStatsBarProps) {
  const pct = Math.round((stats.todayCaptures / stats.dailyLimit) * 100)
  const barColor = pct >= 80 ? 'bg-destructive' : pct >= 60 ? 'bg-warning' : 'bg-green-600'

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card px-4 py-3 shadow-sm sm:flex-row sm:items-center">
      {/* Today */}
      <div className="flex items-center gap-1.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
          <Pencil className="h-3.5 w-3.5 text-primary" />
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground">Today</div>
          <div className="text-sm font-extrabold text-foreground">
            {stats.todayCaptures} captures
          </div>
        </div>
      </div>

      <div className="hidden h-7 w-px bg-border/50 sm:block" />

      {/* Total concepts */}
      <div className="flex items-center gap-1.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-50">
          <CheckCircle className="h-3.5 w-3.5 text-green-600" />
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground">
            Total Concepts
          </div>
          <div className="text-sm font-extrabold text-foreground">
            {stats.totalConcepts}
          </div>
        </div>
      </div>

      <div className="hidden h-7 w-px bg-border/50 sm:block" />

      {/* Daily limit bar */}
      <div className="w-full flex-1">
        <div className="mb-0.5 flex justify-between">
          <span className="text-[10px] font-semibold text-muted-foreground">
            Daily Limit ({stats.plan === 'free' ? 'Free' : 'Pro'})
          </span>
          <span className="text-[10px] font-bold text-foreground">
            {stats.todayCaptures} / {stats.dailyLimit} used
          </span>
        </div>
        <div className="h-[5px] overflow-hidden rounded-full bg-accent">
          <div
            className={cn('h-full rounded-full transition-all', barColor)}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      </div>

      {stats.plan === 'free' && (
        <Link
          href="/settings"
          className="shrink-0 text-[10px] font-bold text-primary hover:underline"
        >
          Upgrade for unlimited →
        </Link>
      )}
    </div>
  )
}
