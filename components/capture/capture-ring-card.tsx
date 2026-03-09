'use client'

import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCaptureStore } from '@/lib/stores/capture-store'

interface CaptureRingCardProps {
  index: number
  label: string
  name: string
  description: string
  icon: React.ReactNode
  ringColor: string
  ringBg: string
  ringBorder: string
  ringShadow: string
  children: React.ReactNode
}

export function CaptureRingCard({
  index,
  label,
  name,
  description,
  icon,
  ringColor,
  ringBg,
  ringBorder,
  ringShadow,
  children,
}: CaptureRingCardProps) {
  const expanded = useCaptureStore((s) => s.expandedSource === index)
  const toggle = useCaptureStore((s) => s.toggleSource)

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border bg-card transition-all duration-200',
        expanded
          ? `${ringBorder} ${ringShadow}`
          : 'border-border hover:border-muted-foreground/30 hover:shadow-md'
      )}
    >
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => toggle(index)}
        className="flex w-full items-center gap-3.5 px-5 py-4 text-left"
      >
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
            ringBg
          )}
          style={{ color: ringColor }}
        >
          {icon}
        </div>
        <div className="flex-1">
          <div
            className="text-[9px] font-bold uppercase tracking-widest"
            style={{ color: ringColor }}
          >
            {label}
          </div>
          <div className="text-[15px] font-extrabold text-foreground">
            {name}
          </div>
          <div className="text-[11px] leading-snug text-muted-foreground">
            {description}
          </div>
        </div>
        <ChevronDown
          className={cn(
            'h-5 w-5 shrink-0 transition-transform duration-200',
            expanded ? 'rotate-180' : ''
          )}
          style={{ color: expanded ? ringColor : undefined }}
        />
      </button>

      {/* Body — expanded */}
      {expanded && (
        <div className="border-t border-border/50 p-5">{children}</div>
      )}
    </div>
  )
}
