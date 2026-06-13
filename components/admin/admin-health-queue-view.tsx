'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  getHealthQueue,
  getHealthQueueFailedJobs,
  retryAllHealthQueueFailed,
  retryHealthQueueJob,
  type HealthFailedJobRow,
  type HealthQueueDetail,
} from '@/lib/api/admin'
import { useAdminMutation } from '@/lib/hooks/use-admin-mutation'
import {
  formatDateTime,
  HealthBackLink,
  HealthMetric,
  StatusPill,
  truncatePayload,
} from '@/components/admin/admin-health/shared'

interface AdminHealthQueueViewProps {
  queueName: string
  initialQueue: HealthQueueDetail
  initialFailed: {
    items: HealthFailedJobRow[]
    page: number
    pageSize: number
    total: number
    hasMore: boolean
  }
}

export function AdminHealthQueueView({
  queueName,
  initialQueue,
  initialFailed,
}: AdminHealthQueueViewProps) {
  const { runSensitive } = useAdminMutation()
  const [queue, setQueue] = useState(initialQueue)
  const [failedPage, setFailedPage] = useState(initialFailed)
  const [page, setPage] = useState(initialFailed.page)
  const [loading, setLoading] = useState(false)
  const [selectedJob, setSelectedJob] = useState<HealthFailedJobRow | null>(null)
  const [retryAllOpen, setRetryAllOpen] = useState(false)
  const [retrying, setRetrying] = useState(false)

  const chartData = useMemo(
    () =>
      queue.throughputSeries.map((point) => ({
        label: new Date(point.minute).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        completed: point.completed,
      })),
    [queue.throughputSeries],
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [nextQueue, nextFailed] = await Promise.all([
        getHealthQueue({}, queueName),
        getHealthQueueFailedJobs({}, queueName, page),
      ])
      setQueue(nextQueue)
      setFailedPage(nextFailed)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to refresh queue health')
    } finally {
      setLoading(false)
    }
  }, [queueName, page])

  useEffect(() => {
    void (async () => {
      try {
        const nextFailed = await getHealthQueueFailedJobs({}, queueName, page)
        setFailedPage(nextFailed)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load failed jobs')
      }
    })()
  }, [page, queueName])

  const retryOne = async (jobId: string) => {
    setRetrying(true)
    try {
      await runSensitive(() => retryHealthQueueJob(queueName, jobId))
      toast.success(`Retried job ${jobId}`)
      await refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Retry failed')
    } finally {
      setRetrying(false)
    }
  }

  const retryAll = async () => {
    setRetrying(true)
    try {
      const result = await runSensitive(() => retryAllHealthQueueFailed(queueName))
      toast.success(`Retried ${result.retried} failed jobs`)
      setRetryAllOpen(false)
      await refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Retry all failed')
    } finally {
      setRetrying(false)
    }
  }

  const queueStatus = queue.failed > 0 ? 'red' : queue.waiting > 100 || queue.active > 20 ? 'yellow' : 'green'

  return (
    <div className="px-4 py-5 md:px-6 lg:px-8">
      <div className="mb-4">
        <HealthBackLink href="/admin/health" label="System health" />
      </div>

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{queueName}</h1>
            <StatusPill status={queueStatus} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Queue throughput, backlog, and failed job controls</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            variant="destructive"
            disabled={failedPage.total === 0 || retrying}
            onClick={() => setRetryAllOpen(true)}
          >
            <RotateCcw className="h-4 w-4" />
            Retry all failed ({failedPage.total})
          </Button>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Waiting" value={queue.waiting} />
        <MetricCard label="Active" value={queue.active} />
        <MetricCard label="Delayed" value={queue.delayed} />
        <MetricCard label="Failed" value={queue.failed} emphasize={queue.failed > 0} />
        <MetricCard label="Completed (1h)" value={queue.completedLastHour} />
      </section>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="my-0">
          <CardHeader>
            <CardTitle>Throughput (last hour)</CardTitle>
            <CardDescription>Completed jobs per minute</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="completed" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No completed jobs in the last hour.</p>
            )}
          </CardContent>
        </Card>

        <Card className="my-0">
          <CardHeader>
            <CardTitle>Job duration</CardTitle>
            <CardDescription>Average processing time (completed jobs, 1h)</CardDescription>
          </CardHeader>
          <CardContent>
            <HealthMetric
              label="Average duration"
              value={queue.avgJobDurationMs !== null ? `${queue.avgJobDurationMs}ms` : '—'}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="my-5">
        <CardHeader className="border-b border-border/70">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Failed jobs
          </CardTitle>
          <CardDescription>Payload preview, stacktrace, and per-job retry (requires re-auth)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Attempts</th>
                  <th className="px-4 py-3">Failed at</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {failedPage.items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-muted-foreground">
                      No failed jobs in this queue.
                    </td>
                  </tr>
                ) : (
                  failedPage.items.map((job) => (
                    <tr key={job.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">
                        <button
                          type="button"
                          className="text-left hover:text-primary"
                          onClick={() => setSelectedJob(job)}
                        >
                          {job.name}
                          <span className="mt-0.5 block font-mono text-xs text-muted-foreground">{job.id}</span>
                        </button>
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">{job.failedReason}</td>
                      <td className="px-4 py-3">{job.attemptsMade}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(job.timestamp)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={retrying}
                          onClick={() => void retryOne(job.id)}
                        >
                          Retry
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border/70 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Page {failedPage.page} · {failedPage.total} failed total
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!failedPage.hasMore}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl">
          {selectedJob ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedJob.name}</DialogTitle>
                <DialogDescription className="font-mono text-xs">{selectedJob.id}</DialogDescription>
              </DialogHeader>
              <DialogBody className="max-h-[min(60vh,28rem)] space-y-4 overflow-y-auto">
                <HealthMetric label="Failed reason" value={selectedJob.failedReason} />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Payload</p>
                  <pre className="mt-2 max-h-56 overflow-auto rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs">
                    {truncatePayload(selectedJob.payload)}
                  </pre>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Stacktrace</p>
                  <pre className="mt-2 max-h-56 overflow-auto rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs">
                    {(selectedJob.stacktrace.length ? selectedJob.stacktrace : ['No stacktrace captured']).join('\n')}
                  </pre>
                </div>
              </DialogBody>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedJob(null)}>
                  Close
                </Button>
                <Button disabled={retrying} onClick={() => void retryOne(selectedJob.id)}>
                  Retry job
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={retryAllOpen} onOpenChange={setRetryAllOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retry all failed jobs?</DialogTitle>
            <DialogDescription>
              This will re-queue {failedPage.total} failed jobs in <strong>{queueName}</strong>. You will be asked to
              confirm with your authenticator code.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetryAllOpen(false)} disabled={retrying}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={retrying} onClick={() => void retryAll()}>
              Retry all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MetricCard({
  label,
  value,
  emphasize = false,
}: {
  label: string
  value: number
  emphasize?: boolean
}) {
  return (
    <Card className="my-0">
      <CardContent className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn('mt-1 text-2xl font-bold tabular-nums', emphasize && 'text-destructive')}>{value}</p>
      </CardContent>
    </Card>
  )
}