'use client'

import { CheckCircle2, BarChart3, Clock, Flame } from 'lucide-react'

interface SummaryStatsGridProps {
  passedCount: number
  totalQuestions: number
  avgScore: number
  totalTimeSeconds: number
  streak: number
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

export function SummaryStatsGrid({
  passedCount,
  totalQuestions,
  avgScore,
  totalTimeSeconds,
  streak,
}: SummaryStatsGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard
        icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
        label="Passed"
        value={`${passedCount}/${totalQuestions}`}
      />
      <StatCard
        icon={<BarChart3 className="h-5 w-5 text-brand-blue" />}
        label="Avg Score"
        value={`${avgScore.toFixed(1)}/10`}
      />
      <StatCard
        icon={<Clock className="h-5 w-5 text-brand-orange" />}
        label="Total Time"
        value={formatTime(totalTimeSeconds)}
      />
      <StatCard
        icon={<Flame className="h-5 w-5 text-red-500" />}
        label="Streak"
        value={`${streak} day${streak !== 1 ? 's' : ''}`}
      />
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border bg-card p-4 text-center">
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
