'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const ranges = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'all', label: 'All time' },
]

export function MasteryRangePills() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const current = searchParams.get('range') || '30d'

  function setRange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === '30d') {
      params.delete('range')
    } else {
      params.set('range', value)
    }
    const qs = params.toString()
    router.push(`${pathname}${qs ? `?${qs}` : ''}`)
  }

  return (
    <div className="flex gap-1 rounded-lg border border-border bg-accent/30 p-0.5">
      {ranges.map((r) => (
        <button
          key={r.value}
          onClick={() => setRange(r.value)}
          className={cn(
            'rounded-md px-3 py-1 text-[11px] font-semibold transition-colors',
            current === r.value
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
