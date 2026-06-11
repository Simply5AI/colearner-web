'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VideoSummaryData {
  overview: string
  keyTakeaways: string[]
}

interface VideoSummaryProps {
  summary: string
}

export const VideoSummary = ({ summary }: VideoSummaryProps) => {
  const [isOpen, setIsOpen] = useState(false)

  let parsed: VideoSummaryData | null = null
  try {
    parsed = JSON.parse(summary) as VideoSummaryData
  } catch {
    return null
  }

  if (!parsed?.overview || !parsed?.keyTakeaways?.length) return null

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-accent/50"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <BookOpen className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Video Summary</p>
            <p className="text-xs text-muted-foreground">
              Review key points before your practice session
            </p>
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      <div
        className={cn(
          'grid transition-all duration-200 ease-in-out',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-4 border-t border-border/50 px-5 py-4">
            {/* Overview */}
            <div>
              <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Overview
              </h4>
              <p className="text-sm leading-relaxed text-foreground/90">
                {parsed.overview}
              </p>
            </div>

            {/* Key Takeaways */}
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Key Takeaways
              </h4>
              <ul className="space-y-2">
                {parsed.keyTakeaways.map((point, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-foreground/90">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
