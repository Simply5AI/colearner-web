'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  getLlmConsumptionByOrg,
  type ConsumptionRange,
  type OrgConsumptionReport,
} from '@/lib/api/admin'

interface Props {
  orgId: string
  range: ConsumptionRange
  onClose: () => void
}

export function AiConsumptionOrgDrilldown({ orgId, range, onClose }: Props) {
  const { data: session } = useSession()
  const [report, setReport] = useState<OrgConsumptionReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.accessToken) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getLlmConsumptionByOrg(
      { Authorization: `Bearer ${session.accessToken}` },
      orgId,
      range,
    )
      .then((r) => {
        if (!cancelled) setReport(r)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load org report')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [orgId, range, session?.accessToken])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{report?.orgName ?? 'Organization consumption'}</DialogTitle>
          <DialogDescription>
            LLM spend breakdown · {range === 'all' ? 'All time' : `Last ${range}`}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {report && !loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Cost" value={formatCurrency(report.totals.costUsd)} />
              <Stat label="Calls" value={formatNumber(report.totals.calls)} />
              <Stat label="Input tok" value={formatTokens(report.totals.inputTokens)} />
              <Stat label="Output tok" value={formatTokens(report.totals.outputTokens)} />
            </div>

            <Section title="By feature">
              <MiniTable rows={report.byAgent} />
            </Section>

            <Section title="By model">
              <MiniTable rows={report.byModel} />
            </Section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  )
}

function MiniTable({ rows }: { rows: OrgConsumptionReport['byAgent'] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No data.</p>
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border/70">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-border/50 last:border-0">
              <td className="px-3 py-2 font-medium">{row.label}</td>
              <td className="px-3 py-2 text-right text-xs text-muted-foreground tabular-nums">
                {formatNumber(row.calls)} calls
              </td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">
                {formatCurrency(row.costUsd, 4)}
              </td>
              <td className="px-3 py-2 text-right text-xs text-muted-foreground tabular-nums">
                {row.pctOfTotal.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
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
