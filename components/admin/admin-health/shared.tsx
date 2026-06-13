'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { HealthStatus, WorkerHeartbeatStatus } from '@/lib/api/admin'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export const HEALTH_THRESHOLDS = {
  latency: {
    green: '< 50ms',
    yellow: '50–199ms',
    red: '≥ 200ms or timeout',
  },
  queue: {
    green: 'No failed jobs, normal backlog',
    yellow: 'High backlog (waiting > 100 or active > 20)',
    red: 'Failed jobs present',
  },
  worker: {
    green: 'Heartbeat < 30s',
    yellow: 'Heartbeat 30–60s',
    red: 'Heartbeat > 60s or missing',
  },
  llm: {
    green: 'Error rate < 3%, p95 < 2s',
    yellow: 'Error rate 3–10% or p95 ≥ 2s',
    red: 'Error rate ≥ 10%',
  },
} as const

const STATUS_STYLES: Record<HealthStatus, string> = {
  green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  yellow: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  red: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
}

const STATUS_DOT: Record<HealthStatus, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
}

export function workerToHealthStatus(status: WorkerHeartbeatStatus): HealthStatus {
  if (status === 'healthy') return 'green'
  if (status === 'stale') return 'yellow'
  return 'red'
}

export function formatLatency(ms: number | null) {
  if (ms === null) return '—'
  return `${ms}ms`
}

export function formatPercent(rate: number) {
  return `${(rate * 100).toFixed(1)}%`
}

export function formatDateTime(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

export function StatusPill({
  status,
  label,
  tooltip,
}: {
  status: HealthStatus
  label?: string
  tooltip?: string
}) {
  const pill = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
        STATUS_STYLES[status],
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[status])} />
      {label ?? status}
    </span>
  )

  if (!tooltip) return pill

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>{pill}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function HealthMetric({
  label,
  value,
  hint,
}: {
  label: string
  value: React.ReactNode
  hint?: string
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function HealthBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-sm font-medium text-primary hover:underline">
      ← {label}
    </Link>
  )
}

export function truncatePayload(payload: unknown, max = 1200) {
  const text = JSON.stringify(payload, null, 2) ?? 'null'
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n… truncated`
}