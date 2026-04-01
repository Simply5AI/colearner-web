'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Loader2, CheckCircle2, XCircle, Play, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useCaptureStore } from '@/lib/stores/capture-store'
import { useInvalidateCaptureStats } from '@/lib/hooks/use-capture'
import { getExtractionStatus } from '@/lib/api/capture'
import { cn } from '@/lib/utils'
import type { ExtractionProgress as ExtractionProgressType } from '@/lib/types'

const TERMINAL = ['COMPLETED', 'FAILED']
const POLL_MS = 3000

export function ExtractionProgress() {
  const router = useRouter()
  const { data: session } = useSession()
  const extractionId = useCaptureStore((s) => s.extractionId)
  const setExtractionId = useCaptureStore((s) => s.setExtractionId)
  const invalidateStats = useInvalidateCaptureStats()
  const [progress, setProgress] = useState<ExtractionProgressType | null>(null)
  const [hasNotified, setHasNotified] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Poll extraction status
  useEffect(() => {
    if (!extractionId || !session?.accessToken) return

    let cancelled = false
    const headers = { Authorization: `Bearer ${session.accessToken}` }

    async function poll() {
      try {
        const data = await getExtractionStatus(headers, extractionId!)
        if (cancelled) return
        setProgress(data)

        if (TERMINAL.includes(data.status)) return // stop polling
      } catch {
        if (cancelled) return
        // Continue polling on transient errors
      }

      if (!cancelled) {
        setTimeout(poll, POLL_MS)
      }
    }

    poll()
    return () => { cancelled = true }
  }, [extractionId, session?.accessToken])

  // Scroll into view when progress first appears
  useEffect(() => {
    if (progress && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [!!progress])

  // Toast + stats refresh on completion
  useEffect(() => {
    if (!progress || hasNotified) return

    if (progress.status === 'COMPLETED') {
      toast.success('Extraction complete!', {
        description: `${progress.conceptCount} concepts, ${progress.questionCount} questions ready for recall.`,
      })
      invalidateStats()
      setHasNotified(true)
    } else if (progress.status === 'FAILED') {
      toast.error('Extraction failed', {
        description: progress.errorMessage || 'An unexpected error occurred.',
      })
      setHasNotified(true)
    }
  }, [progress?.status])

  if (!extractionId || !progress) return null

  const status = progress.status
  const isComplete = status === 'COMPLETED'
  const isFailed = status === 'FAILED'
  const isPass1Done = status === 'COMPLETED_PASS1' || isComplete
  const isProcessing = status === 'PROCESSING' || status === 'COMPLETED_PASS1'

  // Determine progress percentage for the bar
  let progressPct = 0
  let statusLabel = ''
  let StatusIcon = Clock

  if (status === 'PENDING') {
    progressPct = 0
    statusLabel = 'Queued — waiting to start...'
    StatusIcon = Clock
  } else if (status === 'PROCESSING') {
    progressPct = 25
    statusLabel = 'Extracting concepts...'
    StatusIcon = Loader2
  } else if (status === 'COMPLETED_PASS1') {
    progressPct = 60
    statusLabel = `${progress.conceptCount} concepts found — generating questions...`
    StatusIcon = Loader2
  } else if (isComplete) {
    progressPct = 100
    statusLabel = `Done! ${progress.conceptCount} concepts, ${progress.questionCount} questions`
    StatusIcon = CheckCircle2
  } else if (isFailed) {
    progressPct = 100
    statusLabel = 'Extraction failed'
    StatusIcon = XCircle
  }

  function handleDismiss() {
    setExtractionId(null)
    setProgress(null)
    setHasNotified(false)
  }

  return (
    <div ref={containerRef} className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <StatusIcon
            className={cn(
              'h-4 w-4',
              isComplete && 'text-green-600',
              isFailed && 'text-destructive',
              isProcessing && 'animate-spin text-primary',
              status === 'PENDING' && 'text-muted-foreground'
            )}
          />
          <span className="text-[13px] font-bold text-foreground">
            {progress.title || 'Extraction Progress'}
          </span>
        </div>
        <span
          className={cn(
            'text-[11px] font-semibold',
            isComplete && 'text-green-600',
            isFailed && 'text-destructive',
            isProcessing && 'text-primary',
            status === 'PENDING' && 'text-muted-foreground'
          )}
        >
          {statusLabel}
        </span>
      </div>

      {/* Progress bar */}
      <div className="px-5 py-4 space-y-4">
        <div>
          <div className="mb-2 flex justify-between text-[11px]">
            <span className="font-semibold text-foreground">
              {isPass1Done ? 'Concept Extraction' : 'Processing'}
            </span>
            <span className="font-mono text-muted-foreground">
              {isComplete
                ? `${progress.conceptCount} concepts ✓`
                : isPass1Done
                  ? `${progress.conceptCount} concepts`
                  : status === 'PENDING'
                    ? 'Waiting...'
                    : 'Analyzing...'}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700 ease-out',
                isFailed ? 'bg-destructive' : 'bg-green-600',
                status === 'PENDING' && 'animate-pulse bg-muted-foreground/30',
                isProcessing && 'relative overflow-hidden'
              )}
              style={{ width: `${progressPct}%` }}
            >
              {isProcessing && (
                <div className="absolute inset-0 animate-pulse bg-white/20" />
              )}
            </div>
          </div>
        </div>

        {/* Question generation progress */}
        {isPass1Done && (
          <div>
            <div className="mb-2 flex justify-between text-[11px]">
              <span className="font-semibold text-foreground">
                Question Generation
              </span>
              <span className="font-mono text-muted-foreground">
                {isComplete
                  ? `${progress.questionCount} questions ✓`
                  : 'Generating...'}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-border">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700 ease-out',
                  isComplete ? 'bg-blue-600' : 'bg-blue-400'
                )}
                style={{ width: isComplete ? '100%' : '40%' }}
              >
                {!isComplete && (
                  <div className="absolute inset-0 animate-pulse bg-white/20" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {isFailed && progress.errorMessage && (
          <div className="rounded-lg bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
            {progress.errorMessage}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {(isComplete || isFailed) && (
        <div className="flex items-center justify-between border-t border-border/50 px-5 py-3.5">
          <button
            onClick={handleDismiss}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Dismiss
          </button>
          {isComplete && (
            <button
              onClick={() => router.push(`/recall/start/${extractionId}`)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-primary/90"
            >
              <Play className="h-3.5 w-3.5" />
              Start Recall
            </button>
          )}
          {isFailed && (
            <button
              onClick={handleDismiss}
              className="rounded-lg bg-muted px-5 py-2 text-xs font-bold text-foreground transition-colors hover:bg-muted/80"
            >
              Try Again
            </button>
          )}
        </div>
      )}
    </div>
  )
}
