'use client'

import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  max?: number
  label?: string
  showValue?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = true,
  size = 'md',
  className,
}: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), max)
  const percent = max > 0 ? Math.round((clamped / max) * 100) : 0

  const heightClass =
    size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2'

  return (
    <div className={cn('space-y-1', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {label ? <span className="font-medium text-foreground">{label}</span> : <span />}
          {showValue && <span className="tabular-nums">{percent}%</span>}
        </div>
      )}
      <div
        className={cn('w-full overflow-hidden rounded-full bg-muted', heightClass)}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div
          className={cn('h-full rounded-full bg-brand-teal transition-all duration-300', heightClass)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}