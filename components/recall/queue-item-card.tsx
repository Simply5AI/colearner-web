'use client'

import { Calendar, Eye, Zap, PenLine, CheckSquare, Braces, FileQuestion, Check } from 'lucide-react'
import type { QueueItem, QuestionType } from '@/lib/types'

interface QueueItemCardProps {
  item: QueueItem
  selected: boolean
  onToggle: (questionId: string) => void
}

const typeConfig: Record<QuestionType, { label: string; subLabel: string; bg: string; color: string; icon: React.ReactNode }> = {
  FREE_TEXT: {
    label: 'Open Answer',
    subLabel: 'Factual',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    color: 'text-blue-600',
    icon: <PenLine className="h-[18px] w-[18px]" />,
  },
  MULTIPLE_CHOICE: {
    label: 'MCQ',
    subLabel: '4 options',
    bg: 'bg-teal-50 dark:bg-teal-950/30',
    color: 'text-teal-600',
    icon: <CheckSquare className="h-[18px] w-[18px]" />,
  },
  TRUE_FALSE: {
    label: 'True/False',
    subLabel: '2 options',
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    color: 'text-purple-600',
    icon: <FileQuestion className="h-[18px] w-[18px]" />,
  },
  CLOZE: {
    label: 'Fill-in-Blank',
    subLabel: 'Cloze',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    color: 'text-amber-600',
    icon: <Braces className="h-[18px] w-[18px]" />,
  },
}

function formatInterval(days: number): string {
  if (days === 0) return '0d'
  if (days < 1) return '<1d'
  return `${days}d`
}

function getScoreBadge(item: QueueItem) {
  if (item.source === 'new') {
    return { text: 'NEW', className: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' }
  }
  if (item.lastScore !== null) {
    const score = Math.round(item.lastScore * 10) / 10
    const isPass = item.lastScore >= 6
    return {
      text: `${score}/10`,
      className: isPass
        ? 'bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400'
        : 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
    }
  }
  return null
}

export function QueueItemCard({ item, selected, onToggle }: QueueItemCardProps) {
  const config = typeConfig[item.questionType] || typeConfig.FREE_TEXT
  const scoreBadge = getScoreBadge(item)
  const isFailed = item.source === 'failed'

  return (
    <div
      onClick={() => onToggle(item.questionId)}
      className={`relative cursor-pointer overflow-hidden rounded-xl border-[1.5px] p-[18px] transition-all duration-200
        ${selected
          ? 'border-brand-orange bg-brand-orange/[0.03]'
          : 'border-border bg-card hover:border-brand-orange hover:shadow-md'
        }
        ${isFailed ? 'border-l-[3px] border-l-destructive' : ''}
      `}
    >
      {/* Score badge */}
      {scoreBadge && (
        <span className={`absolute right-3.5 top-3.5 rounded-full px-2 py-0.5 font-mono text-[11px] font-bold ${scoreBadge.className}`}>
          {scoreBadge.text}
        </span>
      )}

      {/* Top row: type icon + concept + checkbox */}
      <div className="mb-3 flex items-center gap-2.5">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isFailed ? 'bg-red-50 text-red-600 dark:bg-red-950/30' : config.bg + ' ' + config.color}`}>
          {config.icon}
        </div>
        <div className="min-w-0 flex-1 pr-14">
          <p className="truncate text-sm font-bold text-foreground">{item.questionText}</p>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {config.label}
            <span className="inline-block h-[3px] w-[3px] rounded-full bg-muted-foreground" />
            {config.subLabel}
            <span className="inline-block h-[3px] w-[3px] rounded-full bg-muted-foreground" />
            {item.source === 'new' ? 'New' : item.source === 'failed' ? 'Failed' : 'Due today'}
          </p>
        </div>
        <div
          className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-colors
            ${selected
              ? 'border-brand-orange bg-brand-orange'
              : 'border-border'
            }
          `}
        >
          {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
        </div>
      </div>

      {/* SM-2 metadata row */}
      <div className="flex items-center gap-3 border-t border-border/60 pt-3">
        <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
          <Calendar className="h-3 w-3" />
          Interval: <span className="font-mono text-foreground/70">{formatInterval(item.interval)}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
          <Eye className="h-3 w-3" />
          Reps: <span className="font-mono text-foreground/70">{item.repetitions}</span>
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-semibold ${isFailed ? 'text-destructive' : 'text-muted-foreground'}`}>
          <Zap className="h-3 w-3" />
          EF: <span className={`font-mono ${isFailed ? 'text-destructive' : 'text-foreground/70'}`}>{item.easinessFactor}</span>
        </div>
      </div>
    </div>
  )
}
