'use client'

import { FileQuestion, PenLine, Braces, CheckSquare } from 'lucide-react'
import type { QueueStats, QuestionType } from '@/lib/types'

interface QueuePreviewProps {
  stats: QueueStats
}

const typeInfo: Record<QuestionType, { label: string; icon: React.ReactNode; color: string }> = {
  MULTIPLE_CHOICE: {
    label: 'MCQ',
    icon: <CheckSquare className="h-4 w-4" />,
    color: 'text-brand-blue',
  },
  FREE_TEXT: {
    label: 'Open',
    icon: <PenLine className="h-4 w-4" />,
    color: 'text-brand-orange',
  },
  TRUE_FALSE: {
    label: 'True/False',
    icon: <FileQuestion className="h-4 w-4" />,
    color: 'text-brand-purple',
  },
  CLOZE: {
    label: 'Fill-in',
    icon: <Braces className="h-4 w-4" />,
    color: 'text-brand-teal',
  },
}

export function QueuePreview({ stats }: QueuePreviewProps) {
  if (stats.typeBreakdown.length === 0) return null

  return (
    <div className="rounded-xl border bg-card p-6">
      <h2 className="text-lg font-semibold mb-3">Question Pool</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Questions will be randomly selected and sorted easy to tough
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.typeBreakdown.map((tb) => {
          const info = typeInfo[tb.type] || typeInfo.FREE_TEXT
          return (
            <div
              key={tb.type}
              className="flex items-center gap-2 rounded-lg border p-3"
            >
              <span className={info.color}>{info.icon}</span>
              <div>
                <p className="text-xs text-muted-foreground">{info.label}</p>
                <p className="text-sm font-semibold">{tb.count}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
        <span>New: {stats.newCount}</span>
        <span>Due for review: {stats.dueCount}</span>
        <span>Failed: {stats.failedCount}</span>
      </div>
    </div>
  )
}
