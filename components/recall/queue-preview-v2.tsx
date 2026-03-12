'use client'

import { useState, useMemo } from 'react'
import { Clock, XCircle } from 'lucide-react'
import type { QueueItem, QuestionType } from '@/lib/types'
import { QueueItemCard } from '@/components/recall/queue-item-card'

interface QueuePreviewV2Props {
  items: QueueItem[]
  selectedIds: Set<string>
  onToggle: (questionId: string) => void
}

const typeShortLabels: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: 'MCQ',
  FREE_TEXT: 'Open',
  TRUE_FALSE: 'T/F',
  CLOZE: 'Cloze',
}

type FilterType = 'ALL' | QuestionType

export function QueuePreviewV2({ items, selectedIds, onToggle }: QueuePreviewV2Props) {
  const [filter, setFilter] = useState<FilterType>('ALL')

  const dueItems = useMemo(() => items.filter((i) => i.source === 'due' || i.source === 'new'), [items])
  const failedItems = useMemo(() => items.filter((i) => i.source === 'failed'), [items])

  const filteredDueItems = filter === 'ALL'
    ? dueItems
    : dueItems.filter((i) => i.questionType === filter)

  // Build filter options from available types in due items
  const availableTypes = useMemo(() => {
    const types = new Set(dueItems.map((i) => i.questionType))
    return Array.from(types)
  }, [dueItems])

  const filters: { value: FilterType; label: string }[] = [
    { value: 'ALL', label: 'All' },
    ...availableTypes.map((t) => ({
      value: t as FilterType,
      label: typeShortLabels[t] ?? t,
    })),
  ]

  return (
    <div className="space-y-6">
      {/* Due Today Section */}
      {dueItems.length > 0 && (
        <div>
          <div className="mb-3.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-[15px] font-extrabold text-foreground">
              <Clock className="h-[18px] w-[18px] text-brand-orange" />
              Due Today
              <span className="rounded-full bg-brand-orange/10 px-2.5 py-0.5 text-[10px] font-bold text-brand-orange">
                {dueItems.length} items
              </span>
            </div>
            <div className="flex gap-1.5">
              {filters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`rounded-full px-3.5 py-[5px] text-[11px] font-semibold transition-colors ${
                    filter === f.value
                      ? 'bg-brand-orange text-white'
                      : 'border-[1.5px] border-border bg-card text-muted-foreground hover:border-muted-foreground/50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDueItems.map((item) => (
              <QueueItemCard
                key={item.questionId}
                item={item}
                selected={selectedIds.has(item.questionId)}
                onToggle={onToggle}
              />
            ))}
          </div>
        </div>
      )}

      {/* Failed Items Section */}
      {failedItems.length > 0 && (
        <div>
          <div className="mb-3.5 flex items-center gap-2 text-[15px] font-extrabold text-foreground">
            <XCircle className="h-[18px] w-[18px] text-destructive" />
            Failed — Needs Retry
            <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-[10px] font-bold text-destructive">
              {failedItems.length} items
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {failedItems.map((item) => (
              <QueueItemCard
                key={item.questionId}
                item={item}
                selected={selectedIds.has(item.questionId)}
                onToggle={onToggle}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
