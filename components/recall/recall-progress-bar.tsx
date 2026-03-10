'use client'

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface RecallProgressBarProps {
  current: number
  total: number
}

export function RecallProgressBar({ current, total }: RecallProgressBarProps) {
  const router = useRouter()
  const progress = total > 0 ? (current / total) * 100 : 0

  return (
    <div className="flex items-center gap-4 mb-6">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => router.push('/recall/start')}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium">
            Q {Math.min(current + 1, total)} of {total}
          </span>
          <span className="text-xs text-muted-foreground">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-brand-teal transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-2 w-2 rounded-full transition-colors ${
              i < current
                ? 'bg-brand-teal'
                : i === current
                  ? 'bg-brand-orange'
                  : 'bg-muted'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
