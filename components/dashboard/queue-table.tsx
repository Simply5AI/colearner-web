'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { RecallQueueItem } from '@/lib/types'

interface QueueTableProps {
  items: RecallQueueItem[]
}

const typeBadge: Record<string, { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-blue-50 text-blue-700' },
  mcq: { label: 'MCQ', className: 'bg-teal-50 text-teal-700' },
  cloze: { label: 'Cloze', className: 'bg-purple-50 text-purple-700' },
}

export function QueueTable({ items }: QueueTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <p className="text-sm text-muted-foreground">
          No items match your filters.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border/50 bg-accent/30">
            <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Concept
            </th>
            <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Type
            </th>
            <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Source
            </th>
            <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Last Score
            </th>
            <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              SM-2
            </th>
            <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isFailed = item.source === 'failed'
            const badge = typeBadge[item.type] ?? { label: 'Open', className: 'bg-blue-50 text-blue-700' }

            return (
              <tr
                key={item.id}
                className={cn(
                  'border-b border-border/30 transition-colors last:border-b-0',
                  isFailed
                    ? 'bg-destructive/[0.03]'
                    : 'hover:bg-accent/50'
                )}
              >
                <td className="max-w-[250px] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-semibold text-foreground">
                      {item.conceptTitle}
                    </span>
                    {item.dueCount > 1 && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                        {item.dueCount} due
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'rounded px-2 py-0.5 text-[10px] font-bold',
                      badge.className
                    )}
                  >
                    {badge.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-[11px] text-muted-foreground">
                  {isFailed ? (
                    <span className="text-destructive">Failed</span>
                  ) : (
                    'SM-2 Due'
                  )}
                </td>
                <td className="px-4 py-3">
                  {item.lastScore !== null ? (
                    <span
                      className={cn(
                        'font-mono text-[11px] font-semibold',
                        item.lastScore >= 7
                          ? 'text-green-600'
                          : item.lastScore >= 5
                            ? 'text-warning'
                            : 'text-destructive'
                      )}
                    >
                      {item.lastScore}/10
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      —
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="text-[10px] text-muted-foreground">
                    <span className="font-mono">
                      EF {item.easeFactor.toFixed(1)}
                    </span>
                    {' · '}
                    <span className="font-mono">{item.interval}d</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href="/recall"
                    className={cn(
                      'rounded-lg px-3 py-1 text-[10px] font-bold text-white transition-colors',
                      isFailed
                        ? 'bg-warning hover:bg-warning/90'
                        : 'bg-primary hover:bg-primary/90'
                    )}
                  >
                    {isFailed ? 'Retry' : 'Recall'}
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
