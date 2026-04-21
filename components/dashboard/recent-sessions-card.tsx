'use client'

import Link from 'next/link'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RecallSessionHistoryItem } from '@/lib/types'

interface RecentSessionsCardProps {
  sessions: RecallSessionHistoryItem[]
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function RecentSessionsCard({ sessions }: RecentSessionsCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border/50 px-[18px] py-3.5">
        <div className="flex items-center gap-2 text-[13px] font-bold text-foreground">
          🕘 Recent Sessions
        </div>
        <Link
          href="/dashboard/history"
          className="text-[11px] font-semibold text-primary hover:underline"
        >
          View all →
        </Link>
      </div>

      <div className="space-y-1.5 p-3.5">
        {sessions.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No sessions yet. Start practicing to see your history.
          </p>
        )}

        {sessions.map((session) => {
          const accuracy =
            session.accuracy != null ? Math.round(session.accuracy * 100) : null
          const isCompleted = session.status === 'COMPLETED'
          const title = session.extraction?.title ?? 'Untitled Source'

          const row = (
            <div
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                'border-border/50 hover:border-border hover:bg-accent/50',
              )}
            >
              {/* Status dot */}
              <div
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full',
                  session.status === 'COMPLETED'
                    ? 'bg-green-500'
                    : session.status === 'ABANDONED'
                      ? 'bg-amber-500'
                      : 'bg-blue-500',
                )}
              />

              {/* Title + date */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">
                  {title}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{formatDate(session.startedAt)}</span>
                  <span>&middot;</span>
                  <span>{session.totalQuestions} questions</span>
                </div>
              </div>

              {/* Score */}
              {isCompleted && accuracy != null && (
                <div className="shrink-0 text-right">
                  <div className="flex items-center gap-1 text-xs font-semibold">
                    <span className="text-emerald-600">
                      {session.correctCount ?? 0}
                    </span>
                    <span className="text-muted-foreground">/</span>
                    <span>{session.totalQuestions}</span>
                  </div>
                  <span
                    className={cn(
                      'text-[10px] font-bold',
                      accuracy >= 70
                        ? 'text-emerald-600'
                        : accuracy >= 40
                          ? 'text-amber-600'
                          : 'text-red-500',
                    )}
                  >
                    {accuracy}%
                  </span>
                </div>
              )}

              {!isCompleted && (
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold',
                    session.status === 'ABANDONED'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-blue-700',
                  )}
                >
                  {session.status === 'ABANDONED' ? 'Abandoned' : 'In Progress'}
                </span>
              )}
            </div>
          )

          if (isCompleted) {
            return (
              <Link key={session.id} href={`/recall/summary/${session.id}`}>
                {row}
              </Link>
            )
          }

          return <div key={session.id}>{row}</div>
        })}
      </div>
    </div>
  )
}
