'use client'

import { X, Pin } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConceptPinChipProps {
  conceptTitle: string
  onClear?: () => void
  className?: string
}

export function ConceptPinChip({ conceptTitle, onClear, className }: ConceptPinChipProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground',
        className,
      )}
    >
      <Pin className="h-3 w-3 shrink-0" />
      <span className="truncate">{conceptTitle}</span>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear pinned concept"
          className="ml-0.5 rounded-full p-0.5 hover:bg-background"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}
