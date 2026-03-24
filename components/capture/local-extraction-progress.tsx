'use client'

import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { useCaptureStore } from '@/lib/stores/capture-store'

const PHASE_LABELS: Record<string, string> = {
  transcript: 'Fetching transcript',
  'article-fetch': 'Extracting article text',
  'document-extract': 'Extracting document text',
  chunking: 'Chunking text',
  pass1: 'Extracting concepts',
  ranking: 'Ranking concepts by importance',
  pass2: 'Generating questions',
  saving: 'Saving results',
}

interface LocalExtractionProgressProps {
  onCancel: () => void
}

export function LocalExtractionProgress({ onCancel }: LocalExtractionProgressProps) {
  const localProgress = useCaptureStore((s) => s.localProgress)
  const localError = useCaptureStore((s) => s.localError)
  const setLocalProgress = useCaptureStore((s) => s.setLocalProgress)
  const setLocalError = useCaptureStore((s) => s.setLocalError)

  if (localError) {
    return (
      <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
        <div className="flex items-start gap-2">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <div>
            <p className="text-xs font-semibold text-red-700 dark:text-red-400">
              Processing failed
            </p>
            <p className="mt-1 text-[11px] text-red-600 dark:text-red-400/80">
              {localError}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!localProgress) return null

  const { phase, current, total, detail } = localProgress
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0
  const isComplete = phase === 'saving' && current === total

  return (
    <div className="mt-4 rounded-lg border border-border bg-accent/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isComplete ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          )}
          <span className="text-xs font-semibold">
            {PHASE_LABELS[phase] || phase}
          </span>
        </div>
        {isComplete ? (
          <button
            onClick={() => { setLocalProgress(null); setLocalError(null) }}
            className="rounded-md bg-primary px-3 py-1 text-[10px] font-bold text-white hover:bg-primary/90"
          >
            Done
          </button>
        ) : (
          <button
            onClick={onCancel}
            className="text-[10px] font-medium text-muted-foreground hover:text-destructive"
          >
            Cancel
          </button>
        )}
      </div>

      {total > 1 && (
        <div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {current}/{total} — {percentage}%
          </p>
        </div>
      )}

      {detail && (
        <p className="text-[10px] text-muted-foreground/70 truncate">{detail}</p>
      )}
    </div>
  )
}
