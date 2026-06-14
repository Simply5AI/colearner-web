'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Clock } from 'lucide-react'
import { RecallSession } from '@/components/recall/recall-session'
import { getRecallSessionState } from '@/lib/api/recall'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { RecallMode } from '@/lib/types'

interface EnrolledRecallSessionProps {
  sessionId: string
  clonedPlanId: string
  authHeaders: Record<string, string>
  mode: RecallMode
  timeLimitSec?: number
}

function formatRemaining(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function EnrolledRecallSession({
  sessionId,
  clonedPlanId,
  authHeaders,
  mode,
  timeLimitSec,
}: EnrolledRecallSessionProps) {
  const [remainingSec, setRemainingSec] = useState<number | null>(null)
  const isExam = mode === 'EXAM'

  useEffect(() => {
    if (!isExam) return

    let cancelled = false

    async function poll() {
      try {
        const state = await getRecallSessionState(authHeaders, sessionId)
        if (!cancelled) {
          setRemainingSec(state.remainingSec)
        }
      } catch {
        // keep last known value
      }
    }

    poll()
    const interval = setInterval(poll, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [authHeaders, isExam, sessionId])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/learn/enrolled/${clonedPlanId}`}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), '-ml-2')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to plan
        </Link>

        {isExam && remainingSec !== null && (
          <div
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium',
              remainingSec <= 60 ? 'border-destructive text-destructive' : 'text-foreground',
            )}
          >
            <Clock className="h-4 w-4" />
            {remainingSec > 0 ? formatRemaining(remainingSec) : 'Time expired'}
            {timeLimitSec ? (
              <span className="text-xs text-muted-foreground">
                / {formatRemaining(timeLimitSec)}
              </span>
            ) : null}
          </div>
        )}
      </div>

      <RecallSession
        sessionId={sessionId}
        authHeaders={authHeaders}
        mode={mode}
        disableSkip={isExam}
        summaryPath={`/learn/enrolled/${clonedPlanId}/recall/${sessionId}/summary`}
        backPath={`/learn/enrolled/${clonedPlanId}`}
      />
    </div>
  )
}