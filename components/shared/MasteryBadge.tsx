'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { MasteryLevel } from '@/lib/types/teacher'

const masteryConfig: Record<
  MasteryLevel,
  { label: string; className: string }
> = {
  new: { label: 'New', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  learning: { label: 'Learning', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  review: { label: 'Review', className: 'bg-sky-50 text-sky-800 border-sky-200' },
  mastered: { label: 'Mastered', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  excel: { label: 'Excel', className: 'bg-violet-50 text-violet-800 border-violet-200' },
}

interface MasteryBadgeProps {
  level: MasteryLevel
  className?: string
}

export function MasteryBadge({ level, className }: MasteryBadgeProps) {
  const config = masteryConfig[level]

  return (
    <Badge
      variant="outline"
      className={cn('font-medium', config.className, className)}
    >
      {config.label}
    </Badge>
  )
}