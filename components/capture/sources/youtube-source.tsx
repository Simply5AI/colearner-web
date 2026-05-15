'use client'

import { useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Link2, Play, Check, Cloud, Monitor } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { captureYouTube, saveLocalResults } from '@/lib/api/capture'
import { useCaptureStore } from '@/lib/stores/capture-store'
import { runPipeline } from '@/lib/ollama/extraction-pipeline'
import { OllamaClient } from '@/lib/ollama/ollama-client'
import { LocalExtractionProgress } from '@/components/capture/local-extraction-progress'

export function YouTubeSource() {
  const { data: session } = useSession()
  const [url, setUrl] = useState('')
  const [autoTranscript, setAutoTranscript] = useState(true)
  const [allTypes, setAllTypes] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const setExtractionId = useCaptureStore((s) => s.setExtractionId)
  const processingMode = useCaptureStore((s) => s.processingMode)
  const localConfig = useCaptureStore((s) => s.localConfig)
  const localProgress = useCaptureStore((s) => s.localProgress)
  const setLocalProgress = useCaptureStore((s) => s.setLocalProgress)
  const localError = useCaptureStore((s) => s.localError)
  const setLocalError = useCaptureStore((s) => s.setLocalError)
  const selectedRoadmapId = useCaptureStore((s) => s.selectedRoadmapId)

  async function handleCloudSubmit() {
    if (!session?.accessToken) return
    const headers = { Authorization: `Bearer ${session.accessToken}` }
    const { extractionId, deduped } = await captureYouTube(
      headers,
      url.trim(),
      {
        autoTranscript,
        questionTypes: allTypes ? ['open', 'mcq', 'cloze'] : ['open'],
      },
      undefined,
      selectedRoadmapId || undefined,
    )
    if (deduped) {
      toast.info('You already have an active capture for this source — opening the existing one.')
    }
    setExtractionId(extractionId)
  }

  async function handleLocalSubmit() {
    if (!session?.accessToken) return
    if (!localConfig.pass1Model || !localConfig.pass2Model) {
      setLocalError('Select models in Settings > AI Processing first')
      return
    }

    const abort = new AbortController()
    abortRef.current = abort

    // Step 1: Fetch transcript via server proxy
    setLocalProgress({ phase: 'transcript', current: 0, total: 1 })
    const transcriptRes = await fetch('/api/transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim() }),
      signal: abort.signal,
    })

    if (!transcriptRes.ok) {
      const err = await transcriptRes.json().catch(() => ({ error: 'Failed to fetch transcript' }))
      throw new Error(err.error || 'Failed to fetch transcript')
    }

    const { transcript } = (await transcriptRes.json()) as { transcript: string }
    setLocalProgress({ phase: 'transcript', current: 1, total: 1 })

    // Step 2-3: Run extraction pipeline locally
    const client = new OllamaClient(localConfig.baseUrl)
    const result = await runPipeline(
      {
        transcript,
        pass1Model: localConfig.pass1Model,
        pass2Model: localConfig.pass2Model,
        client,
        signal: abort.signal,
      },
      (progress) => setLocalProgress(progress)
    )

    // Step 4: Save results to API
    setLocalProgress({ phase: 'saving', current: 0, total: 1 })
    const headers = { Authorization: `Bearer ${session.accessToken}` }

    const concepts = result.concepts.map((c, i) => ({
      title: c.title,
      description: c.description,
      order: i,
    }))

    const questions = result.questions.flatMap((qg) =>
      qg.questions.map((q) => ({
        conceptIndex: qg.conceptIndex,
        type: q.type,
        text: q.text,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      }))
    )

    await saveLocalResults(headers, {
      videoUrl: url.trim(),
      title: url.trim(),
      concepts,
      questions,
    })

    setLocalProgress({ phase: 'saving', current: 1, total: 1, detail: `Saved - ${concepts.length} concepts, ${questions.length} questions` })
  }

  async function handleSubmit() {
    if (!url.trim() || submitting || !session?.accessToken) return
    setSubmitting(true)
    setLocalError(null)
    setLocalProgress(null)

    try {
      if (processingMode === 'local') {
        await handleLocalSubmit()
      } else {
        await handleCloudSubmit()
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setLocalError('Processing cancelled')
      } else {
        const message = err instanceof Error ? err.message : 'Processing failed'
        setLocalError(message)
      }
    } finally {
      setSubmitting(false)
      abortRef.current = null
    }
  }

  function handleCancel() {
    abortRef.current?.abort()
    setSubmitting(false)
    setLocalProgress(null)
  }

  const isClientSide = processingMode === 'local'

  return (
    <div>
      <div className="mb-3.5">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          YouTube Video URL
        </div>
        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-accent/30 px-3 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
            <Link2 className="h-4 w-4 shrink-0 text-muted-foreground/50" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              disabled={submitting}
              className="flex-1 bg-transparent py-2.5 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/40"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!url.trim() || submitting}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#DC2626] px-6 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            {submitting ? 'Building set...' : 'Create learning set'}
          </button>
        </div>
      </div>

      <div className="mb-3.5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAutoTranscript(!autoTranscript)}
          className={cn(
            'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors',
            autoTranscript
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-border text-foreground/80 hover:border-muted-foreground'
          )}
        >
          <Check className="h-3.5 w-3.5" />
          Use captions when available
        </button>
        <button
          type="button"
          onClick={() => setAllTypes(!allTypes)}
          className={cn(
            'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors',
            allTypes
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-border text-foreground/80 hover:border-muted-foreground'
          )}
        >
          <Check className="h-3.5 w-3.5" />
          Prepare mixed recall
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-accent/50 px-3 py-2 text-[10px] text-muted-foreground">
        {isClientSide ? (
          <Monitor className="h-3.5 w-3.5 shrink-0 text-green-500" />
        ) : (
          <Cloud className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        )}
        <span>
          {isClientSide ? (
            <>
              Pipeline: Pass 1{' '}
              <code className="rounded bg-card px-1.5 py-0.5 font-mono text-[9px] text-primary">
                {localConfig.pass1Model || 'not set'}
              </code>{' '}
              - Pass 2{' '}
              <code className="rounded bg-card px-1.5 py-0.5 font-mono text-[9px] text-primary">
                {localConfig.pass2Model || 'not set'}
              </code>
              <span className="ml-2 text-green-600 font-medium">Local</span>
            </>
          ) : (
            <>Cloud optimized - transcript, concepts, and summary are prepared on our servers</>
          )}
        </span>
      </div>

      {/* Local processing progress */}
      {isClientSide && (localProgress || localError) && (
        <LocalExtractionProgress onCancel={handleCancel} />
      )}

      {/* Cloud progress is shown at page level via ExtractionProgress */}
    </div>
  )
}
