'use client'

import Link from 'next/link'

interface NotificationNudgeProps {
  dueCount: number
  failedCount: number
}

export function NotificationNudge({
  dueCount,
  failedCount,
}: NotificationNudgeProps) {
  if (dueCount === 0) return null

  const smDue = dueCount - failedCount
  const parts: string[] = []
  if (smDue > 0) parts.push(`${smDue} from SM-2 schedule`)
  if (failedCount > 0) parts.push(`${failedCount} failed items`)

  return (
    <div className="flex items-center gap-3 rounded-xl border border-warning/15 bg-warning/5 px-4 py-3.5">
      <span className="shrink-0 text-[22px]">⏰</span>
      <div className="flex-1">
        <h4 className="text-xs font-bold text-warning">
          {dueCount} items due for review
        </h4>
        <p className="text-[11px] text-muted-foreground">
          {parts.join(', ')}
        </p>
      </div>
      <Link
        href="/practice"
        className="shrink-0 rounded-lg bg-warning px-3.5 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-warning/90"
      >
        Start Practice →
      </Link>
    </div>
  )
}
