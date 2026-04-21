'use client'

import { useCallback, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Upload, FileText, X, Play, Info, Cloud, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'
import { captureDocument, saveLocalResults } from '@/lib/api/capture'
import { useCaptureStore } from '@/lib/stores/capture-store'
import { runPipeline } from '@/lib/ollama/extraction-pipeline'
import { OllamaClient } from '@/lib/ollama/ollama-client'
import { createByokClient } from '@/lib/llm/provider-factory'
import { PROVIDER_DEFAULTS } from '@/lib/llm/provider-defaults'
import { extractTextFromFile } from '@/lib/extraction/document-extractor'
import { LocalExtractionProgress } from '@/components/capture/local-extraction-progress'

const ACCEPTED_TYPES = ['.pdf', '.docx', '.doc', '.txt']
const MAX_SIZE_MB = 25

export function DocumentSource() {
  const { data: session } = useSession()
  const selectedFile = useCaptureStore((s) => s.selectedFile)
  const setSelectedFile = useCaptureStore((s) => s.setSelectedFile)
  const setExtractionId = useCaptureStore((s) => s.setExtractionId)
  const [submitting, setSubmitting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const processingMode = useCaptureStore((s) => s.processingMode)
  const localConfig = useCaptureStore((s) => s.localConfig)
  const localProgress = useCaptureStore((s) => s.localProgress)
  const setLocalProgress = useCaptureStore((s) => s.setLocalProgress)
  const localError = useCaptureStore((s) => s.localError)
  const setLocalError = useCaptureStore((s) => s.setLocalError)
  const byokProvider = useCaptureStore((s) => s.byokProvider)
  const byokApiKey = useCaptureStore((s) => s.byokApiKey)
  const byokFastModel = useCaptureStore((s) => s.byokFastModel)
  const byokSmartModel = useCaptureStore((s) => s.byokSmartModel)
  const selectedRoadmapId = useCaptureStore((s) => s.selectedRoadmapId)

  const handleFile = useCallback(
    (file: File) => {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) return
      setSelectedFile(file)
    },
    [setSelectedFile]
  )

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  async function handleCloudSubmit() {
    if (!selectedFile || !session?.accessToken) return
    const headers = { Authorization: `Bearer ${session.accessToken}` }
    const { extractionId } = await captureDocument(
      headers,
      selectedFile,
      selectedRoadmapId || undefined,
    )
    setExtractionId(extractionId)
  }

  async function handleLocalSubmit() {
    if (!selectedFile || !session?.accessToken) return
    if (!localConfig.pass1Model || !localConfig.pass2Model) {
      setLocalError('Select models in Settings > AI Processing first')
      return
    }

    const abort = new AbortController()
    abortRef.current = abort

    // Step 1: Extract text from document client-side
    setLocalProgress({ phase: 'document-extract', current: 0, total: 1 })
    const text = await extractTextFromFile(selectedFile)
    if (!text || text.trim().length === 0) {
      throw new Error('Could not extract text from document')
    }
    setLocalProgress({ phase: 'document-extract', current: 1, total: 1 })

    // Step 2-3: Run extraction pipeline locally
    const client = new OllamaClient(localConfig.baseUrl)
    const result = await runPipeline(
      {
        transcript: text,
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

    const title = selectedFile.name.replace(/\.[^.]+$/, '')
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
      videoUrl: `file://${selectedFile.name}`,
      title,
      concepts,
      questions,
      sourceType: 'DOCUMENT',
    })

    setLocalProgress({ phase: 'saving', current: 1, total: 1, detail: `Saved — ${concepts.length} concepts, ${questions.length} questions` })
  }

  async function handleByokSubmit() {
    if (!selectedFile || !session?.accessToken || !byokProvider || !byokApiKey) return

    const defaults = PROVIDER_DEFAULTS[byokProvider]
    const abort = new AbortController()
    abortRef.current = abort

    setLocalProgress({ phase: 'document-extract', current: 0, total: 1 })
    const text = await extractTextFromFile(selectedFile)
    if (!text || text.trim().length === 0) {
      throw new Error('Could not extract text from document')
    }
    setLocalProgress({ phase: 'document-extract', current: 1, total: 1 })

    const client = createByokClient(byokProvider, byokApiKey)
    const result = await runPipeline(
      {
        transcript: text,
        pass1Model: byokFastModel || defaults.fast,
        pass2Model: byokSmartModel || defaults.smart,
        client,
        signal: abort.signal,
      },
      (progress) => setLocalProgress(progress)
    )

    setLocalProgress({ phase: 'saving', current: 0, total: 1 })
    const headers = { Authorization: `Bearer ${session.accessToken}` }

    const title = selectedFile.name.replace(/\.[^.]+$/, '')
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
      videoUrl: `file://${selectedFile.name}`,
      title,
      concepts,
      questions,
      sourceType: 'DOCUMENT',
    })

    setLocalProgress({ phase: 'saving', current: 1, total: 1, detail: `Saved — ${concepts.length} concepts, ${questions.length} questions` })
  }

  async function handleSubmit() {
    if (!selectedFile || submitting || !session?.accessToken) return
    setSubmitting(true)
    setLocalError(null)
    setLocalProgress(null)

    try {
      if (processingMode === 'local') {
        await handleLocalSubmit()
      } else if (processingMode === 'byok') {
        await handleByokSubmit()
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

  const isClientSide = processingMode === 'local' || processingMode === 'byok'

  return (
    <div>
      {!selectedFile ? (
        <label
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            'mb-3.5 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-7 text-center transition-colors',
            dragOver
              ? 'border-[#7C3AED] bg-[#7C3AED]/5'
              : 'border-border hover:border-muted-foreground hover:bg-accent/50'
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5F3FF] text-[#7C3AED]">
            <Upload className="h-5 w-5" />
          </div>
          <div className="text-[13px] font-semibold text-foreground/80">
            Drag & drop or{' '}
            <span className="font-bold text-primary">browse</span>
          </div>
          <div className="text-[11px] text-muted-foreground/60">
            Max {MAX_SIZE_MB}MB
          </div>
          <div className="flex gap-1.5">
            {ACCEPTED_TYPES.map((t) => (
              <span
                key={t}
                className="rounded bg-[#F5F3FF] px-2 py-0.5 text-[9px] font-bold uppercase text-[#7C3AED]"
              >
                {t}
              </span>
            ))}
          </div>
          <input
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleInputChange}
            className="hidden"
          />
        </label>
      ) : (
        <div className="mb-3.5 flex items-center gap-3 rounded-lg border border-border bg-accent/30 px-3.5 py-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F5F3FF] text-[#7C3AED]">
            <FileText className="h-[18px] w-[18px]" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold text-foreground">
              {selectedFile.name}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
            </div>
          </div>
          <button
            onClick={() => setSelectedFile(null)}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {selectedFile && (
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="mb-3.5 flex items-center gap-1.5 rounded-lg bg-[#7C3AED] px-6 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Play className="h-4 w-4" />
          {submitting ? 'Processing...' : 'Start Capture'}
        </button>
      )}

      <div className="flex items-center gap-2 rounded-lg bg-accent/50 px-3 py-2 text-[10px] text-muted-foreground">
        {isClientSide ? (
          <Monitor className="h-3.5 w-3.5 shrink-0 text-green-500" />
        ) : (
          <Cloud className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        )}
        <span>
          {isClientSide ? (
            <>
              Pipeline: Text extraction → Pass 1{' '}
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
            <>Cloud processing — document text extracted on our servers</>
          )}
        </span>
      </div>

      {/* Local processing progress */}
      {isClientSide && (localProgress || localError) && (
        <LocalExtractionProgress onCancel={handleCancel} />
      )}
    </div>
  )
}
