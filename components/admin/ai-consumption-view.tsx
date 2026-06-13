'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Coins,
  Download,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { adminBrowserDownload } from '@/lib/api/admin-browser'
import {
  buildLlmConsumptionCsvUrl,
  buildLlmConsumptionJsonUrl,
  getLlmConsumption,
  getLlmConsumptionByFeature,
  getLlmConsumptionByModel,
  getLlmConsumptionByOrgBreakdown,
  getLlmConsumptionByUser,
  getLlmPricingMeta,
  getLlmRateLimits,
  type ConsumptionBreakdownRow,
  type ConsumptionByModelRow,
  type ConsumptionByUserRow,
  type ConsumptionGranularity,
  type ConsumptionGroupBy,
  type ConsumptionQuery,
  type ConsumptionRange,
  type ConsumptionReport,
  type LlmPricingMeta,
  type LlmRateLimitsReport,
} from '@/lib/api/admin'
import { AiConsumptionOrgDrilldown } from '@/components/admin/ai-consumption-org-drilldown'

const RANGES: { label: string; value: ConsumptionRange }[] = [
  { label: '24h', value: '24h' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
  { label: 'All time', value: 'all' },
]

const GROUP_TABS: { label: string; value: ConsumptionGroupBy }[] = [
  { label: 'Feature', value: 'agent' },
  { label: 'Model', value: 'model' },
  { label: 'Provider', value: 'provider' },
  { label: 'Organization', value: 'org' },
]

const STACK_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  '#a855f7',
  '#14b8a6',
  '#f97316',
]

interface AiConsumptionViewProps {
  initial: ConsumptionReport
}

