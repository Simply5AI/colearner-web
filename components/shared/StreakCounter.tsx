'use client'

interface StreakCounterProps {
  count: number
}

/** Displays current daily streak with flame icon */
export function StreakCounter({ count }: StreakCounterProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-lg" role="img" aria-label="streak">
        {count > 0 ? '\uD83D\uDD25' : '\u2744\uFE0F'}
      </span>
      <span className="font-semibold">{count}</span>
      <span className="text-sm text-muted-foreground">day streak</span>
    </div>
  )
}
