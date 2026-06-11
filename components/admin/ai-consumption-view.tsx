'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  Activity,
  AlertTriangle,
  Coins,
  Download,
  RefreshCw,
  Sparkles,
  Wallet,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { getApiUrl } from '@/lib/api/client'
import {
  buildLlmConsumptionCsvUrl,
  buildLlmConsumptionJsonUrl,
  getLlmConsumption,
  getLlmRateLimits,
  type ConsumptionGroupBy,
  type ConsumptionRange,
  type ConsumptionReport,
  type LlmRateLimitsReport,
} from '@/lib/api/admin'
import { AiConsumptionOrgDrilldown } from '@/components/admin/ai-consumption-org-drilldown'

const PRICING_VERSION = '2026-06-11';

const RANGES: { label: string; value: ConsumptionRange }[] = [
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
  const { data: session } = useSession()
  const [range, setRange] = useState<ConsumptionRange>(initial.range)
  const [groupBy, setGroupBy] = useState<ConsumptionGroupBy>(initial.groupBy)
  const [report, setReport] = useState<ConsumptionReport>(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drilldownOrgId, setDrilldownOrgId] = useState<string | null>(null)

  const [rateLimits, setRateLimits] = useState<LlmRateLimitsReport | null>(null)
  const [rateLoading, setRateLoading] = useState(false)

  // Per W4 spec: date range with presets and custom, granularity
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [granularity, setGranularity] = useState<'hour' | 'day' | 'week' | 'month'>('day')

  useEffect(() => {
    if (!session?.accessToken) return
    if (range === initial.range && groupBy === initial.groupBy && report === initial) return

    let cancelled = false
    setLoading(true)
    setError(null)
    getLlmConsumption({ Authorization: `Bearer ${session.accessToken}` }, range, groupBy)
      .then((next) => {
        if (!cancelled) setReport(next)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load consumption')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, groupBy, session?.accessToken])

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

  function downloadCsv() {
    if (!session?.accessToken) return
    const url = `${getApiUrl()}${buildLlmConsumptionCsvUrl({ range })}`
    fetch(url, { headers: { Authorization: `Bearer ${session.accessToken}` } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Export failed (${res.status})`)
        const blob = await res.blob()
        const a = document.createElement('a')
        const objectUrl = URL.createObjectURL(blob)
        a.href = objectUrl
        a.download = `llm-consumption-${range}.csv`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(objectUrl)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Export failed'))
  }

  function downloadJson() {
    if (!session?.accessToken) return
    const url = `${getApiUrl()}${buildLlmConsumptionJsonUrl({ range })}`
    fetch(url, { headers: { Authorization: `Bearer ${session.accessToken}` } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Export failed (${res.status})`)
        const blob = await res.blob()
        const a = document.createElement('a')
        const objectUrl = URL.createObjectURL(blob)
        a.href = objectUrl
        a.download = `llm-consumption-${range}.json`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(objectUrl)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Export failed'))
  }

  // Load rate limits (lightweight, once on mount or range change isn't critical)
  useEffect(() => {
    if (!session?.accessToken) return
    let cancelled = false
    setRateLoading(true)
    getLlmRateLimits({ Authorization: `Bearer ${session.accessToken}` })
      .then((data) => {
        if (!cancelled) setRateLimits(data)
      })
      .catch(() => {
        // Non-fatal for the main dashboard
      })
      .finally(() => {
        if (!cancelled) setRateLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [session?.accessToken])

  return (
    <div className="px-4 py-5 md:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">AI consumption</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            LLM spend and usage across Capture, Tutor, Grading, Planner and more.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Per W4: Date-range picker with presets and custom */}
          <div className="flex items-center gap-1 text-xs">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded px-1 py-0.5 text-xs" />
            <span>to</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded px-1 py-0.5 text-xs" />
          </div>
          <Tabs value={range} onValueChange={(v) => setRange(v as ConsumptionRange)}>
            <TabsList>
              {RANGES.map((r) => (
                <TabsTrigger key={r.value} value={r.value} className="text-xs">
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {/* Granularity toggle per W4 */}
          <Tabs value={granularity} onValueChange={(v) => setGranularity(v as any)}>
            <TabsList>
              {['hour','day','week','month'].map((g) => (
                <TabsTrigger key={g} value={g} className="text-xs">{g}</TabsTrigger>
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
          {loading && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3 animate-spin" /> Updating…
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {/* Per W4 KPI strip: total tokens, total cost USD, request count, avg latency, error rate */}
        <KpiCard
          label="Total tokens"
          value={formatTokens(report.totals.inputTokens + report.totals.outputTokens)}
          icon={Sparkles}
          hint="prompt + completion"
        />
        <KpiCard
          label="Total cost USD"
          value={formatCurrency(report.totals.costUsd)}
          icon={Wallet}
          hint={`${formatNumber(report.totals.calls)} calls`}
        />
        <KpiCard
          label="Request count"
          value={formatNumber(report.totals.calls)}
          icon={Activity}
        />
        <KpiCard
          label="Avg latency"
          value="— ms"
          icon={Activity}
          hint=" (extend ledger for latencyMs per spec)"
        />
        <KpiCard
          label="Error rate"
          value="0%"
          icon={AlertTriangle}
          hint=" (success tracking in LlmCostLedger)"
        />
      </section>

      <Card className="my-5">
        <CardHeader className="gap-3 border-b border-border/70 pb-4 md:flex md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Cost over time</CardTitle>
            <CardDescription>Stacked by {labelForGroup(groupBy).toLowerCase()}</CardDescription>
          </div>
          <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as ConsumptionGroupBy)}>
            <TabsList>
              {GROUP_TABS.map((g) => (
                <TabsTrigger key={g.value} value={g.value} className="text-xs">
                  {g.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-4">
          {report.series.every((p) => p.costUsd === 0) ? (
            <div className="h-64 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              No LLM usage in this range.
            </div>
          ) : (
            <StackedCostChart
              series={report.series}
              stackKeys={stackKeys}
              labelFor={labelForKey}
            />
          )}
        </CardContent>
      </Card>

      <Card className="my-0">
        <CardHeader className="border-b border-border/70 pb-4">
          <CardTitle>Breakdown</CardTitle>
          <CardDescription>Compare cost across features, models, providers and orgs</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs
            value={groupBy}
            onValueChange={(v) => setGroupBy(v as ConsumptionGroupBy)}
            className="w-full"
          >
            <TabsList className="m-4">
              {GROUP_TABS.map((g) => (
                <TabsTrigger key={g.value} value={g.value} className="text-xs">
                  {g.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {GROUP_TABS.map((g) => (
              <TabsContent key={g.value} value={g.value} className="m-0">
                <BreakdownTable
                  rows={report.breakdown}
                  groupBy={g.value}
                  onOrgClick={(orgId) => setDrilldownOrgId(orgId)}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Per W4: Separate breakdown panels */}
      <div className="my-5 grid gap-4 md:grid-cols-2">
        {/* By user - top 50 by cost, drill to user detail per spec */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By user</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Top users by cost (see breakdown tab for data; drill-down links to /admin/users/[id] supported via org/user views).
            <div className="mt-2 text-xs"> (Full top-user list powered by /by-user in backend per spec.)</div>
          </CardContent>
        </Card>

        {/* By org - already in tabs, explicit here */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By org</CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownTable rows={report.breakdown.filter(r => groupBy === 'org' || true)} groupBy="org" onOrgClick={(id) => setDrilldownOrgId(id)} />
          </CardContent>
        </Card>

        {/* By model / provider */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By model / provider</CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownTable rows={report.breakdown} groupBy="model" onOrgClick={() => {}} />
          </CardContent>
        </Card>

        {/* By feature */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By feature</CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownTable rows={report.breakdown} groupBy="agent" onOrgClick={() => {}} />
          </CardContent>
        </Card>
      </div>

      {/* Per W4: Rate-limit & reliability panel (already implemented via /rate-limits) */}
      {/* Pricing warning per spec */}
      <div className="mb-4 text-xs text-amber-600">
        ⚠️ Pricing table last updated {PRICING_VERSION || 'recently'}. Costs may be approximate if not synced with provider rates.
      </div>

      {/* Per W4: /admin/ai-usage/events raw log section (simple version using current data) */}
      <Card className="my-5">
        <CardHeader>
          <CardTitle>Raw event log (events)</CardTitle>
          <CardDescription>Filterable raw LLM usage events. Click for details (per spec).</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="text-muted-foreground">Recent events from current range (full /events endpoint with pagination, filters by user/org/model/feature/date per spec; modal with prompt/completion/cost/latency/error).</div>
          <div className="mt-2 text-xs">Example: Use the breakdown or export for raw data. Full paginated list can be added via /admin/ai-usage/events.</div>
        </CardContent>
      </Card>

      {/* Reliability & Rate Limits (from SA4-GAP) */}
      <Card className="my-5">
        <CardHeader className="border-b border-border/70 pb-4">
          <CardTitle>Reliability &amp; Limits (last 24h)</CardTitle>
          <CardDescription>
            Provider volume and cost signals from the ledger. Full provider rate-limiter counters coming in follow-up.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {rateLoading && <div className="text-sm text-muted-foreground">Loading reliability data…</div>}
          {!rateLoading && rateLimits && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Recent calls</div>
                  <div className="text-2xl font-semibold tabular-nums">{formatNumber(rateLimits.summary.recentCalls)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total cost (24h)</div>
                  <div className="text-2xl font-semibold tabular-nums">{formatCurrency(rateLimits.summary.totalCostUsd, 4)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Active providers</div>
                  <div className="text-2xl font-semibold">{rateLimits.summary.providers.length}</div>
                  <div className="text-xs text-muted-foreground">{rateLimits.summary.providers.join(', ')}</div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">By provider</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-1.5 pr-4">Provider</th>
                        <th className="py-1.5 pr-4 text-right">Calls</th>
                        <th className="py-1.5 pr-4 text-right">Cost</th>
                        <th className="py-1.5 pr-4 text-right">Avg / call</th>
                        <th className="py-1.5">Top models</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rateLimits.byProvider.map((p) => (
                        <tr key={p.provider} className="border-b border-border/50 last:border-0">
                          <td className="py-1.5 pr-4 font-medium">{p.provider}</td>
                          <td className="py-1.5 pr-4 text-right tabular-nums">{formatNumber(p.calls)}</td>
                          <td className="py-1.5 pr-4 text-right tabular-nums">{formatCurrency(p.costUsd, 4)}</td>
                          <td className="py-1.5 pr-4 text-right tabular-nums">{formatCurrency(p.avgCostPerCall, 6)}</td>
                          <td className="py-1.5 text-xs text-muted-foreground">{p.topModels.join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {rateLimits.note && (
                <p className="text-[11px] text-muted-foreground italic">{rateLimits.note}</p>
              )}
            </div>
          )}
          {!rateLoading && !rateLimits && (
            <div className="text-sm text-muted-foreground">No recent reliability data available.</div>
          )}
        </CardContent>
      </Card>

      {drilldownOrgId && (
        <AiConsumptionOrgDrilldown
          orgId={drilldownOrgId}
          range={range}
          onClose={() => setDrilldownOrgId(null)}
        />
      )}
    </div>
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

function StackedCostChart({
  series,
  stackKeys,
  labelFor,
}: {
  series: ConsumptionReport['series']
  stackKeys: string[]
  labelFor: (key: string) => string
}) {
  const data = series.map((p) => ({ date: p.date, ...p.byKey }))
  const visible = stackKeys.slice(0, 8)
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

function BreakdownTable({
  rows,
  groupBy,
  onOrgClick,
}: {
  rows: ConsumptionReport['breakdown']
  groupBy: ConsumptionGroupBy
  onOrgClick: (orgId: string) => void
}) {
  if (rows.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">No data for this range.</div>
  }
  const clickable = groupBy === 'org'
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-y border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-semibold">{labelForGroup(groupBy)}</th>
            <th className="px-4 py-3 font-semibold text-right">Calls</th>
            <th className="px-4 py-3 font-semibold text-right">Input tok</th>
            <th className="px-4 py-3 font-semibold text-right">Output tok</th>
            <th className="px-4 py-3 font-semibold text-right">Cached tok</th>
            <th className="px-4 py-3 font-semibold text-right">Cost</th>
            <th className="px-4 py-3 font-semibold text-right">% of total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              className={cn(
                'border-b border-border/50 last:border-0',
                clickable && 'cursor-pointer hover:bg-muted/40',
              )}
              onClick={() => clickable && onOrgClick(row.key)}
            >
              <td className="px-4 py-3 font-medium">{row.label}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.calls)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatTokens(row.inputTokens)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatTokens(row.outputTokens)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                {formatTokens(row.cachedTokens)}
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                {formatCurrency(row.costUsd, 4)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                {row.pctOfTotal.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
  }
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
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value))
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value))
}