export function AiConsumptionView({ initial }: AiConsumptionViewProps) {
  const [range, setRange] = useState<ConsumptionRange>(initial.range)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [granularity, setGranularity] = useState<ConsumptionGranularity>(initial.granularity ?? 'day')
  const [groupBy, setGroupBy] = useState<ConsumptionGroupBy>(initial.groupBy)
  const [secondaryMetric, setSecondaryMetric] = useState<'tokens' | 'requests' | 'none'>('none')

  const [report, setReport] = useState<ConsumptionReport>(initial)
  const [byUser, setByUser] = useState<ConsumptionByUserRow[]>([])
  const [byOrg, setByOrg] = useState<ConsumptionBreakdownRow[]>([])
  const [byModel, setByModel] = useState<ConsumptionByModelRow[]>([])
  const [byFeature, setByFeature] = useState<ConsumptionBreakdownRow[]>([])
  const [rateLimits, setRateLimits] = useState<LlmRateLimitsReport | null>(null)
  const [pricing, setPricing] = useState<LlmPricingMeta | null>(null)

  const [reportLoading, setReportLoading] = useState(false)
  const [panelLoading, setPanelLoading] = useState({ user: false, org: false, model: false, feature: false, rate: false })
  const [error, setError] = useState<string | null>(null)
  const [drilldownOrgId, setDrilldownOrgId] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  const query = useMemo<ConsumptionQuery>(() => {
    if (from) {
      return { range: 'custom', from, to: to || undefined, granularity }
    }
    return { range, granularity }
  }, [range, from, to, granularity])

  const loadAll = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setReportLoading(true)
    setPanelLoading({ user: true, org: true, model: true, feature: true, rate: true })
    setError(null)

    const headers = {}
    const signal = controller.signal

    try {
      const [nextReport, users, orgs, models, features, rates, pricingMeta] = await Promise.all([
        getLlmConsumption(headers, query, groupBy),
        getLlmConsumptionByUser(headers, query),
        getLlmConsumptionByOrgBreakdown(headers, query),
        getLlmConsumptionByModel(headers, query),
        getLlmConsumptionByFeature(headers, query),
        getLlmRateLimits(headers),
        getLlmPricingMeta(headers),
      ])

      if (signal.aborted) return
      setReport(nextReport)
      setByUser(users)
      setByOrg(orgs)
      setByModel(models)
      setByFeature(features)
      setRateLimits(rates)
      setPricing(pricingMeta)
    } catch (err) {
      if (signal.aborted) return
      setError(err instanceof Error ? err.message : 'Failed to load consumption')
    } finally {
      if (!signal.aborted) {
        setReportLoading(false)
        setPanelLoading({ user: false, org: false, model: false, feature: false, rate: false })
      }
    }
  }, [query, groupBy])

  useEffect(() => {
    if (query.range === initial.range && !from && groupBy === initial.groupBy && granularity === (initial.granularity ?? 'day')) {
      return
    }
    loadAll()
    return () => abortRef.current?.abort()
  }, [loadAll, query, from, groupBy, granularity, initial.range, initial.groupBy, initial.granularity])

  function applyCustomRange() {
    if (!from) {
      toast.error('Select a start date for the custom range')
      return
    }
    setRange('custom')
    loadAll()
  }

  function clearCustomRange() {
    setFrom('')
    setTo('')
    setRange('30d')
  }

  async function downloadCsv() {
    try {
      const url = buildLlmConsumptionCsvUrl(query)
      await adminBrowserDownload(url, `llm-consumption-${from || range}.csv`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed'
      toast.error('CSV export failed', {
        description: message,
        action: { label: 'Retry', onClick: () => void downloadCsv() },
      })
    }
  }

  async function downloadJson() {
    try {
      const data = await fetch(`/api/admin${buildLlmConsumptionJsonUrl(query).replace('/api/admin', '')}`)
      if (!data.ok) throw new Error(`Export failed (${data.status})`)
      const blob = await data.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = `llm-consumption-${from || range}.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed'
      toast.error('JSON export failed', {
        description: message,
        action: { label: 'Retry', onClick: () => void downloadJson() },
      })
    }
  }

  const stackKeys = useMemo(() => {
    const totals = new Map<string, number>()
    for (const point of report.series) {
      for (const [k, v] of Object.entries(point.byKey)) {
        totals.set(k, (totals.get(k) ?? 0) + v)
      }
    }
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k)
  }, [report.series])

  const labelForKey = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of report.breakdown) map.set(row.key, row.label)
    return (key: string) => map.get(key) ?? key
  }, [report.breakdown])

  const isLargeRange = range === '90d' || range === 'all' || (from && to && daysBetween(from, to) > 30)

  return (
    <div className="px-4 py-5 md:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">AI usage &amp; cost</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Token spend and reliability across features, models, orgs, and users.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded border px-1 py-0.5 text-xs"
            />
            <span>to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded border px-1 py-0.5 text-xs"
            />
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={applyCustomRange}>
              Apply
            </Button>
            {from && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearCustomRange}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <Tabs value={from ? 'custom' : range} onValueChange={(v) => { if (v !== 'custom') { clearCustomRange(); setRange(v as ConsumptionRange) } }}>
            <TabsList>
              {RANGES.map((r) => (
                <TabsTrigger key={r.value} value={r.value} className="text-xs">
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Tabs value={granularity} onValueChange={(v) => setGranularity(v as ConsumptionGranularity)}>
            <TabsList>
              {(['hour', 'day', 'week', 'month'] as const).map((g) => (
                <TabsTrigger key={g} value={g} className="text-xs">
                  {g}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button variant="outline" onClick={downloadCsv}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" onClick={downloadJson}>
            <Download className="h-4 w-4" />
            JSON
          </Button>
          <Link
            href="/admin/ai-usage/events"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Events
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          {reportLoading && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3 animate-spin" />
              {isLargeRange ? 'Loading larger range…' : 'Updating…'}
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => abortRef.current?.abort()}>
                Cancel
              </Button>
            </span>
          )}
        </div>
      </div>

      {pricing?.isStale && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          Pricing table last updated {pricing.updatedAt} ({pricing.ageDays} days ago). Costs may be approximate until
          provider rates are synced.
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Total tokens"
          value={reportLoading ? '…' : formatTokens(report.totals.inputTokens + report.totals.outputTokens)}
          icon={Sparkles}
          hint="Sum of input + output tokens in range"
        />
        <KpiCard
          label="Total cost USD"
          value={reportLoading ? '…' : formatCurrency(report.totals.costUsd, 4)}
          icon={Wallet}
          hint={`${formatNumber(report.totals.calls)} requests · sum(cost_usd)`}
        />
        <KpiCard
          label="Request count"
          value={reportLoading ? '…' : formatNumber(report.totals.calls)}
          icon={Activity}
          hint="Total LLM calls in range"
        />
        <KpiCard
          label="Avg latency"
          value={reportLoading ? '…' : `${formatNumber(report.totals.avgLatencyMs)} ms`}
          icon={Activity}
          hint="Mean latencyMs across events"
        />
        <KpiCard
          label="Error rate"
          value={reportLoading ? '…' : `${report.totals.errorRate.toFixed(2)}%`}
          icon={AlertTriangle}
          hint="Failed calls ÷ total calls"
        />
      </section>

      <Card className="my-5">
        <CardHeader className="gap-3 border-b border-border/70 pb-4 md:flex md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Cost over time</CardTitle>
            <CardDescription>
              Stacked by {labelForGroup(groupBy).toLowerCase()} · {granularity} buckets
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={secondaryMetric} onValueChange={(v) => setSecondaryMetric(v as typeof secondaryMetric)}>
              <TabsList>
                <TabsTrigger value="none" className="text-xs">Cost only</TabsTrigger>
                <TabsTrigger value="tokens" className="text-xs">+ Tokens</TabsTrigger>
                <TabsTrigger value="requests" className="text-xs">+ Requests</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as ConsumptionGroupBy)}>
              <TabsList>
                {GROUP_TABS.map((g) => (
                  <TabsTrigger key={g.value} value={g.value} className="text-xs">
                    {g.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {reportLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : report.series.every((p) => p.costUsd === 0) ? (
            <div className="h-64 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              No LLM usage in this range.
            </div>
          ) : (
            <CostChart
              series={report.series}
              stackKeys={stackKeys}
              labelFor={labelForKey}
              secondaryMetric={secondaryMetric}
            />
          )}
        </CardContent>
      </Card>

      <div className="my-5 grid gap-4 md:grid-cols-2">
        <BreakdownPanel title="By user" loading={panelLoading.user} empty={byUser.length === 0}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-1.5 pr-3">User</th>
                <th className="py-1.5 pr-3 text-right">Cost</th>
                <th className="py-1.5 text-right">Requests</th>
              </tr>
            </thead>
            <tbody>
              {byUser.slice(0, 50).map((row) => (
                <tr key={row.userId} className="border-b border-border/50 last:border-0">
                  <td className="py-1.5 pr-3">
                    <Link href={`/admin/users/${row.userId}`} className="font-medium text-primary hover:underline">
                      {row.email}
                    </Link>
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{formatCurrency(row.costUsd, 4)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatNumber(row.requests)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </BreakdownPanel>

        <BreakdownPanel title="By org" loading={panelLoading.org} empty={byOrg.length === 0}>
          <BreakdownTable rows={byOrg.slice(0, 50)} groupBy="org" onOrgClick={setDrilldownOrgId} />
        </BreakdownPanel>

        <BreakdownPanel title="By model / provider" loading={panelLoading.model} empty={byModel.length === 0}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-1.5 pr-3">Provider / Model</th>
                <th className="py-1.5 pr-3 text-right">Cost</th>
                <th className="py-1.5 text-right">Latency</th>
              </tr>
            </thead>
            <tbody>
              {byModel.slice(0, 50).map((row) => (
                <tr key={`${row.provider}:${row.model}`} className="border-b border-border/50 last:border-0">
                  <td className="py-1.5 pr-3 font-medium">
                    {row.provider} / {row.model}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{formatCurrency(row.costUsd, 4)}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                    {formatNumber(row.avgLatencyMs)} ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </BreakdownPanel>

        <BreakdownPanel title="By feature" loading={panelLoading.feature} empty={byFeature.length === 0}>
          <BreakdownTable rows={byFeature.slice(0, 50)} groupBy="agent" onOrgClick={() => {}} />
        </BreakdownPanel>
      </div>

      <Card className="my-5">
        <CardHeader className="border-b border-border/70 pb-4">
          <CardTitle>Reliability &amp; limits</CardTitle>
          <CardDescription>Queue depth, provider error rates, and recent retries (last 24h)</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {panelLoading.rate ? (
            <Skeleton className="h-40 w-full" />
          ) : rateLimits ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-4">
                <div>
                  <div className="text-muted-foreground">Queue pending</div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {rateLimits.queue.available ? formatNumber(rateLimits.queue.pending) : '—'}
                  </div>
                  {!rateLimits.queue.available && (
                    <div className="text-xs text-muted-foreground">{rateLimits.queue.message}</div>
                  )}
                </div>
                <div>
                  <div className="text-muted-foreground">Queue active</div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {rateLimits.queue.available ? formatNumber(rateLimits.queue.active) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Recent calls (24h)</div>
                  <div className="text-2xl font-semibold tabular-nums">{formatNumber(rateLimits.summary.recentCalls)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Cost (24h)</div>
                  <div className="text-2xl font-semibold tabular-nums">{formatCurrency(rateLimits.summary.totalCostUsd, 4)}</div>
                </div>
              </div>

              {rateLimits.providerErrorRates.length > 0 && (
                <div>
                  <div className="mb-2 text-sm font-medium">Provider error rate</div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-1.5 pr-4">Provider</th>
                        <th className="py-1.5 pr-4 text-right">15m</th>
                        <th className="py-1.5 pr-4 text-right">1h</th>
                        <th className="py-1.5 text-right">24h</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rateLimits.providerErrorRates.map((row) => (
                        <tr key={row.provider} className="border-b border-border/50 last:border-0">
                          <td className="py-1.5 pr-4 font-medium">{row.provider}</td>
                          <td className="py-1.5 pr-4 text-right tabular-nums">{row.last15m.toFixed(1)}%</td>
                          <td className="py-1.5 pr-4 text-right tabular-nums">{row.last1h.toFixed(1)}%</td>
                          <td className="py-1.5 text-right tabular-nums">{row.last24h.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {rateLimits.recentRetries.length > 0 && (
                <div>
                  <div className="mb-2 text-sm font-medium">Recent retries</div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-1.5 pr-3">Request</th>
                        <th className="py-1.5 pr-3">Provider</th>
                        <th className="py-1.5 pr-3">Model</th>
                        <th className="py-1.5 pr-3 text-right">Attempts</th>
                        <th className="py-1.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rateLimits.recentRetries.map((row, index) => (
                        <tr key={`${row.requestId ?? 'none'}-${index}`} className="border-b border-border/50 last:border-0">
                          <td className="py-1.5 pr-3 font-mono text-xs">{row.requestId ?? '—'}</td>
                          <td className="py-1.5 pr-3">{row.provider}</td>
                          <td className="py-1.5 pr-3 text-xs text-muted-foreground">{row.model}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{row.attempts}</td>
                          <td className="py-1.5 text-right">
                            <span className={cn('text-xs font-medium', row.finalStatus === 'error' ? 'text-destructive' : 'text-emerald-600')}>
                              {row.finalStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {rateLimits.note && <p className="text-[11px] italic text-muted-foreground">{rateLimits.note}</p>}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No reliability data available.</div>
          )}
        </CardContent>
      </Card>

      {drilldownOrgId && (
        <AiConsumptionOrgDrilldown orgId={drilldownOrgId} query={query} onClose={() => setDrilldownOrgId(null)} />
      )}
    </div>
  )
}

function BreakdownPanel({
  title,
  loading,
  empty,
  children,
}: {
  title: string
  loading: boolean
  empty: boolean
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : empty ? (
          <p className="text-sm text-muted-foreground">No data for this range.</p>
        ) : (
          <div className="overflow-x-auto">{children}</div>
        )}
      </CardContent>
    </Card>
  )
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: string
  hint?: string
  icon: React.ElementType
}) {
  return (
    <Card className="my-0">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function CostChart({
  series,
  stackKeys,
  labelFor,
  secondaryMetric,
}: {
  series: ConsumptionReport['series']
  stackKeys: string[]
  labelFor: (key: string) => string
  secondaryMetric: 'tokens' | 'requests' | 'none'
}) {
  const visible = stackKeys.slice(0, 8)
  const data = series.map((p) => ({
    date: p.date,
    tokens: p.inputTokens + p.outputTokens,
    requests: p.calls,
    ...p.byKey,
  }))

  if (secondaryMetric === 'none') {
    return (
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: -10, right: 12, top: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} fontSize={11} />
            <YAxis tickFormatter={(v) => `$${Number(v).toFixed(2)}`} tickLine={false} axisLine={false} fontSize={11} />
            <Tooltip
              formatter={(value, key) => [formatCurrency(Number(value ?? 0), 4), labelFor(String(key))]}
              labelFormatter={(label) => formatDate(String(label))}
            />
            <Legend formatter={(value: string) => labelFor(value)} wrapperStyle={{ fontSize: 11 }} />
            {visible.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stackId="cost"
                stroke={STACK_COLORS[i % STACK_COLORS.length]}
                fill={STACK_COLORS[i % STACK_COLORS.length]}
                fillOpacity={0.5}
                strokeWidth={1.5}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  }

  const secondaryKey = secondaryMetric
  const secondaryLabel = secondaryMetric === 'tokens' ? 'Tokens' : 'Requests'

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ left: -10, right: 12, top: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} fontSize={11} />
          <YAxis yAxisId="cost" tickFormatter={(v) => `$${Number(v).toFixed(2)}`} tickLine={false} axisLine={false} fontSize={11} />
          <YAxis yAxisId="secondary" orientation="right" tickLine={false} axisLine={false} fontSize={11} />
          <Tooltip labelFormatter={(label) => formatDate(String(label))} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {visible.map((key, i) => (
            <Area
              key={key}
              yAxisId="cost"
              type="monotone"
              dataKey={key}
              stackId="cost"
              stroke={STACK_COLORS[i % STACK_COLORS.length]}
              fill={STACK_COLORS[i % STACK_COLORS.length]}
              fillOpacity={0.5}
              strokeWidth={1.5}
              name={labelFor(key)}
            />
          ))}
          <Line
            yAxisId="secondary"
            type="monotone"
            dataKey={secondaryKey}
            stroke="var(--chart-5)"
            strokeWidth={2}
            dot={false}
            name={secondaryLabel}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function BreakdownTable({
  rows,
  groupBy,
  onOrgClick,
}: {
  rows: ConsumptionBreakdownRow[]
  groupBy: ConsumptionGroupBy
  onOrgClick: (orgId: string) => void
}) {
  const clickable = groupBy === 'org'
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-y border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <th className="px-1 py-2 font-semibold">{labelForGroup(groupBy)}</th>
          <th className="px-1 py-2 font-semibold text-right">Calls</th>
          <th className="px-1 py-2 font-semibold text-right">Cost</th>
          <th className="px-1 py-2 font-semibold text-right">%</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.key}
            className={cn('border-b border-border/50 last:border-0', clickable && 'cursor-pointer hover:bg-muted/40')}
            onClick={() => clickable && onOrgClick(row.key)}
          >
            <td className="px-1 py-2 font-medium">{row.label}</td>
            <td className="px-1 py-2 text-right tabular-nums">{formatNumber(row.calls)}</td>
            <td className="px-1 py-2 text-right font-semibold tabular-nums">{formatCurrency(row.costUsd, 4)}</td>
            <td className="px-1 py-2 text-right tabular-nums text-muted-foreground">{row.pctOfTotal.toFixed(1)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function labelForGroup(group: ConsumptionGroupBy): string {
  switch (group) {
    case 'agent':
      return 'Feature'
    case 'model':
      return 'Model'
    case 'provider':
      return 'Provider'
    case 'org':
      return 'Organization'
    case 'user':
      return 'User'
  }
}

function daysBetween(from: string, to: string) {
  const start = new Date(from).getTime()
  const end = new Date(to).getTime()
  return Math.abs(end - start) / (24 * 60 * 60 * 1000)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value)
}

function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return formatNumber(value)
}

function formatCurrency(value: number, maxFraction = 2) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Math.min(2, maxFraction),
    maximumFractionDigits: maxFraction,
  }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: value.includes('T') ? 'numeric' : undefined }).format(new Date(value))
}

function shortDate(value: string) {
  return formatDate(value)
}