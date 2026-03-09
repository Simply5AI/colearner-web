'use client'

import { cn } from '@/lib/utils'
import type { PasswordStrength } from '@/lib/utils/password-strength'

interface PasswordStrengthMeterProps {
  strength: PasswordStrength
}

const segmentColors: Record<number, string> = {
  1: 'bg-destructive',
  2: 'bg-warning',
  3: 'bg-brand-orange',
  4: 'bg-success',
}

const labelColors: Record<number, string> = {
  1: 'text-destructive',
  2: 'text-warning',
  3: 'text-brand-orange',
  4: 'text-success',
}

export function PasswordStrengthMeter({ strength }: PasswordStrengthMeterProps) {
  if (strength.score === 0) return null

  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((segment) => (
          <div
            key={segment}
            className={cn(
              'h-[3px] flex-1 rounded-full transition-colors duration-300',
              segment <= strength.score
                ? segmentColors[strength.score]
                : 'bg-border'
            )}
          />
        ))}
      </div>
      <p className={cn('text-[11px]', labelColors[strength.score])}>
        {strength.label} password
      </p>
    </div>
  )
}
