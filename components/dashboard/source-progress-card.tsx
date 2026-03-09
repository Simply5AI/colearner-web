'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SourceProgress } from '@/lib/types'

interface SourceProgressCardProps {
  progress: SourceProgress
}

const stateConfig: Record<
  string,
  { emoji: string; label: string; activeClass: string }
> = {
  explore: {
    emoji: '🧭',
    label: 'Explore',
    activeClass: 'border-brand-teal bg-brand-teal/10 text-brand-teal',
  },
  learn: {
    emoji: '🚂',
    label: 'Learn',
    activeClass: 'border-blue-600 bg-blue-50 text-blue-600',
  },
  grow: {
    emoji: '🌱',
    label: 'Grow',
    activeClass: 'border-purple-600 bg-purple-50 text-purple-600',
  },
  excel: {
    emoji: '🏆',
    label: 'Excel',
    activeClass: 'border-green-700 bg-green-50 text-green-700',
  },
}

const allStates = ['explore', 'learn', 'grow', 'excel'] as const

export function SourceProgressCard({ progress }: SourceProgressCardProps) {
  const rawPct = Math.round(
      (progress.totalAttempts / progress.requiredAttempts) * 100
  )
  const pct = Math.min(100, Math.max(isNaN(rawPct) ? 0 : rawPct, 0))
  // SVG ring calculations
  const radius = 42
  const circumference = 2 * Math.PI * radius
  let offset = circumference - (pct / 100) * circumference
  if (isNaN(offset)) {
    offset = circumference
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border/50 px-[18px] py-3.5">
        <div className="flex items-center gap-2 text-[13px] font-bold text-foreground">
          📊 Source Progress
        </div>
        <Link
          href="/mastery"
          className="text-[11px] font-semibold text-primary hover:underline"
        >
          View details →
        </Link>
      </div>

      <div className="p-5">
        {/* Ring + Info */}
        <div className="mb-5 flex items-center gap-6">
          {/* SVG Ring */}
          <div className="relative h-[100px] w-[100px] shrink-0">
            <svg
              className="-rotate-90"
              viewBox="0 0 100 100"
              width={100}
              height={100}
            >
              <circle
                cx={50}
                cy={50}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={6}
                className="text-border"
              />
              <circle
                cx={50}
                cy={50}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="text-brand-teal transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[28px] font-black leading-none text-brand-teal">
                {progress.currentSource}
              </span>
              <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
                Source
              </span>
            </div>
          </div>

          {/* Info */}
          <div>
            <h3 className="mb-1 text-base font-extrabold text-foreground">
              {progress.sourceName}
            </h3>
            <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
              Complete {progress.requiredAttempts} recall attempts with{' '}
              {progress.requiredPassRate}%+ pass rate to unlock Source{' '}
              {progress.currentSource + 1}.
            </p>

            {/* Milestones */}
            <div className="flex flex-col gap-1.5">
              {(progress.milestones || []).map((m) => (
                <div key={m.label} className="flex items-center gap-2 text-[11px]">
                  <div
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px]',
                      m.completed
                        ? 'border-green-600 bg-green-600 text-white'
                        : 'border-border'
                    )}
                  >
                    {m.completed && <Check className="h-2.5 w-2.5" />}
                  </div>
                  <span
                    className={cn(
                      m.completed
                        ? 'text-muted-foreground line-through'
                        : 'text-foreground/80'
                    )}
                  >
                    {m.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Engagement state pills */}
        <div className="text-[10px] text-muted-foreground">
          <strong className="text-foreground/80">
            Current engagement state:
          </strong>
        </div>
        <div className="mt-1.5 flex gap-1.5">
          {allStates.map((state) => {
            const cfg = stateConfig[state] ?? { emoji: '🧭', label: state, activeClass: '' }
            const isActive = (progress.availableStates || []).includes(state)
            const isCurrent = progress.engagementState === state

            return (
              <div
                key={state}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-[11px] font-semibold transition-colors',
                  isCurrent
                    ? cfg.activeClass
                    : isActive
                      ? 'border-border bg-card text-foreground/80'
                      : 'cursor-not-allowed border-border bg-card text-muted-foreground/35'
                )}
              >
                {cfg.emoji} {cfg.label}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
