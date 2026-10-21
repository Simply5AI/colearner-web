'use client'
import { cn } from '@/lib/utils'
import type { PasswordStrength } from '@/lib/utils/password-strength'

interface PasswordStrengthMeterProps { strength: PasswordStrength }
const colors: Record<number, string> = { 1: 'bg-destructive', 2: 'bg-primary/60', 3: 'bg-primary', 4: 'bg-success' }
export function PasswordStrengthMeter({ strength }: PasswordStrengthMeterProps) {
  if (strength.score === 0) return null
  return <div className="space-y-2" aria-live="polite"><div className="flex gap-1" aria-hidden>{[1, 2, 3, 4].map((segment) => <div key={segment} className={cn('h-1.5 flex-1 rounded-full', segment <= strength.score ? colors[strength.score] : 'bg-border')} />)}</div><p className="text-sm text-muted-foreground">{strength.label} password</p></div>
}
