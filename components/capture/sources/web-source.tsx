'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Globe, Play, Info } from 'lucide-react'
import { captureWeb } from '@/lib/api/capture'
import { useCaptureStore } from '@/lib/stores/capture-store'

export function WebSource() {
  const { data: session } = useSession()
  const [url, setUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const setExtractionId = useCaptureStore((s) => s.setExtractionId)

  async function handleSubmit() {
    if (!url.trim() || submitting || !session?.accessToken) return
    setSubmitting(true)
    try {
      const headers = { Authorization: `Bearer ${session.accessToken}` }
      const { extractionId } = await captureWeb(headers, url.trim())
      setExtractionId(extractionId)
    } catch {
      setSubmitting(false)
    }
  }

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
              className="flex-1 bg-transparent py-2.5 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/40"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!url.trim() || submitting}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#2563EB] px-6 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            {submitting ? 'Starting...' : 'Start Capture'}
          </button>
        </div>
      </div>

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
        <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        <span>
          Pipeline: Readability extraction →{' '}
          <code className="rounded bg-card px-1.5 py-0.5 font-mono text-[9px] text-primary">
            llama3.2:3b
          </code>{' '}
          →{' '}
          <code className="rounded bg-card px-1.5 py-0.5 font-mono text-[9px] text-primary">
            gemma2:9b
          </code>
        </span>
      </div>
    </div>
  )
}
