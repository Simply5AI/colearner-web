'use client'

import { useCallback, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Upload, FileText, X, Play, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { captureDocument } from '@/lib/api/capture'
import { useCaptureStore } from '@/lib/stores/capture-store'

const ACCEPTED_TYPES = ['.pdf', '.docx', '.doc', '.txt']
const MAX_SIZE_MB = 25

export function DocumentSource() {
  const { data: session } = useSession()
  const selectedFile = useCaptureStore((s) => s.selectedFile)
  const setSelectedFile = useCaptureStore((s) => s.setSelectedFile)
  const setExtractionId = useCaptureStore((s) => s.setExtractionId)
  const [submitting, setSubmitting] = useState(false)
  const [dragOver, setDragOver] = useState(false)

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

  async function handleSubmit() {
    if (!selectedFile || submitting || !session?.accessToken) return
    setSubmitting(true)
    try {
      const headers = { Authorization: `Bearer ${session.accessToken}` }
      const { extractionId } = await captureDocument(headers, selectedFile)
      setExtractionId(extractionId)
    } catch {
      setSubmitting(false)
    }
  }

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
        <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        <span>
          Pipeline: Text extraction → chunking →{' '}
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
