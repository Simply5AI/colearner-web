'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  getLlmConsumptionEvent,
  getLlmConsumptionEvents,
  type ConsumptionEventRow,
  type ConsumptionEventsPage,
  type ConsumptionQueryParams,
  type ConsumptionRange,
} from '@/lib/api/admin'

interface Props {
  initial: ConsumptionEventsPage
}

export function AiConsumptionEventsView({ initial }: Props) {
  const [page, setPage] = useState(initial.page)
  const [data, setData] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [orgId, setOrgId] = useState('')
  const [userId, setUserId] = useState('')
  const [provider, setProvider] = useState('')
  const [model, setModel] = useState('')
  const [feature, setFeature] = useState('')
  const [sort, setSort] = useState<'created_desc' | 'created_asc' | 'cost_desc'>('created_desc')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<ConsumptionEventRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const query = useMemo<ConsumptionQueryParams>(
    () => ({
      range: (from ? 'custom' : '30d') as ConsumptionRange,
      from: from || undefined,
      to: to || undefined,
      orgId: orgId || undefined,
      userId: userId || undefined,
      provider: provider || undefined,
      model: model || undefined,
      agent: feature || undefined,
      page,
      sort,
      pageSize: 50,
    }),
    [from, to, orgId, userId, provider, model, feature, page, sort],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await getLlmConsumptionEvents({}, query)
      setData(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    if (page === initial.page && !from && !orgId && !userId && !provider && !model && !feature) return
    load()
  }, [load, page, from, to, orgId, userId, provider, model, feature, sort])

  async function openEvent(id: string) {
    setSelectedId(id)
    setDetailLoading(true)
    setSelectedEvent(null)
    try {
      const event = await getLlmConsumptionEvent({}, id)
      setSelectedEvent(event)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event')
      setSelectedId(null)
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="px-4 py-5 md:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Link
            href="/admin/ai-usage"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">AI usage events</h1>
          <p className="mt-1 text-sm text-muted-foreground">Raw LLM ledger entries with filters and pagination.</p>
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3 animate-spin" /> Loading…
            </span>
          )}
          <Button variant="outline" onClick={load}>
            Refresh
          </Button>
        </div>
      </div>

      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-4">
          <FilterInput label="From" type="date" value={from} onChange={setFrom} />
          <FilterInput label="To" type="date" value={to} onChange={setTo} />
          <FilterInput label="Org ID" value={orgId} onChange={setOrgId} />
          <FilterInput label="User ID" value={userId} onChange={setUserId} />
          <FilterInput label="Provider" value={provider} onChange={setProvider} />
          <FilterInput label="Model" value={model} onChange={setModel} />
          <FilterInput label="Feature (agent)" value={feature} onChange={setFeature} />
          <label className="text-xs">
            <span className="mb-1 block text-muted-foreground">Sort</span>
            <select
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
            >
              <option value="created_desc">Newest first</option>
              <option value="created_asc">Oldest first</option>
              <option value="cost_desc">Highest cost</option>
            </select>
          </label>
        </CardContent>
      </Card>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card>
        <CardHeader className="border-b border-border/70 pb-4">
          <CardTitle>Events</CardTitle>
          <CardDescription>
            {formatNumber(data.total)} total · page {data.page} · {data.pageSize} per page
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Org</th>
                    <th className="px-4 py-3">Feature</th>
                    <th className="px-4 py-3">Model</th>
                    <th className="px-4 py-3 text-right">Cost</th>
                    <th className="px-4 py-3 text-right">Latency</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer border-b border-border/50 last:border-0 hover:bg-muted/40"
                      onClick={() => openEvent(row.id)}
                    >
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(row.createdAt)}</td>
                      <td className="px-4 py-3">{row.userEmail ?? '—'}</td>
                      <td className="px-4 py-3 text-xs">{row.orgName}</td>
                      <td className="px-4 py-3">{row.agent}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{row.model}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.costUsd, 4)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.latencyMs)} ms</td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs font-medium', row.success ? 'text-emerald-600' : 'text-destructive')}>
                          {row.success ? 'ok' : row.errorCode ?? 'error'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-between">
        <Button variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">Page {page}</span>
        <Button variant="outline" disabled={!data.hasMore || loading} onClick={() => setPage((p) => p + 1)}>
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Event detail</DialogTitle>
            <DialogDescription>Full ledger record for this LLM call.</DialogDescription>
          </DialogHeader>
          {detailLoading && <Skeleton className="h-40 w-full" />}
          {selectedEvent && !detailLoading && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Detail label="ID" value={selectedEvent.id} mono />
              <Detail label="Time" value={formatDateTime(selectedEvent.createdAt)} />
              <Detail label="User" value={selectedEvent.userEmail ?? '—'} />
              <Detail label="Org" value={selectedEvent.orgName} />
              <Detail label="Feature" value={selectedEvent.agent} />
              <Detail label="Provider" value={selectedEvent.provider} />
              <Detail label="Model" value={selectedEvent.model} />
              <Detail label="Prompt tokens" value={formatNumber(selectedEvent.promptTokens)} />
              <Detail label="Completion tokens" value={formatNumber(selectedEvent.completionTokens)} />
              <Detail label="Input tokens" value={formatNumber(selectedEvent.inputTokens)} />
              <Detail label="Output tokens" value={formatNumber(selectedEvent.outputTokens)} />
              <Detail label="Cached tokens" value={formatNumber(selectedEvent.cachedTokens)} />
              <Detail label="Cost USD" value={formatCurrency(selectedEvent.costUsd, 4)} />
              <Detail label="Latency" value={`${formatNumber(selectedEvent.latencyMs)} ms`} />
              <Detail label="Success" value={selectedEvent.success ? 'Yes' : 'No'} />
              <Detail label="Error" value={selectedEvent.errorCode ?? '—'} />
              <Detail label="Request ID" value={selectedEvent.requestId ?? '—'} mono />
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FilterInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <label className="text-xs">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border px-2 py-1.5 text-sm"
      />
    </label>
  )
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('font-medium', mono && 'font-mono text-xs')}>{value}</dd>
    </>
  )
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value)
}

function formatCurrency(value: number, maxFraction = 2) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Math.min(2, maxFraction),
    maximumFractionDigits: maxFraction,
  }).format(value)
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}