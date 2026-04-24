'use client'

import type React from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CalendarClock, Focus, Layers3, TrendingUp } from 'lucide-react'
import type { ProgressInsights } from '@/lib/types'

interface ProgressInsightsProps {
  insights: ProgressInsights
}

const masteryColors: Record<string, string> = {
  strong: '#16A34A',
  fair: '#D97706',
  weak: '#DC2626',
}

export function WeeklyActivityChart({ insights }: ProgressInsightsProps) {
  return (
    <ChartCard title="Weekly Practice Activity" icon={TrendingUp}>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={insights.weeklyActivity}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="left" tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--color-border)' }} />
          <Line yAxisId="left" type="monotone" dataKey="attempts" name="Attempts" stroke="#0D9488" strokeWidth={2.5} dot={{ r: 3 }} />
          <Line yAxisId="right" type="monotone" dataKey="passRate" name="Success Rate" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function MasteryDistributionChart({ insights }: ProgressInsightsProps) {
  return (
    <ChartCard title="Concept Strength" icon={Layers3}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={insights.masteryDistribution} barSize={34}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--color-border)' }} />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {insights.masteryDistribution.map((entry) => (
              <Cell key={entry.status} fill={masteryColors[entry.status]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function ReviewLoadChart({ insights }: ProgressInsightsProps) {
  return (
    <ChartCard title="Review Load" icon={CalendarClock}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={insights.reviewLoad} barSize={28}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--color-border)' }} />
          <Bar dataKey="count" fill="#7C3AED" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function FocusNextCard({ insights }: ProgressInsightsProps) {
  return (
    <ChartCard title="Focus Next" icon={Focus}>
      <div className="space-y-3">
        {insights.weakestConcepts.length === 0 ? (
          <p className="text-xs text-muted-foreground">No weak concepts yet. Practice a few questions to unlock focus suggestions.</p>
        ) : (
          insights.weakestConcepts.map((concept) => (
            <div key={concept.conceptId} className="rounded-lg border border-border/60 bg-background px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-foreground">{concept.conceptTitle}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {concept.passRate}% success · {concept.attempts} attempts · ease {concept.reviewEase.toFixed(2)}
                  </div>
                </div>
                <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                  {concept.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </ChartCard>
  )
}

function ChartCard({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border/50 px-[18px] py-3.5">
        <div className="flex items-center gap-2 text-[13px] font-bold text-foreground">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </div>
      </div>
      <div className="p-[18px]">{children}</div>
    </div>
  )
}
