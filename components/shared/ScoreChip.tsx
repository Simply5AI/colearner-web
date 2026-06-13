'use client'

import { cn } from '@/lib/utils'

interface ScoreChipProps {
  score: number
  max?: number
  size?: 'sm' | 'md'
  className?: string
}

function getTone(percent: number): string {
  if (percent >= 80) return 'bg-emerald-50 text-emerald-800 border-emerald-200'
  if (percent >= 60) return 'bg-amber-50 text-amber-800 border-amber-200'
  return 'bg-rose-50 text-rose-800 border-rose-200'
}

export function ScoreChip({ score, max = 100, size = 'md', className }: ScoreChipProps) {
  const clamped = Math.min(Math.max(score, 0), max)
  const percent = max > 0 ? Math.round((clamped / max) * 100) : 0

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-semibold tabular-nums',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        getTone(percent),
        className,
      )}
    >
      {percent}%
    </span>
  )
}