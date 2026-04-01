'use client'

import { useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Globe, Play, Info, Cloud, Monitor } from 'lucide-react'
import { captureWeb, saveLocalResults } from '@/lib/api/capture'
import { useCaptureStore } from '@/lib/stores/capture-store'
import { runPipeline } from '@/lib/ollama/extraction-pipeline'
import { LocalExtractionProgress } from '@/components/capture/local-extraction-progress'
import { CaptureTopicChips } from '@/components/capture/capture-topic-chips'

export function WebSource() {
  const { data: session } = useSession()
  const [url, setUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const setExtractionId = useCaptureStore((s) => s.setExtractionId)
  const processingMode = useCaptureStore((s) => s.processingMode)
  const localConfig = useCaptureStore((s) => s.localConfig)
  const localProgress = useCaptureStore((s) => s.localProgress)
  const setLocalProgress = useCaptureStore((s) => s.setLocalProgress)
  const localError = useCaptureStore((s) => s.localError)
  const setLocalError = useCaptureStore((s) => s.setLocalError)
  const selectedTopicIds = useCaptureStore((s) => s.selectedTopicIds)

  async function handleCloudSubmit() {
    if (!session?.accessToken) return
    const headers = { Authorization: `Bearer ${session.accessToken}` }
    const { extractionId } = await captureWeb(
      headers,
      url.trim(),
      selectedTopicIds.length > 0 ? selectedTopicIds : undefined,
    )
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

    // Step 1: Fetch article text via server proxy
    setLocalProgress({ phase: 'article-fetch', current: 0, total: 1 })
    const articleRes = await fetch('/api/article-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim() }),
      signal: abort.signal,
    })

    if (!articleRes.ok) {
      const err = await articleRes.json().catch(() => ({ error: 'Failed to fetch article' }))
      throw new Error(err.error || 'Failed to fetch article')
    }

    const { text, title } = (await articleRes.json()) as { text: string; title: string }
    setLocalProgress({ phase: 'article-fetch', current: 1, total: 1 })

    // Step 2-3: Run extraction pipeline locally
    const result = await runPipeline(
      {
        transcript: text,
        pass1Model: localConfig.pass1Model,
        pass2Model: localConfig.pass2Model,
        ollamaBaseUrl: localConfig.baseUrl,
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
      title: title || url.trim(),
      topicIds: selectedTopicIds.length > 0 ? selectedTopicIds : undefined,
      concepts,
      questions,
      sourceType: 'WEB',
    })

    setLocalProgress({ phase: 'saving', current: 1, total: 1, detail: `Saved — ${concepts.length} concepts, ${questions.length} questions` })
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

  const isLocal = processingMode === 'local'

  return (
    <div>
      <div className="mb-3.5">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Article URL
        </div>
        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-accent/30 px-3 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
            <Globe className="h-4 w-4 shrink-0 text-muted-foreground/50" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              disabled={submitting}
              className="flex-1 bg-transparent py-2.5 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/40"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!url.trim() || submitting}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#2563EB] px-6 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            {submitting ? 'Processing...' : 'Start Capture'}
          </button>
        </div>
      </div>

      <CaptureTopicChips />

      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0" />
        <span>
          Tip: Install the{' '}
          <span className="font-semibold text-primary">
            CoLearner Chrome Extension
          </span>{' '}
          for automatic dwell-based capture while you browse.
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-lg bg-accent/50 px-3 py-2 text-[10px] text-muted-foreground">
        {isLocal ? (
          <Monitor className="h-3.5 w-3.5 shrink-0 text-green-500" />
        ) : (
          <Cloud className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        )}
        <span>
          {isLocal ? (
            <>
              Pipeline: Readability extraction → Pass 1{' '}
              <code className="rounded bg-card px-1.5 py-0.5 font-mono text-[9px] text-primary">
                {localConfig.pass1Model || 'not set'}
              </code>{' '}
              → Pass 2{' '}
              <code className="rounded bg-card px-1.5 py-0.5 font-mono text-[9px] text-primary">
                {localConfig.pass2Model || 'not set'}
              </code>
              <span className="ml-2 text-green-600 font-medium">Local</span>
            </>
          ) : (
            <>Cloud processing — article content extracted on our servers</>
          )}
        </span>
      </div>

      {/* Local processing progress */}
      {isLocal && (localProgress || localError) && (
        <LocalExtractionProgress onCancel={handleCancel} />
      )}
    </div>
  )
}
