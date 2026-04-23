'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Brain,
  CheckCircle2,
  Clock,
  FileSearch,
  Loader2,
  Play,
  Sparkles,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useCaptureStore } from '@/lib/stores/capture-store'
import { useInvalidateCaptureStats } from '@/lib/hooks/use-capture'
import { getExtractionStatus } from '@/lib/api/capture'
import { cn } from '@/lib/utils'
import type { ExtractionProgress as ExtractionProgressType } from '@/lib/types'

const TERMINAL = ['COMPLETED', 'FAILED']
const POLL_MS = 3000

const timelineSteps = [
  {
    key: 'queued',
    title: 'Queued',
    description: 'Your learning set is waiting to start.',
    icon: Clock,
  },
  {
    key: 'read',
    title: 'Reading source',
    description: 'We are extracting text, transcript, or audio.',
    icon: FileSearch,
  },
  {
    key: 'concepts',
    title: 'Finding concepts',
    description: 'Key ideas are being selected for study.',
    icon: Brain,
  },
  {
    key: 'ready',
    title: 'Ready to practice',
    description: 'Concepts are saved; recall can begin.',
    icon: Sparkles,
  },
] as const

function getTimelineIndex(status: string) {
  if (status === 'PENDING') return 0
  if (status === 'PROCESSING') return 1
  if (status === 'COMPLETED_PASS1') return 2
  if (status === 'COMPLETED') return 3
  if (status === 'FAILED') return -1
  return 0
}

function getMetadataString(progress: ExtractionProgressType, key: string) {
  const value = progress.metadata?.[key]
  return typeof value === 'string' ? value : null
}

function getMetadataNumber(progress: ExtractionProgressType, key: string) {
  const value = progress.metadata?.[key]
  return typeof value === 'number' ? value : null
}

function getTimelineIndexFromProgress(progress: ExtractionProgressType) {
  const stage = getMetadataString(progress, 'progressStage')
  if (stage === 'ready') return 3
  if (stage === 'saving_concepts' || stage === 'ranking_concepts') return 2
  if (stage === 'extracting_concepts' || stage === 'summarizing') return 2
  if (stage === 'organizing_source' || stage === 'reading_source') return 1
  return getTimelineIndex(progress.status)
}

function getStatusCopy(progress: ExtractionProgressType) {
  const metadataLabel = getMetadataString(progress, 'progressLabel')
  const metadataPercent = getMetadataNumber(progress, 'progressPercent')

  switch (progress.status) {
    case 'PENDING':
      return { label: metadataLabel ?? 'Queued - waiting to start...', percent: metadataPercent ?? 8, icon: Clock }
    case 'PROCESSING':
      return { label: metadataLabel ?? 'Reading source and finding concepts...', percent: metadataPercent ?? 45, icon: Loader2 }
    case 'COMPLETED_PASS1':
      return {
        label: metadataLabel ?? `${progress.conceptCount} concepts found - finalizing your learning set...`,
        percent: metadataPercent ?? 75,
        icon: Loader2,
      }
    case 'COMPLETED':
      return {
        label: `Ready! ${progress.conceptCount} concepts saved`,
        percent: 100,
        icon: CheckCircle2,
      }
    case 'FAILED':
      return { label: 'Extraction failed', percent: 100, icon: XCircle }
    default:
      return { label: 'Working on your learning set...', percent: 25, icon: Loader2 }
  }
}

