'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export function QuickCaptureCard() {
  const [url, setUrl] = useState('')
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    router.push(`/capture?url=${encodeURIComponent(url.trim())}`)
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border/50 px-[18px] py-3.5">
        <div className="text-[13px] font-bold text-foreground">
          📥 Quick Capture
        </div>
        <Link
          href="/capture"
          className="text-[11px] font-semibold text-primary hover:underline"
        >
          All sources →
        </Link>
      </div>

      <div className="p-[18px]">
        <div className="rounded-xl border-2 border-dashed border-border p-7 text-center transition-colors hover:border-primary hover:bg-primary/[0.02]">
          <div className="mb-2.5 text-4xl">🎬</div>
          <div className="mb-1 text-sm font-bold text-foreground">
            Paste a YouTube URL to capture
          </div>
          <div className="mb-4 text-[11px] text-muted-foreground">
            We&apos;ll extract key concepts and generate recall questions
            automatically
          </div>
          <form
            onSubmit={handleSubmit}
            className="mx-auto flex max-w-[400px] gap-2"
          >
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="flex-1 rounded-lg border-[1.5px] border-border bg-card px-3.5 py-2.5 text-xs outline-none transition-colors focus:border-primary"
            />
            <button
              type="submit"
              disabled={!url.trim()}
              className="shrink-0 rounded-lg bg-primary px-[18px] py-2.5 text-xs font-bold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Extract →
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
