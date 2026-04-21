'use client'

import { Brain, AlertTriangle, TrendingUp, Layers } from 'lucide-react'
import type { QueueStats } from '@/lib/types'

interface SessionHeroProps {
  stats: QueueStats
}

export function SessionHero({ stats }: SessionHeroProps) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-teal/10">
          <Brain className="h-5 w-5 text-brand-teal" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Ready to Practice?</h1>
          <p className="text-sm text-muted-foreground">
            Choose how many questions and start your session
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<Layers className="h-4 w-4" />}
          label="Available"
          value={stats.totalAvailable}
          color="text-brand-blue"
          bgColor="bg-brand-blue/10"
        />
        <StatCard
          icon={<Brain className="h-4 w-4" />}
          label="Due"
          value={stats.dueCount}
          color="text-brand-orange"
          bgColor="bg-brand-orange/10"
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Failed"
          value={stats.failedCount}
          color="text-destructive"
          bgColor="bg-destructive/10"
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Success Rate"
          value={`${stats.passRate}%`}
          color="text-brand-teal"
          bgColor="bg-brand-teal/10"
        />
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  color,
  bgColor,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  color: string
  bgColor: string
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-2 mb-1">
        <div className={`flex h-6 w-6 items-center justify-center rounded ${bgColor} ${color}`}>
          {icon}
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
