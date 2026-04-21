'use client'

import Link from 'next/link'
import { Clock, CheckCircle2, XCircle, AlertCircle, BookOpen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { RecallSessionHistoryItem } from '@/lib/types'

function formatDuration(seconds: number | null): string {
  if (!seconds) return '-'
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'COMPLETED':
      return (
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Completed
        </Badge>
      )
    case 'ABANDONED':
      return (
        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
          <AlertCircle className="mr-1 h-3 w-3" />
          Abandoned
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
          <Clock className="mr-1 h-3 w-3" />
          In Progress
        </Badge>
      )
  }
}

interface SessionHistoryListProps {
  sessions: RecallSessionHistoryItem[]
}

export function SessionHistoryList({ sessions }: SessionHistoryListProps) {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
        <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/50" />
        <p className="text-lg font-medium text-muted-foreground">No practice sessions yet</p>
        <p className="mt-1 text-sm text-muted-foreground/70">
          Start your first session to see your history here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => {
        const accuracy = session.accuracy != null ? Math.round(session.accuracy * 100) : null
        const isCompleted = session.status === 'COMPLETED'
        const href = isCompleted
          ? `/recall/summary/${session.id}`
          : undefined

        const content = (
          <div className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  {session.extraction?.title ?? 'Untitled Source'}
                </span>
                <StatusBadge status={session.status} />
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{formatDate(session.startedAt)}</span>
                <span>{session.totalQuestions} questions</span>
                {session.durationSeconds != null && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(session.durationSeconds)}
                  </span>
                )}
              </div>
            </div>
            {isCompleted && (
              <div className="flex items-center gap-4 text-right">
                <div>
                  <div className="flex items-center gap-1 text-sm font-semibold">
                    {session.correctCount != null ? (
                      <>
                        <span className="text-emerald-600">{session.correctCount}</span>
                        <span className="text-muted-foreground">/</span>
                        <span>{session.totalQuestions}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">correct</span>
                </div>
                {accuracy != null && (
                  <div>
                    <div className={`text-sm font-semibold ${accuracy >= 70 ? 'text-emerald-600' : accuracy >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                      {accuracy}%
                    </div>
                    <span className="text-xs text-muted-foreground">accuracy</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )

        if (href) {
          return (
            <Link key={session.id} href={href}>
              {content}
            </Link>
          )
        }

        return <div key={session.id}>{content}</div>
      })}
    </div>
  )
}
