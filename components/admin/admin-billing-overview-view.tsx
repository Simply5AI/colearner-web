'use client'

import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import { AlertTriangle, ArrowUpRight, RefreshCw } from 'lucide-react'
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
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  getBillingOverview,
  getBillingRecentTransactions,
  type BillingOverview,
  type BillingTransactionRow,
} from '@/lib/api/admin'

interface AdminBillingOverviewViewProps {
  overview: BillingOverview
  transactions: BillingTransactionRow[]
}

export function AdminBillingOverviewView({
  overview: initialOverview,
  transactions: initialTransactions,
}: AdminBillingOverviewViewProps) {
  const [overview, setOverview] = useState(initialOverview)
  const [transactions, setTransactions] = useState(initialTransactions)
  const [loading, setLoading] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => new Date().toISOString())

  const chartData = useMemo(
    () =>
      overview.trend.series.map((point) => ({
        date: point.date.slice(5),
        newCount: point.newCount,
        churnedCount: point.churnedCount,
      })),
    [overview.trend.series],
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [nextOverview, nextTransactions] = await Promise.all([
        getBillingOverview({}),
        getBillingRecentTransactions({}, 20),
      ])
      setOverview(nextOverview)
      setTransactions(nextTransactions)
      setLastRefreshedAt(new Date().toISOString())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to refresh billing overview')
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className="px-4 py-5 md:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Billing overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Last refreshed {formatDateTime(lastRefreshedAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Link href="/admin/billing/subscriptions" className={buttonVariants()}>
            Manage subscriptions
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {overview.dataFreshness.stale && overview.dataFreshness.message ? (
        <Card className="my-0 mb-4 border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p>{overview.dataFreshness.message}</p>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="MRR" value={formatCurrency(overview.mrr.value)} delta={overview.mrr.deltaPct} />
        <KpiCard label="ARR" value={formatCurrency(overview.arr.value)} delta={overview.arr.deltaPct} />
        <KpiCard
          label="Paying orgs"
          value={String(overview.payingOrgs.value)}
          delta={overview.payingOrgs.deltaPct}
        />
        <KpiCard
          label="Churn rate (30d)"
          value={`${overview.churnRatePct.value.toFixed(1)}%`}
          hint={`Previous ${overview.churnRatePct.prevValue.toFixed(1)}%`}
        />
      </section>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="my-0">
          <CardHeader>
            <CardTitle>Plan distribution</CardTitle>
            <CardDescription>Active paid subscriptions by plan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.planDistribution.map((row) => (
              <div
                key={row.plan}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5"
              >
                <div>
                  <p className="font-semibold">{formatPlan(row.plan)}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.orgs} orgs · {formatCurrency(row.revenue)} MRR
                  </p>
                </div>
                <Badge variant="secondary">{row.sharePct.toFixed(1)}%</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="my-0">
          <CardHeader>
            <CardTitle>New vs churned (30d)</CardTitle>
            <CardDescription>Daily subscription signups and cancellations</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="newCount"
                  name="New"
                  stroke="var(--chart-1)"
                  fill="var(--chart-1)"
                  fillOpacity={0.2}
                />
                <Area
                  type="monotone"
                  dataKey="churnedCount"
                  name="Churned"
                  stroke="var(--chart-4)"
                  fill="var(--chart-4)"
                  fillOpacity={0.15}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="my-5">
        <CardHeader className="border-b border-border/70">
          <CardTitle>Recent transactions</CardTitle>
          <CardDescription>Last 20 invoices (USD)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Org</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-muted-foreground">
                      No transactions yet.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(tx.createdAt)}</td>
                      <td className="px-4 py-3 font-medium">{tx.orgName}</td>
                      <td className="px-4 py-3">{formatPlan(tx.plan)}</td>
                      <td className="px-4 py-3 font-semibold tabular-nums">{formatCurrency(tx.amountUsd)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={tx.status === 'paid' ? 'secondary' : 'outline'}>{tx.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{tx.method}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCard({
  label,
  value,
  delta,
  hint,
}: {
  label: string
  value: string
  delta?: number | null
  hint?: string
}) {
  return (
    <Card className="my-0">
      <CardContent className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        {delta !== undefined && delta !== null ? (
          <p className={cn('mt-1 text-xs font-medium', delta >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {delta >= 0 ? '+' : ''}
            {delta}% vs prior period
          </p>
        ) : null}
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPlan(plan: string) {
  return plan.charAt(0) + plan.slice(1).toLowerCase()
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString()
}