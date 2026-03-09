'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const typeFilters = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'mcq', label: 'MCQ' },
  { value: 'cloze', label: 'Cloze' },
]

export function QueueFilters() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const currentType = searchParams.get('type') || ''
  const failedOnly = searchParams.get('failed') === 'true'

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  function toggleFailed() {
    const params = new URLSearchParams(searchParams.toString())
    if (failedOnly) {
      params.delete('failed')
    } else {
      params.set('failed', 'true')
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-3">
      {/* Type pills */}
      <div className="flex gap-1.5">
        {typeFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => setParam('type', f.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors',
              currentType === f.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-muted-foreground'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="h-5 w-px bg-border" />

      {/* Failed toggle */}
      <button
        onClick={toggleFailed}
        className={cn(
          'rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors',
          failedOnly
            ? 'border-destructive bg-destructive/10 text-destructive'
            : 'border-border text-muted-foreground hover:border-muted-foreground'
        )}
      >
        Failed Only
      </button>
    </div>
  )
}
