'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createRecallSession } from '@/lib/api/recall'
import type { QueueStats } from '@/lib/types'

interface QuestionCountSelectorProps {
  stats: QueueStats
  authHeaders: Record<string, string>
}

const presets = [5, 10, 15, 20]

export function QuestionCountSelector({ stats, authHeaders }: QuestionCountSelectorProps) {
  const router = useRouter()
  const [count, setCount] = useState(
    Math.min(10, stats.totalAvailable)
  )
  const [isStarting, setIsStarting] = useState(false)

  const maxCount = stats.totalAvailable

  async function handleStart() {
    if (count <= 0 || isStarting) return
    setIsStarting(true)

    try {
      const session = await createRecallSession(authHeaders, {
        questionCount: count,
      })
      router.push(`/recall/${session.id}`)
    } catch {
      setIsStarting(false)
    }
  }

  if (maxCount === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <p className="text-muted-foreground">
          No questions available. Capture some content first!
        </p>
        <Button
          variant="outline"
          className="mt-3"
          onClick={() => router.push('/capture')}
        >
          Go to Capture
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card p-6">
      <h2 className="text-lg font-semibold mb-4">How many questions?</h2>

      <div className="flex flex-wrap gap-2 mb-4">
        {presets
          .filter((p) => p <= maxCount)
          .map((preset) => (
            <button
              key={preset}
              onClick={() => setCount(preset)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                count === preset
                  ? 'border-brand-teal bg-brand-teal/10 text-brand-teal'
                  : 'hover:border-muted-foreground/30'
              }`}
            >
              {preset}
            </button>
          ))}
        {maxCount > 20 && (
          <button
            onClick={() => setCount(maxCount)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              count === maxCount
                ? 'border-brand-teal bg-brand-teal/10 text-brand-teal'
                : 'hover:border-muted-foreground/30'
            }`}
          >
            All ({maxCount})
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 mb-6">
        <input
          type="range"
          min={1}
          max={maxCount}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="flex-1 accent-[var(--brand-teal)]"
        />
        <span className="text-sm font-medium w-12 text-right">
          {count}
        </span>
      </div>

      <Button
        size="lg"
        className="w-full bg-brand-teal hover:bg-brand-teal/90 text-white"
        onClick={handleStart}
        disabled={isStarting || count <= 0}
      >
        {isStarting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Starting Session...
          </>
        ) : (
          <>
            <Play className="mr-2 h-4 w-4" />
            Start Recall ({count} questions)
          </>
        )}
      </Button>
    </div>
  )
}
