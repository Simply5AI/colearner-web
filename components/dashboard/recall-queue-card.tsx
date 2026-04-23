'use client'

import Link from 'next/link'
import type { ComponentType } from 'react'
import { ArrowRight, FileQuestion, ListChecks, PenLine, TextCursorInput } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RecallQueueItem } from '@/lib/types'

interface RecallQueueCardProps {
  items: RecallQueueItem[]
}

const typeConfig: Record<string, { icon: ComponentType<{ className?: string }>; bgClass: string; color: string }> = {
  open: { icon: PenLine, bgClass: 'bg-blue-50', color: 'text-blue-600' },
  mcq: { icon: ListChecks, bgClass: 'bg-teal-50', color: 'text-teal-700' },
  cloze: { icon: TextCursorInput, bgClass: 'bg-purple-50', color: 'text-purple-700' },
}
const fallbackTypeConfig = typeConfig.open!

const sourceLabel: Record<RecallQueueItem['source'], string> = {
  weak: 'Needs work',
  new: 'Not yet practiced',
  practiced: 'Practiced',
}

export function RecallQueueCard({ items }: RecallQueueCardProps) {
  const displayItems = items.slice(0, 5)
  const total = items.length

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/50 px-[18px] py-3.5">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <FileQuestion className="h-4 w-4 text-primary" />
          Practice Queue
          {total > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              {total} source{total === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <Link
          href="/practice?tab=queue"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
        >
          View all
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="space-y-2 p-3.5">
        {displayItems.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Capture a source to build your practice queue.
          </p>
        )}

        {displayItems.map((item, idx) => {
          const cfg = typeConfig[item.type] ?? fallbackTypeConfig
          const isWeak = item.source === 'weak'

          return (
            <div
              key={`${item.id}-${idx}`}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                isWeak
                  ? 'border-destructive/15 bg-destructive/[0.025]'
                  : 'border-border/50 hover:border-border hover:bg-accent/50'
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  isWeak ? 'bg-destructive/10 text-destructive' : cfg.bgClass
                )}
              >
                <cfg.icon className={cn('h-4 w-4', isWeak ? 'text-destructive' : cfg.color)} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-semibold text-foreground">
                    {item.conceptTitle}
                  </span>
                  <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                    {item.dueCount} Q
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {sourceLabel[item.source]}
                  {item.lastScore !== null && (
                    <>
                      {' · '}
                      <span className={cn(isWeak ? 'text-destructive' : 'text-green-600')}>
                        Last: {item.lastScore}/10
                      </span>
                    </>
                  )}
                </div>
              </div>

              <Link
                href={item.extractionId ? `/recall/start/${item.extractionId}` : '/practice'}
                className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[10px] font-bold text-white transition-colors hover:bg-primary/90"
              >
                Practice
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
