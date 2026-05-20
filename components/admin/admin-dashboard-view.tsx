'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Clock,
  Database,
  DollarSign,
  RefreshCw,
  Users,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { apiClient } from '@/lib/api/client'
import type {
  AdminActiveUsers,
  AdminDashboardData,
  AdminMetric,
  AdminPanel,
  AdminQueueMetrics,
  AdminRecentUser,
  AdminSeriesPoint,
} from '@/lib/api/admin'

const activeWindows = ['24h', '7d', '30d'] as const

type ActiveWindow = (typeof activeWindows)[number]

interface AdminDashboardViewProps {
  data: AdminDashboardData
}

export function AdminDashboardView({ data }: AdminDashboardViewProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [activeWindow, setActiveWindow] = useState<ActiveWindow>('7d')
  const [activeUsers, setActiveUsers] = useState(data.activeUsers)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isWindowLoading, setIsWindowLoading] = useState(false)

  async function refreshPage() {
    setIsRefreshing(true)
    router.refresh()
    window.setTimeout(() => setIsRefreshing(false), 700)
  }

  async function changeActiveWindow(window: ActiveWindow) {
    setActiveWindow(window)
    if (!session?.accessToken) return

    setIsWindowLoading(true)
    try {
      const result = await apiClient<AdminActiveUsers>(
        `/api/admin/metrics/active-users?window=${window}`,
        { headers: { Authorization: `Bearer ${session.accessToken}` } }
      )
      setActiveUsers({ data: result, error: null })
    } catch (error) {
      setActiveUsers({
        data: null,
        error: error instanceof Error ? error.message : 'Unable to load active users',
      })
    } finally {
      setIsWindowLoading(false)
    }
  }

  const overview = data.overview.data

  return (
    <div className="px-4 py-5 md:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Platform overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Last refreshed {formatDateTime(data.lastRefreshedAt)}
          </p>
        </div>
        <Button variant="outline" onClick={refreshPage}>
          <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {data.overview.error && <PanelError message={data.overview.error} className="mb-4" />}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total users"
          value={overview ? formatNumber(overview.users.total) : '—'}
          delta={overview?.users.deltaPct ?? null}
          href="/admin/users"
          icon={Users}
        />
        <KpiCard
          label="Total orgs"
          value={overview ? formatNumber(overview.orgs.total) : '—'}
          delta={overview?.orgs.deltaPct ?? null}
          href="/admin/orgs"
          icon={Building2}
        />
        <KpiCard
          label="Total extractions"
          value={overview ? formatNumber(overview.extractions.total) : '—'}
          delta={overview?.extractions.deltaPct ?? null}
          href="/admin/content/extractions"
          icon={Database}
        />
        <KpiCard
          label="MRR"
          value={overview ? formatCurrency(overview.mrr.value) : '—'}
          delta={overview?.mrr.deltaPct ?? null}
          href="/admin/billing"
          icon={DollarSign}
        />
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="my-0">
          <CardHeader className="gap-3 border-b border-border/70 pb-4 md:flex md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>Active users</CardTitle>
              <CardDescription>Unique learners with recorded activity</CardDescription>
            </div>
            <Tabs value={activeWindow} onValueChange={(value) => changeActiveWindow(value as ActiveWindow)}>
              <TabsList className="grid grid-cols-3">
                {activeWindows.map((window) => (
                  <TabsTrigger key={window} value={window} className="text-xs">
                    {window}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="pt-4">
            <PanelState panel={activeUsers}>
              {(panelData) => (
                <div>
                  <div className="mb-3 flex items-baseline gap-2">
                    <span className="text-3xl font-bold">{formatNumber(panelData.count)}</span>
                    <span className="text-sm text-muted-foreground">active events in window</span>
                    {isWindowLoading && <span className="text-xs text-muted-foreground">Updating…</span>}
                  </div>
                  <SeriesAreaChart data={panelData.series} />
                </div>
              )}
            </PanelState>
          </CardContent>
        </Card>

        <Card className="my-0">
          <CardHeader className="border-b border-border/70 pb-4">
            <CardTitle>Signups trend</CardTitle>
            <CardDescription>New users per day for the last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <PanelState panel={data.signups}>
              {(panelData) => <SeriesLineChart data={panelData.series} />}
            </PanelState>
          </CardContent>
        </Card>
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[0.8fr_0.8fr_1.4fr]">
        <QueueHealthCard panel={data.queues} />
        <ErrorRateCard />
        <RecentSignupsCard panel={data.recentUsers} />
      </section>
    </div>
  )
}

function KpiCard({
  label,
  value,
  delta,
  href,
  icon: Icon,
}: {
  label: string
  value: string
  delta: AdminMetric['deltaPct']
  href: string
  icon: React.ElementType
}) {
  return (
    <Link href={href} className="group block">
      <Card className="my-0 h-full transition-colors group-hover:bg-card/80">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {delta === null ? '— vs prior 30d' : `${delta > 0 ? '+' : ''}${delta}% vs prior 30d`}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function QueueHealthCard({ panel }: { panel: AdminPanel<AdminQueueMetrics> }) {
  return (
    <Card className="my-0">
      <CardHeader>
        <CardTitle>Queue health</CardTitle>
        <CardDescription>BullMQ job depth and failures</CardDescription>
      </CardHeader>
      <CardContent>
        <PanelState panel={panel}>
          {(queue) =>
            queue.available ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <MiniMetric label="Pending" value={queue.pending} />
                  <MiniMetric label="Active" value={queue.active} />
                  <MiniMetric label="Failed" value={queue.failed} tone={queue.failed > 0 ? 'danger' : 'default'} />
                  <MiniMetric label="Done 24h" value={queue.completedLast24h} />
                </div>
                <QueueBar queue={queue} />
              </div>
            ) : (
              <UnavailableState message={queue.message ?? 'Queue metrics unavailable'} />
            )
          }
        </PanelState>
      </CardContent>
    </Card>
  )
}

function ErrorRateCard() {
  return (
    <Card className="my-0">
      <CardHeader>
        <CardTitle>Error rate</CardTitle>
        <CardDescription>API 5xx monitoring placeholder</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-success/10 text-success">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-3xl font-bold">0%</p>
            <p className="text-xs text-muted-foreground">No monitoring feed wired yet</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function RecentSignupsCard({ panel }: { panel: AdminPanel<AdminRecentUser[]> }) {
  return (
    <Card className="my-0">
      <CardHeader className="border-b border-border/70 pb-4">
        <CardTitle>Recent signups</CardTitle>
        <CardDescription>Last 10 users created across organizations</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <PanelState panel={panel}>
          {(users) =>
            users.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No signups yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3 font-semibold">User</th>
                      <th className="px-4 py-3 font-semibold">Org</th>
                      <th className="px-4 py-3 font-semibold">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-3">
                          <Link href={`/admin/users/${user.id}`} className="font-semibold hover:text-primary">
                            {user.email}
                          </Link>
                          <p className="text-xs text-muted-foreground">{user.name || 'Unnamed user'}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{user.orgName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(user.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </PanelState>
      </CardContent>
    </Card>
  )
}

function PanelState<T>({
  panel,
  children,
}: {
  panel: AdminPanel<T>
  children: (data: T) => React.ReactNode
}) {
  if (panel.error) return <PanelError message={panel.error} />
  if (!panel.data) return <div className="text-sm text-muted-foreground">No data available.</div>
  return <>{children(panel.data)}</>
}

function PanelError({ message, className }: { message: string; className?: string }) {
  return (
    <div className={cn('flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive', className)}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

function UnavailableState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function MiniMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'danger'
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-xl font-bold', tone === 'danger' && 'text-destructive')}>
        {formatNumber(value)}
      </p>
    </div>
  )
}

function QueueBar({ queue }: { queue: AdminQueueMetrics }) {
  const total = Math.max(queue.pending + queue.active + queue.failed, 1)
  const pending = (queue.pending / total) * 100
  const active = (queue.active / total) * 100
  const failed = (queue.failed / total) * 100

  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        <div className="bg-warning" style={{ width: `${pending}%` }} />
        <div className="bg-primary" style={{ width: `${active}%` }} />
        <div className="bg-destructive" style={{ width: `${failed}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge variant="outline">Pending</Badge>
        <Badge variant="outline">Active</Badge>
        <Badge variant="outline">Failed</Badge>
      </div>
    </div>
  )
}

function SeriesAreaChart({ data }: { data: AdminSeriesPoint[] }) {
  if (data.every((point) => point.count === 0)) {
    return <div className="h-56 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No active users in this window.</div>
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -20, right: 12, top: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="activeUsersFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.28} />
              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} fontSize={11} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
          <Tooltip labelFormatter={(label) => formatDate(String(label))} />
          <Area type="monotone" dataKey="count" stroke="var(--primary)" fill="url(#activeUsersFill)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function SeriesLineChart({ data }: { data: AdminSeriesPoint[] }) {
  if (data.every((point) => point.count === 0)) {
    return <div className="h-56 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No signups in this period.</div>
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: -20, right: 12, top: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} fontSize={11} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
          <Tooltip labelFormatter={(label) => formatDate(String(label))} />
          <Line type="monotone" dataKey="count" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value)
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value))
}
