'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import { Button, LoadingState } from '@/components/design-system'
import { materialApi } from '@/lib/api/materials'
import { MaterialApiError } from '@/lib/api/material-request'

type Phase = 'loading' | 'ready' | 'unavailable' | 'error'
interface PdfPageProxy { getViewport(o: { scale: number }): { width: number; height: number }; render(o: { canvasContext: CanvasRenderingContext2D; viewport: unknown; canvas?: HTMLCanvasElement }): { promise: Promise<void> } }
interface PdfDocument { numPages: number; getPage(n: number): Promise<PdfPageProxy>; destroy(): Promise<void> | void }

const zoomSteps = [0.75, 1, 1.25, 1.5, 2]

/**
 * Original PDF viewer. The file is fetched as a blob through the learner session (same-origin route, never a token in a URL),
 * drawn with pdf.js one page at a time, and falls back to the browser's own viewer if pdf.js cannot read it.
 */
export function PdfViewer({ materialId, title }: { materialId: string; title: string }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [attempt, setAttempt] = useState(0)
  const [doc, setDoc] = useState<PdfDocument | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [fallback, setFallback] = useState(false)
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(1)
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const abort = new AbortController()
    let url: string | null = null
    let loaded: PdfDocument | null = null
    setPhase('loading'); setDoc(null); setFallback(false); setPage(1)
    void (async () => {
      try {
        const file = await materialApi.original(materialId, abort.signal)
        if (abort.signal.aborted) return
        url = URL.createObjectURL(file.blob.type === 'application/pdf' ? file.blob : new Blob([file.blob], { type: 'application/pdf' }))
        setObjectUrl(url)
        try {
          const pdfjs = await import('pdfjs-dist')
          pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
          loaded = await pdfjs.getDocument({ data: new Uint8Array(await file.blob.arrayBuffer()) }).promise as unknown as PdfDocument
          if (abort.signal.aborted) { void loaded.destroy(); return }
          setDoc(loaded)
        } catch { if (!abort.signal.aborted) setFallback(true) }
        if (!abort.signal.aborted) setPhase('ready')
      } catch (error) {
        if (abort.signal.aborted) return
        setPhase(error instanceof MaterialApiError && error.code === 'ORIGINAL_UNAVAILABLE' ? 'unavailable' : 'error')
      }
    })()
    return () => { abort.abort(); if (url) URL.revokeObjectURL(url); if (loaded) void loaded.destroy() }
  }, [materialId, attempt])

  useEffect(() => {
    if (!doc || !canvas.current) return
    let cancelled = false
    void (async () => {
      try {
        const p = await doc.getPage(page)
        const viewport = p.getViewport({ scale: zoom * 1.2 })
        const el = canvas.current
        const context = el?.getContext('2d')
        if (cancelled || !el || !context) return
        el.width = Math.floor(viewport.width); el.height = Math.floor(viewport.height)
        await p.render({ canvasContext: context, viewport, canvas: el }).promise
      } catch { if (!cancelled) setFallback(true) }
    })()
    return () => { cancelled = true }
  }, [doc, page, zoom])

  const retry = useCallback(() => setAttempt(n => n + 1), [])
  if (phase === 'loading') return <div data-testid="pdf-loading"><LoadingState label="Opening the original pages…" /></div>
  if (phase === 'unavailable') return <p data-testid="pdf-unavailable" className="rounded-xl bg-muted p-4 text-sm">The original file is not available for this material. The Text tab has everything Co read.</p>
  if (phase === 'error') return <div role="alert" data-testid="pdf-error" className="space-y-3 rounded-xl border border-border p-4"><p className="text-sm">The original pages could not be opened right now. Nothing is lost; try again.</p><Button variant="secondary" onClick={retry}>Try again</Button></div>
  if (fallback && objectUrl) return <iframe data-testid="pdf-frame" title={`${title} (original PDF)`} src={objectUrl} className="h-[70vh] w-full rounded-xl border border-border bg-card" />
  const pages = doc?.numPages ?? 1
  const zoomIndex = zoomSteps.indexOf(zoom)
  return <div className="space-y-3" data-testid="pdf-viewer">
    <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="PDF controls">
      <Button variant="secondary" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(n => Math.max(1, n - 1))}><ChevronLeft size={18} aria-hidden="true" /></Button>
      <span className="min-w-24 text-center text-sm font-semibold" aria-live="polite" data-testid="pdf-page-label">Page {page} of {pages}</span>
      <Button variant="secondary" aria-label="Next page" disabled={page >= pages} onClick={() => setPage(n => Math.min(pages, n + 1))}><ChevronRight size={18} aria-hidden="true" /></Button>
      <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
      <Button variant="secondary" aria-label="Zoom out" disabled={zoomIndex <= 0} onClick={() => setZoom(zoomSteps[Math.max(0, zoomIndex - 1)]!)}><ZoomOut size={18} aria-hidden="true" /></Button>
      <span className="min-w-12 text-center text-sm" data-testid="pdf-zoom-label">{Math.round(zoom * 100)}%</span>
      <Button variant="secondary" aria-label="Zoom in" disabled={zoomIndex >= zoomSteps.length - 1} onClick={() => setZoom(zoomSteps[Math.min(zoomSteps.length - 1, zoomIndex + 1)]!)}><ZoomIn size={18} aria-hidden="true" /></Button>
    </div>
    <div className="max-h-[75vh] overflow-auto rounded-xl border border-border bg-muted p-2">
      <canvas ref={canvas} role="img" aria-label={`${title}, page ${page} of ${pages}`} className="mx-auto h-auto max-w-none bg-white shadow-sm" />
    </div>
  </div>
}
