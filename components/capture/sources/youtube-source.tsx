'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Link2, Play, Check, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { captureYouTube } from '@/lib/api/capture'
import { useCaptureStore } from '@/lib/stores/capture-store'

export function YouTubeSource() {
  const { data: session } = useSession()
  const [url, setUrl] = useState('')
  const [autoTranscript, setAutoTranscript] = useState(true)
  const [allTypes, setAllTypes] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const setExtractionId = useCaptureStore((s) => s.setExtractionId)

  async function handleSubmit() {
    if (!url.trim() || submitting || !session?.accessToken) return
    setSubmitting(true)
    try {
      const headers = { Authorization: `Bearer ${session.accessToken}` }
      const { extractionId } = await captureYouTube(headers, url.trim(), {
        autoTranscript,
        questionTypes: allTypes ? ['open', 'mcq', 'cloze'] : ['open'],
      })
      setExtractionId(extractionId)
    } catch {
      setSubmitting(false)
    }
  }

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
              className="flex-1 bg-transparent py-2.5 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/40"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!url.trim() || submitting}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#DC2626] px-6 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            {submitting ? 'Starting...' : 'Start Capture'}
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
          Auto-transcript
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
          Generate all 3 types
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-accent/50 px-3 py-2 text-[10px] text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        <span>
          Pipeline: Pass 1{' '}
          <code className="rounded bg-card px-1.5 py-0.5 font-mono text-[9px] text-primary">
            llama3.2:3b
          </code>{' '}
          → Pass 2{' '}
          <code className="rounded bg-card px-1.5 py-0.5 font-mono text-[9px] text-primary">
            gemma2:9b
          </code>
        </span>
      </div>
    </div>
  )
}
