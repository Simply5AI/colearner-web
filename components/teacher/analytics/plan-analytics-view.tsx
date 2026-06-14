'use client'

import Link from 'next/link'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { MasteryBadge } from '@/components/shared/MasteryBadge'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { ScoreChip } from '@/components/shared/ScoreChip'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PlanAggregateAnalytics, PlanRosterEntry } from '@/lib/types/teacher'

interface PlanAnalyticsViewProps {
  planId: string
  aggregate: PlanAggregateAnalytics
  roster: PlanRosterEntry[]
}

export function PlanAnalyticsView({ planId, aggregate, roster }: PlanAnalyticsViewProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Enrollments</CardDescription>
            <CardTitle className="text-3xl">{aggregate.enrollmentCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg progress</CardDescription>
            <CardTitle className="text-3xl">{aggregate.avgProgress}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg exam score</CardDescription>
            <CardTitle className="text-3xl">{aggregate.avgExamScore}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Hardest topic</CardDescription>
            <CardTitle className="text-lg">{aggregate.hardestTopic}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Score distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aggregate.scoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Engagement (30d)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={aggregate.engagementTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(value) => String(value).slice(5)} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="sessions" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roster</CardTitle>
          <CardDescription>Click a student to view per-topic progress (W6 deep-dive).</CardDescription>
        </CardHeader>
        <CardContent>
          {roster.length === 0 ? (
            <p className="text-sm text-muted-foreground">No enrollments yet.</p>
          ) : (
            <div className="space-y-3">
              {roster.map((entry) => (
                <Link
                  key={entry.studentUserId}
                  href={`/teacher/students/${entry.studentUserId}?planId=${planId}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 transition-colors hover:border-primary/30 hover:bg-muted/20"
                >
                  <div>
                    <p className="font-medium">{entry.studentName}</p>
                    <p className="text-xs text-muted-foreground">{entry.studentEmail}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <ProgressBar value={entry.progressPercent} label="Progress" className="w-40" />
                    <MasteryBadge level={entry.masteryLevel} />
                    <ScoreChip score={entry.lastExamScore ?? 0} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}