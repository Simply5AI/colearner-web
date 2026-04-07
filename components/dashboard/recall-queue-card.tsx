'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { RecallQueueItem } from '@/lib/types'

interface RecallQueueCardProps {
  items: RecallQueueItem[]
}

const typeConfig: Record<string, { icon: string; bgClass: string }> = {
  open: { icon: '📝', bgClass: 'bg-blue-50' },
  mcq: { icon: '🔤', bgClass: 'bg-teal-50' },
  cloze: { icon: '✏️', bgClass: 'bg-purple-50' },
}

export function RecallQueueCard({ items }: RecallQueueCardProps) {
  const displayItems = items.slice(0, 5)
  const dueCount = items.length

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border/50 px-[18px] py-3.5">
        <div className="flex items-center gap-2 text-[13px] font-bold text-foreground">
          📋 Due for Review
          {dueCount > 0 && (
            <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-bold text-warning">
              {dueCount} due
            </span>
          )}
        </div>
        <Link
          href="/practice?tab=queue"
          className="text-[11px] font-semibold text-primary hover:underline"
        >
          View all →
        </Link>
      </div>

      <div className="space-y-2 p-3.5">
        {displayItems.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No items in the queue. You&apos;re all caught up!
          </p>
        )}

        {displayItems.map((item, idx) => {
          const cfg = typeConfig[item.type] ?? { icon: '📝', bgClass: 'bg-blue-50' }
          const isFailed = item.source === 'failed'

          return (
            <div
              key={`${item.id}-${idx}`}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                isFailed
                  ? 'border-destructive/10 bg-destructive/[0.02]'
                  : 'border-border/50 hover:border-border hover:bg-accent/50'
              )}
            >
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded text-[13px]',
                  isFailed ? 'bg-destructive/10' : cfg.bgClass
                )}
              >
                {cfg.icon}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-semibold text-foreground">
                    {item.conceptTitle}
                  </span>
                  {item.dueCount > 1 && (
                    <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                      {item.dueCount}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {isFailed ? 'Failed' : 'Due today'}
                  {item.lastScore !== null && (
                    <>
                      {' · '}
                      <span
                        className={cn(
                          isFailed
                            ? 'text-destructive'
                            : 'text-green-600'
                        )}
                      >
                        Last: {item.lastScore}/10
                      </span>
                    </>
                  )}
                </div>
              </div>

              <Link
                href="/recall"
                className="shrink-0 rounded-lg bg-primary px-3 py-1 text-[10px] font-bold text-white transition-colors hover:bg-primary/90"
              >
                {isFailed ? 'Retry' : 'Practice'}
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
