import type { PlanStatus } from '@/lib/api/teaching/plans'
import { cn } from '@/lib/utils'
import { statusLabel } from './plan-format'

/** Status is always spelled out in words, never by colour alone. */
export function PlanStatusChip({ status, className }: { status: PlanStatus; className?: string }) {
  return <span data-status={status} className={cn('inline-flex h-5 items-center rounded-full border px-2 text-xs font-semibold', status === 'PUBLISHED' ? 'border-primary/40 bg-primary/10 text-primary' : status === 'DRAFT' ? 'border-border bg-background' : 'border-border bg-muted text-muted-foreground', className)}>{statusLabel[status]}</span>
}
