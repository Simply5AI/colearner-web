'use client'

import { useEffect, useState } from 'react'
import { getExtractionProgressSSE } from '@/lib/api/capture'
import { useCaptureStore } from '@/lib/stores/capture-store'
import type { ExtractionProgress as ExtractionProgressType } from '@/lib/types'

export function ExtractionProgress() {
  const extractionId = useCaptureStore((s) => s.extractionId)
  const setExtractionId = useCaptureStore((s) => s.setExtractionId)
  const [progress, setProgress] = useState<ExtractionProgressType | null>(null)

  useEffect(() => {
    if (!extractionId) return

    const eventSource = getExtractionProgressSSE(
      extractionId,
      (data) => {
        setProgress(data)
        if (data.status === 'completed' || data.status === 'failed') {
          // Keep showing the result
        }
      },
      () => {
        // SSE error
      }
    )

    return () => eventSource.close()
  }, [extractionId])

  if (!extractionId || !progress) return null

  const isComplete = progress.status === 'completed'
  const isFailed = progress.status === 'failed'

  return (
    <div className="space-y-4">
      {/* Progress bars */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border/50 px-[18px] py-3.5">
          <div className="flex items-center gap-2 text-[13px] font-bold text-foreground">
            ⚙️ Extraction Progress
          </div>
          <div className="text-[11px] font-semibold text-primary">
            {isComplete
              ? 'Complete!'
              : isFailed
                ? 'Failed'
                : 'Processing...'}
          </div>
        </div>
        <div className="p-[18px]">
          {/* Pass 1 */}
          <div className="mb-4">
            <div className="mb-1.5 flex justify-between text-[11px]">
              <span className="font-semibold text-foreground">
                Pass 1 — Chunk Extraction
              </span>
              <span className="font-mono text-green-600">
                {progress.pass1CompletedChunks}/{progress.pass1Chunks} chunks
                {progress.pass1Progress >= 100 && ' ✓'}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-green-600 transition-all duration-500"
                style={{ width: `${Math.min(100, progress.pass1Progress)}%` }}
              />
            </div>
          </div>

          {/* Pass 2 */}
          <div>
            <div className="mb-1.5 flex justify-between text-[11px]">
              <span className="font-semibold text-foreground">
                Pass 2 — Question Generation
              </span>
              <span className="font-mono text-muted-foreground">
                {progress.pass2Progress > 0
                  ? `${Math.round(progress.pass2Progress)}%`
                  : 'Waiting...'}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-500"
                style={{ width: `${Math.min(100, progress.pass2Progress)}%` }}
              />
            </div>
          </div>

          {isFailed && progress.error && (
            <div className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {progress.error}
            </div>
          )}
        </div>
      </div>

      {/* Extracted concepts */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border/50 px-[18px] py-3.5">
          <div className="flex items-center gap-2 text-[13px] font-bold text-foreground">
            💡 Extracted Concepts
            {progress.conceptsFound > 0 && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                {progress.conceptsFound} found
                {!isComplete && ' so far'}
              </span>
            )}
          </div>
        </div>
        <div className="p-3.5">
          <div className="grid grid-cols-2 gap-2">
            {progress.concepts.map((concept) => (
              <div
                key={concept.id}
                className="rounded-lg border border-border/50 px-3.5 py-2.5"
              >
                <div className="text-xs font-bold text-foreground">
                  {concept.title}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {concept.type} · chunk {concept.chunkIndex + 1}
                </div>
              </div>
            ))}
            {/* Skeleton placeholders while loading */}
            {!isComplete &&
              !isFailed &&
              Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={`skel-${i}`}
                  className="animate-pulse rounded-lg border border-border/50 px-3.5 py-2.5 opacity-40"
                >
                  <div className="mb-1 h-3 w-3/4 rounded bg-border" />
                  <div className="h-2.5 w-1/2 rounded bg-border" />
                </div>
              ))}
          </div>
        </div>
      </div>

      {isComplete && (
        <div className="flex justify-end">
          <button
            onClick={() => setExtractionId(null)}
            className="rounded-lg bg-primary px-6 py-2.5 text-xs font-bold text-white transition-colors hover:bg-primary/90"
          >
            Done — Back to Sources
          </button>
        </div>
      )}
    </div>
  )
}
