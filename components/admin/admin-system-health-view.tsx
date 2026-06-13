'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  Cpu,
  Database,
  Layers,
  RefreshCw,
  Server,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  getHealthOverview,
  type HealthOverview,
} from '@/lib/api/admin'
import {
  formatDateTime,
  formatLatency,
  formatPercent,
  HEALTH_THRESHOLDS,
  HealthMetric,
  StatusPill,
  workerToHealthStatus,
} from '@/components/admin/admin-health/shared'

const REFRESH_MS = 15_000

interface AdminSystemHealthViewProps {
  initial: HealthOverview
}

export function AdminSystemHealthView({ initial }: AdminSystemHealthViewProps) {
  const [overview, setOverview] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => new Date().toISOString())
  const abortRef = useRef<AbortController | null>(null)

  const refresh = useCallback(async (silent = false) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    if (!silent) setLoading(true)
    try {
      const next = await getHealthOverview({}, controller.signal)
      setOverview(next)
      setLastRefreshedAt(new Date().toISOString())
    } catch (error) {
      if ((error as Error).name === 'AbortError') return
      if (!silent) {
        toast.error(error instanceof Error ? error.message : 'Failed to refresh health overview')
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!autoRefresh) return

    const tick = () => {
      if (document.visibilityState !== 'visible') return
      void refresh(true)
    }

    const interval = window.setInterval(tick, REFRESH_MS)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh(true)
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      abortRef.current?.abort()
    }
  }, [autoRefresh, refresh])

  return (
    <div className="px-4 py-5 md:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">System health</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Last refreshed {formatDateTime(lastRefreshedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
            <Checkbox
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={(checked) => setAutoRefresh(checked === true)}
            />
            <Label htmlFor="auto-refresh" className="text-sm font-medium">
              Auto-refresh (15s)
            </Label>
          </div>
          <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ComponentCard
          title="Database"
          description="PostgreSQL ping latency"
          icon={Database}
          status={overview.db.status}
          tooltip={HEALTH_THRESHOLDS.latency[overview.db.status]}
          loading={loading}
        >
          <HealthMetric label="Latency" value={formatLatency(overview.db.latencyMs)} />
          {overview.db.message ? (
            <p className="mt-2 text-xs text-destructive">{overview.db.message}</p>
          ) : null}
        </ComponentCard>

        <ComponentCard
          title="Redis"
          description="Cache and queue broker"
          icon={Server}
          status={overview.redis.status}
          tooltip={HEALTH_THRESHOLDS.latency[overview.redis.status]}
          loading={loading}
        >
          <HealthMetric label="Latency" value={formatLatency(overview.redis.latencyMs)} />
          {overview.redis.message ? (
            <p className="mt-2 text-xs text-destructive">{overview.redis.message}</p>
          ) : null}
        </ComponentCard>

        <ComponentCard
          title="Workers"
          description="Daemon processor heartbeats"
          icon={Cpu}
          status={aggregateWorkerStatus(overview.workers)}
          tooltip="Per-queue worker heartbeat age"
          loading={loading}
        >
          <div className="space-y-2">
            {overview.workers.slice(0, 6).map((worker) => (
              <div key={worker.name} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-medium">{worker.name}</span>
                <StatusPill
                  status={workerToHealthStatus(worker.status)}
                  label={worker.status}
                  tooltip={HEALTH_THRESHOLDS.worker[workerToHealthStatus(worker.status)]}
                />
              </div>
            ))}
            {overview.workers.length > 6 ? (
              <p className="text-xs text-muted-foreground">+{overview.workers.length - 6} more workers</p>
            ) : null}
          </div>
        </ComponentCard>
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-2">
        <Card className="my-0">
          <CardHeader className="border-b border-border/70">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" />
                  Queues
                </CardTitle>
                <CardDescription>BullMQ backlog and failure counts</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/70">
              {overview.queues.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">Queue metrics unavailable.</p>
              ) : (
                overview.queues.map((queue) => (
                  <Link
                    key={queue.name}
                    href={`/admin/health/queues/${encodeURIComponent(queue.name)}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{queue.name}</p>
                      <p className="text-xs text-muted-foreground">
                        waiting {queue.waiting} · active {queue.active} · delayed {queue.delayed}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={cn(
                          'text-sm font-bold tabular-nums',
                          queue.failed > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
                        )}
                      >
                        {queue.failed} failed
                      </span>
                      <StatusPill
                        status={queue.status}
                        tooltip={HEALTH_THRESHOLDS.queue[queue.status]}
                      />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="my-0">
          <CardHeader className="border-b border-border/70">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              LLM providers
            </CardTitle>
            <CardDescription>Rolling latency and error rate (last 15m)</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/70">
              {overview.llmProviders.map((provider) => (
                <Link
                  key={provider.provider}
                  href={`/admin/health/providers/${encodeURIComponent(provider.provider)}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <div>
                    <p className="font-semibold uppercase">{provider.provider}</p>
                    <p className="text-xs text-muted-foreground">
                      p50 {formatLatency(provider.p50LatencyMs)} · p95 {formatLatency(provider.p95LatencyMs)} · errors{' '}
                      {formatPercent(provider.errorRateLast15m)}
                    </p>
                  </div>
                  <StatusPill
                    status={provider.status}
                    tooltip={HEALTH_THRESHOLDS.llm[provider.status]}
                  />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="my-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Threshold legend
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
          <p>DB/Redis: green {HEALTH_THRESHOLDS.latency.green}, yellow {HEALTH_THRESHOLDS.latency.yellow}, red {HEALTH_THRESHOLDS.latency.red}</p>
          <p>Workers: green {HEALTH_THRESHOLDS.worker.green}, yellow {HEALTH_THRESHOLDS.worker.yellow}, red {HEALTH_THRESHOLDS.worker.red}</p>
          <p>Queues: red when failed jobs exist; yellow on high backlog.</p>
          <p>LLM: red when 15m error rate ≥ 10%; yellow at 3–10% or high p95.</p>
        </CardContent>
      </Card>
    </div>
  )
}

function ComponentCard({
  title,
  description,
  icon: Icon,
  status,
  tooltip,
  loading,
  children,
}: {
  title: string
  description: string
  icon: typeof Database
  status: HealthOverview['db']['status']
  tooltip: string
  loading: boolean
  children: React.ReactNode
}) {
  return (
    <Card className="my-0">
      <CardHeader className="gap-3 border-b border-border/70 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Icon className="h-5 w-5 text-primary" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <StatusPill status={status} tooltip={tooltip} />
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {loading ? <Skeleton className="h-16 w-full" /> : children}
      </CardContent>
    </Card>
  )
}

function aggregateWorkerStatus(workers: HealthOverview['workers']) {
  if (!workers.length) return 'red' as const
  if (workers.some((worker) => worker.status === 'down')) return 'red' as const
  if (workers.some((worker) => worker.status === 'stale')) return 'yellow' as const
  return 'green' as const
}