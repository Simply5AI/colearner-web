'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getHealthLlmProvider, type HealthProviderDetail } from '@/lib/api/admin'
import {
  formatDateTime,
  formatLatency,
  formatPercent,
  HEALTH_THRESHOLDS,
  HealthBackLink,
  HealthMetric,
  StatusPill,
} from '@/components/admin/admin-health/shared'

interface AdminHealthProviderViewProps {
  provider: string
  initial: HealthProviderDetail
}

export function AdminHealthProviderView({ provider, initial }: AdminHealthProviderViewProps) {
  const [detail, setDetail] = useState(initial)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const next = await getHealthLlmProvider({}, provider)
      setDetail(next)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to refresh provider health')
    } finally {
      setLoading(false)
    }
  }, [provider])

  const histogram = detail.latencyHistogram.map((bucket) => ({
    label: bucket.label,
    count: bucket.count,
  }))

  return (
    <div className="px-4 py-5 md:px-6 lg:px-8">
      <div className="mb-4">
        <HealthBackLink href="/admin/health" label="System health" />
      </div>

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold uppercase tracking-tight md:text-3xl">{provider}</h1>
            <StatusPill status={detail.status} tooltip={HEALTH_THRESHOLDS.llm[detail.status]} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Latency histogram and error breakdown (rolling windows)</p>
        </div>
        <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <WindowCard title="Last 15 minutes" stats={detail.windows.last15m} highlight />
        <WindowCard title="Last 1 hour" stats={detail.windows.last1h} />
        <WindowCard title="Last 24 hours" stats={detail.windows.last24h} />
      </section>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <Card className="my-0">
          <CardHeader>
            <CardTitle>Latency histogram (24h)</CardTitle>
            <CardDescription>Distribution of successful call latencies</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogram}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="my-0">
          <CardHeader>
            <CardTitle>Error breakdown (24h)</CardTitle>
            <CardDescription>Counts by error code</CardDescription>
          </CardHeader>
          <CardContent>
            {detail.errorsByCode.length ? (
              <div className="space-y-2">
                {detail.errorsByCode.map((row) => (
                  <div key={row.code} className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
                    <span className="font-mono text-sm">{row.code}</span>
                    <span className="font-semibold tabular-nums">{row.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No errors recorded in the last 24 hours.</p>
            )}
            {detail.lastError ? (
              <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-destructive">Last error</p>
                <p className="mt-1 text-sm font-medium">{detail.lastError.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {detail.lastError.code} · {formatDateTime(detail.lastError.at)}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="my-5">
        <CardHeader className="border-b border-border/70">
          <CardTitle>Recent errors</CardTitle>
          <CardDescription>Cross-link to AI usage events when a request ID is available</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/70">
            {detail.recentErrors.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No recent errors.</p>
            ) : (
              detail.recentErrors.map((error, index) => (
                <div key={`${error.at}-${index}`} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium">{error.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {error.code} · {formatDateTime(error.at)}
                      {error.requestId ? ` · request ${error.requestId}` : ''}
                    </p>
                  </div>
                  <Link
                    href="/admin/ai-usage/events"
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1')}
                  >
                    <ExternalLink className="h-4 w-4" />
                    AI usage events
                  </Link>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function WindowCard({
  title,
  stats,
  highlight = false,
}: {
  title: string
  stats: HealthProviderDetail['windows']['last15m']
  highlight?: boolean
}) {
  return (
    <Card className={cn('my-0', highlight && 'border-primary/30')}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <HealthMetric label="Calls" value={stats.calls} />
        <HealthMetric label="Errors" value={stats.errors} />
        <HealthMetric label="Error rate" value={formatPercent(stats.errorRate)} />
        <HealthMetric label="p50 / p95" value={`${formatLatency(stats.p50LatencyMs)} / ${formatLatency(stats.p95LatencyMs)}`} />
      </CardContent>
    </Card>
  )
}