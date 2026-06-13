'use client'

import Link from 'next/link'
import {
  Activity,
  ArrowRight,
  BookOpen,
  Brain,
  CalendarClock,
  Clock,
  Flame,
  ListChecks,
  Map,
  Sparkles,
  Target,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import type { AdminLearningOverviewResponse } from '@/lib/api/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  AdminLearningLayout,
  EmptyState,
  formatLearningActivity,
  recordBadge,
  relativeDate,
} from './shared'

const MASTERY_COLORS = {
  mastered: '#16A34A',
  learning: '#D97706',
  weak: '#DC2626',
} as const

export function AdminLearningOverview({ data }: { data: AdminLearningOverviewResponse }) {
  const learningBase = `/admin/users/${data.user.id}/learning`
  const masteryTotal =
    data.masterySummary.mastered + data.masterySummary.learning + data.masterySummary.weak

  const chartData = [
    { key: 'mastered', name: 'Mastered', value: data.masterySummary.mastered, color: MASTERY_COLORS.mastered },
    { key: 'learning', name: 'Learning', value: data.masterySummary.learning, color: MASTERY_COLORS.learning },
    { key: 'weak', name: 'Weak', value: data.masterySummary.weak, color: MASTERY_COLORS.weak },
  ]

  return (
    <AdminLearningLayout user={data.user} active="overview">
      <div className="mb-6 max-w-3xl">
        <h2 className="text-lg font-semibold tracking-tight">Learning overview</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Snapshot of recall progress, goals, and roadmaps for this learner. Open the tabs above to
          inspect mastery levels, session history, and roadmap detail.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Concepts mastered"
          value={data.stats.mastered.toLocaleString()}
          description="Lifetime mastered count"
          icon={Brain}
          href={`${learningBase}/mastery?levels=MASTERED`}
        />
        <StatCard
          title="Recall attempts"
          value={data.stats.attempts.toLocaleString()}
          description="Total questions answered"
          icon={Activity}
          href={`${learningBase}/sessions`}
        />
        <StatCard
          title="Study streak"
          value={`${data.streak.current} day${data.streak.current === 1 ? '' : 's'}`}
          description={`Longest streak: ${data.streak.longest} day${data.streak.longest === 1 ? '' : 's'}`}
          icon={Flame}
        />
        <StatCard
          title="Last active"
          value={relativeDate(data.stats.lastActiveAt)}
          description={
            data.stats.lastActiveAt
              ? format(new Date(data.stats.lastActiveAt), 'PPP')
              : 'No learning activity logged yet'
          }
          icon={CalendarClock}
        />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Mastery breakdown</CardTitle>
            <CardDescription>
              Concepts with review schedules grouped by current mastery level.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            {masteryTotal === 0 ? (
              <EmptyState
                hint="Mastery appears after the learner completes recall sessions on extracted concepts."
              >
                No mastery data yet
              </EmptyState>
            ) : (
              <div className="grid gap-5 md:grid-cols-[220px_1fr]">
                <div className="relative mx-auto h-[220px] w-full max-w-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="value"
                        innerRadius={58}
                        outerRadius={84}
                        paddingAngle={2}
                        stroke="transparent"
                      >
                        {chartData.map((entry) => (
                          <Cell key={entry.key} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold">{masteryTotal}</span>
                    <span className="text-xs text-muted-foreground">tracked concepts</span>
                  </div>
                </div>
                <div className="space-y-3 self-center">
                  {chartData.map((item) => (
                    <div key={item.key} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-medium">{item.name}</span>
                        </div>
                        <span className="font-mono text-sm font-semibold">
                          {item.value}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            ({percent(item.value, masteryTotal)}%)
                          </span>
                        </span>
                      </div>
                      <Progress
                        value={percent(item.value, masteryTotal)}
                        className="h-2"
                        indicatorClassName="transition-all"
                      />
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    render={<Link href={`${learningBase}/mastery`} />}
                  >
                    View all concepts
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest recall, capture, and learning events.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentActivity.length === 0 ? (
              <EmptyState hint="Activity will appear after captures, recall sessions, or tutoring.">
                No recent activity
              </EmptyState>
            ) : (
              <ul className="divide-y divide-border/70">
                {data.recentActivity.map((item) => {
                  const formatted = formatLearningActivity(item)
                  return (
                    <li key={item.id} className="px-4 py-3.5">
                      <div className="text-sm font-medium">{formatted.title}</div>
                      {formatted.detail && (
                        <p className="mt-1 text-sm text-muted-foreground">{formatted.detail}</p>
                      )}
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Active goals</CardTitle>
                <CardDescription>Goals the learner is currently pursuing.</CardDescription>
              </div>
              <Target className="h-5 w-5 shrink-0 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {data.goals.length === 0 ? (
              <EmptyState hint="Goals are created by the learner in the product.">
                No active goals
              </EmptyState>
            ) : (
              <ul className="divide-y divide-border/70">
                {data.goals.map((goal) => (
                  <li key={goal.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className="mt-1 h-3 w-3 shrink-0 rounded-full border border-border/70"
                        style={{ backgroundColor: goal.color ?? '#94a3b8' }}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{goal.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {goal.targetDate
                            ? `Target ${format(new Date(goal.targetDate), 'PPP')}`
                            : 'No target date'}
                        </div>
                      </div>
                    </div>
                    {recordBadge(goal.status)}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Active roadmaps</CardTitle>
                <CardDescription>Study plans currently in progress.</CardDescription>
              </div>
              <Map className="h-5 w-5 shrink-0 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {data.roadmaps.length === 0 ? (
              <EmptyState hint="Roadmaps are generated from goals or manual creation.">
                No active roadmaps
              </EmptyState>
            ) : (
              <ul className="divide-y divide-border/70">
                {data.roadmaps.map((roadmap) => (
                  <li key={roadmap.id} className="px-4 py-3.5">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{roadmap.title}</div>
                        {roadmap.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {roadmap.description}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="font-mono text-xs font-bold">{roadmap.progressPercent}%</span>
                        {roadmap.isGenerationSlow && (
                          <Badge variant="destructive" className="text-[10px]">
                            Slow generation
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Progress value={roadmap.progressPercent} className="h-2" />
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {roadmap.masteredConcepts}/{roadmap.totalConcepts} concepts mastered
                      </span>
                      {recordBadge(roadmap.status)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {data.roadmaps.length > 0 && (
              <div className="border-t px-4 py-3">
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={`${learningBase}/roadmaps`} />}
                >
                  View all roadmaps
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="mt-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Explore learning data
        </h3>
        <div className="grid gap-3 md:grid-cols-3">
          <ExploreCard
            title="Mastery ledger"
            description="Concept levels, review ease, and question history."
            href={`${learningBase}/mastery`}
            icon={ListChecks}
            metric={`${masteryTotal} concepts`}
          />
          <ExploreCard
            title="Recall sessions"
            description="Session scores, duration, and per-question attempts."
            href={`${learningBase}/sessions`}
            icon={Clock}
            metric={`${data.stats.attempts.toLocaleString()} attempts`}
          />
          <ExploreCard
            title="Roadmaps"
            description="Phases, generated content, and roadmap concepts."
            href={`${learningBase}/roadmaps`}
            icon={BookOpen}
            metric={`${data.roadmaps.length} active`}
          />
        </div>
      </section>
    </AdminLearningLayout>
  )
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  href,
}: {
  title: string
  value: string
  description: string
  icon: React.ElementType
  href?: string
}) {
  const content = (
    <Card className="h-full transition-colors hover:border-primary/30">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          {href && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
        </div>
        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )

  if (!href) return content
  return (
    <Link href={href} className="block h-full">
      {content}
    </Link>
  )
}

function ExploreCard({
  title,
  description,
  href,
  icon: Icon,
  metric,
}: {
  title: string
  description: string
  href: string
  icon: React.ElementType
  metric: string
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-border/70 bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-lg bg-muted p-2 text-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <Sparkles className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <h4 className="mt-3 text-sm font-semibold">{title}</h4>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <p className="mt-3 text-xs font-medium text-primary">{metric}</p>
    </Link>
  )
}

function percent(value: number, total: number) {
  if (total <= 0) return 0
  return Math.round((value / total) * 100)
}