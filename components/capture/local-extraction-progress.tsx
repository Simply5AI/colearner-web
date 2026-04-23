'use client'

import { Brain, CheckCircle2, FileSearch, Loader2, Save, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCaptureStore } from '@/lib/stores/capture-store'

const PHASE_LABELS: Record<string, string> = {
  transcript: 'Fetching transcript',
  'article-fetch': 'Reading article',
  'document-extract': 'Reading document',
  chunking: 'Splitting source into sections',
  pass1: 'Finding concepts',
  ranking: 'Ranking concepts',
  pass2: 'Preparing recall material',
  saving: 'Saving learning set',
}

const phaseOrder = [
  ['transcript', 'article-fetch', 'document-extract'],
  ['chunking'],
  ['pass1', 'ranking', 'pass2'],
  ['saving'],
]

const steps = [
  {
    title: 'Reading source',
    description: 'Getting usable text from your material.',
    icon: FileSearch,
  },
  {
    title: 'Organizing',
    description: 'Breaking long content into learnable sections.',
    icon: FileSearch,
  },
  {
    title: 'Finding concepts',
    description: 'Choosing the key ideas worth practicing.',
    icon: Brain,
  },
  {
    title: 'Saving',
    description: 'Adding this learning set to your library.',
    icon: Save,
  },
]

function getStepIndex(phase: string) {
  const index = phaseOrder.findIndex((group) => group.includes(phase))
  return index >= 0 ? index : 0
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
      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
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
  const activeStep = getStepIndex(phase)

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-border bg-accent/30 p-4">
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
            onClick={() => {
              setLocalProgress(null)
              setLocalError(null)
            }}
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

      <div className="grid gap-2 md:grid-cols-4">
        {steps.map((step, index) => {
          const done = index < activeStep || isComplete
          const active = index === activeStep && !isComplete
          const Icon = step.icon

          return (
            <div
              key={step.title}
              className={cn(
                'rounded-lg border px-3 py-2',
                done && 'border-green-500/30 bg-green-500/5',
                active && 'border-primary/40 bg-primary/5',
                !done && !active && 'border-border/70 bg-background/40'
              )}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <div
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-md',
                    done && 'bg-green-500/10 text-green-600',
                    active && 'bg-primary/10 text-primary',
                    !done && !active && 'bg-accent text-muted-foreground'
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : active ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                </div>
                <p className="text-[11px] font-bold text-foreground">{step.title}</p>
              </div>
              <p className="text-[10px] leading-snug text-muted-foreground">
                {step.description}
              </p>
            </div>
          )
        })}
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
            {current}/{total} - {percentage}%
          </p>
        </div>
      )}

      {detail && (
        <p className="truncate text-[10px] text-muted-foreground/70">{detail}</p>
      )}
    </div>
  )
}
