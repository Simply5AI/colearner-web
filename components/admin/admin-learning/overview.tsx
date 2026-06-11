'use client'

import { Activity, Brain, CalendarClock, Flame, Target } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import type { AdminLearningOverviewResponse } from '@/lib/api/admin'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AdminLearningLayout, EmptyState, formatDate, relativeDate } from './shared'

const COLORS = ['#16A34A', '#D97706', '#DC2626']

export function AdminLearningOverview({ data }: { data: AdminLearningOverviewResponse }) {
  const chartData = [
    { name: 'Mastered', value: data.masterySummary.mastered },
    { name: 'Learning', value: data.masterySummary.learning },
    { name: 'Weak', value: data.masterySummary.weak },
  ]

  return (
    <AdminLearningLayout user={data.user} active="overview">
      <div className="grid gap-3 md:grid-cols-4">
        <Kpi title="Concepts mastered" value={data.stats.mastered} icon={Brain} />
        <Kpi title="Attempts" value={data.stats.attempts} icon={Activity} />
        <Kpi title="Streak" value={`${data.streak.current} / ${data.streak.longest}`} icon={Flame} detail="current / longest" />
        <Kpi title="Last active" value={relativeDate(data.stats.lastActiveAt)} icon={CalendarClock} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-xl border bg-card">
          <CardHeader title="Mastery summary" />
          {chartData.every((item) => item.value === 0) ? (
            <EmptyState />
          ) : (
            <div className="grid gap-4 p-4 md:grid-cols-[220px_1fr]">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={chartData} dataKey="value" innerRadius={58} outerRadius={84} paddingAngle={2}>
                    {chartData.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3 self-center">
                {chartData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                      {item.name}
                    </div>
                    <span className="font-mono text-sm font-bold">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-card">
          <CardHeader title="Recent learning activity" />
          {data.recentActivity.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="divide-y">
              {data.recentActivity.map((item) => (
                <div key={item.id} className="px-4 py-3">
                  <div className="text-sm font-medium">
                    {item.action} <span className="text-muted-foreground">{item.subject}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{formatDate(item.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="rounded-xl border bg-card">
          <CardHeader title="Active goals" />
          {data.goals.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="divide-y">
              {data.goals.map((goal) => (
                <div key={goal.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{goal.title}</div>
                    <div className="text-xs text-muted-foreground">Target {goal.targetDate ? formatDate(goal.targetDate) : 'No data yet'}</div>
                  </div>
                  <Badge variant="secondary">{goal.status.toLowerCase()}</Badge>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-card">
          <CardHeader title="Active roadmaps" />
          {data.roadmaps.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="divide-y">
              {data.roadmaps.map((roadmap) => (
                <div key={roadmap.id} className="px-4 py-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="min-w-0 truncate text-sm font-semibold">{roadmap.title}</div>
                    <span className="font-mono text-xs font-bold">{roadmap.progressPercent}%</span>
                  </div>
                  <Progress value={roadmap.progressPercent} className="h-2" />
                  <div className="mt-1 text-xs text-muted-foreground">
                    {roadmap.masteredConcepts}/{roadmap.totalConcepts} concepts mastered
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminLearningLayout>
  )
}

function Kpi({
  title,
  value,
  icon: Icon,
  detail,
}: {
  title: string
  value: number | string
  icon: React.ElementType
  detail?: string
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <div className="mt-3 text-2xl font-bold">{value}</div>
      {detail && <div className="mt-1 text-xs text-muted-foreground">{detail}</div>}
    </div>
  )
}

function CardHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-bold">
      <Target className="h-4 w-4 text-primary" />
      {title}
    </div>
  )
}