export function ExtractionProgress() {
  const router = useRouter()
  const { data: session } = useSession()
  const extractionId = useCaptureStore((s) => s.extractionId)
  const setExtractionId = useCaptureStore((s) => s.setExtractionId)
  const invalidateStats = useInvalidateCaptureStats()
  const [progress, setProgress] = useState<ExtractionProgressType | null>(null)
  const [hasNotified, setHasNotified] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressVisible = Boolean(progress)

  useEffect(() => {
    if (!extractionId || !session?.accessToken) return

    let cancelled = false
    const headers = { Authorization: `Bearer ${session.accessToken}` }

    async function poll() {
      try {
        const data = await getExtractionStatus(headers, extractionId!)
        if (cancelled) return
        setProgress(data)

        if (TERMINAL.includes(data.status)) return
      } catch {
        if (cancelled) return
      }

      if (!cancelled) {
        setTimeout(poll, POLL_MS)
      }
    }

    poll()
    return () => {
      cancelled = true
    }
  }, [extractionId, session?.accessToken])

  useEffect(() => {
    if (progressVisible && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [progressVisible])

  useEffect(() => {
    if (!progress || hasNotified) return

    if (progress.status === 'COMPLETED') {
      toast.success('Learning set ready', {
        description: `${progress.conceptCount} concepts are ready for recall practice.`,
      })
      invalidateStats()
      setHasNotified(true)
    } else if (progress.status === 'FAILED') {
      toast.error('Capture failed', {
        description: progress.errorMessage || 'An unexpected error occurred.',
      })
      setHasNotified(true)
    }
  }, [progress, hasNotified, invalidateStats])

  if (!extractionId || !progress) return null

  const status = progress.status
  const isComplete = status === 'COMPLETED'
  const isFailed = status === 'FAILED'
  const isProcessing = status === 'PROCESSING' || status === 'COMPLETED_PASS1'
  const activeStep = getTimelineIndexFromProgress(progress)
  const statusCopy = getStatusCopy(progress)
  const StatusIcon = statusCopy.icon

  function handleDismiss() {
    setExtractionId(null)
    setProgress(null)
    setHasNotified(false)
  }

  return (
    <div ref={containerRef} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-2 border-b border-border/50 px-5 py-3.5 md:flex-row md:items-center md:justify-between">
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
            {progress.title || 'Building learning set'}
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
          {statusCopy.label}
        </span>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="grid gap-2 md:grid-cols-4">
          {timelineSteps.map((step, index) => {
            const done = !isFailed && activeStep > index
            const active = !isFailed && activeStep === index
            const failedHere = isFailed && index === 1
            const Icon = step.icon

            return (
              <div
                key={step.key}
                className={cn(
                  'rounded-xl border px-3 py-3 transition-colors',
                  done && 'border-green-500/30 bg-green-500/5',
                  active && 'border-primary/40 bg-primary/5',
                  !done && !active && !failedHere && 'border-border/70 bg-background/40',
                  failedHere && 'border-destructive/40 bg-destructive/5'
                )}
              >
                <div className="mb-2 flex items-center gap-2">
                  <div
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-lg',
                      done && 'bg-green-500/10 text-green-600',
                      active && 'bg-primary/10 text-primary',
                      !done && !active && !failedHere && 'bg-accent text-muted-foreground',
                      failedHere && 'bg-destructive/10 text-destructive'
                    )}
                  >
                    {done ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : active && isProcessing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : failedHere ? (
                      <XCircle className="h-3.5 w-3.5" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <p className="text-xs font-bold text-foreground">{step.title}</p>
                </div>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  {step.description}
                </p>
              </div>
            )
          })}
        </div>

        <div>
          <div className="mb-2 flex justify-between text-[11px]">
            <span className="font-semibold text-foreground">Learning set progress</span>
            <span className="font-mono text-muted-foreground">
              {isComplete
                ? `${progress.conceptCount} concepts saved`
                : status === 'PENDING'
                  ? 'Waiting...'
                  : isFailed
                    ? 'Stopped'
                    : 'Working...'}
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
              style={{ width: `${statusCopy.percent}%` }}
            >
              {isProcessing && <div className="absolute inset-0 animate-pulse bg-white/20" />}
            </div>
          </div>
        </div>

        {isComplete && (
          <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2.5 text-xs text-green-700">
            Recall questions will be generated for the difficulty and question style you choose when practice starts.
          </div>
        )}

        {isFailed && progress.errorMessage && (
          <div className="rounded-lg bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
            {progress.errorMessage}
          </div>
        )}
      </div>

      {(isComplete || isFailed) && (
        <div className="flex items-center justify-between border-t border-border/50 px-5 py-3.5">
          <button
            onClick={handleDismiss}
            className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Dismiss
          </button>
          {isComplete && (
            <button
              onClick={() => router.push(`/recall/start/${extractionId}`)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-primary/90"
            >
              <Play className="h-3.5 w-3.5" />
              Start practice
            </button>
          )}
          {isFailed && (
            <button
              onClick={handleDismiss}
              className="rounded-lg bg-muted px-5 py-2 text-xs font-bold text-foreground transition-colors hover:bg-muted/80"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  )
}
