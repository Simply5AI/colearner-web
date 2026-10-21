'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { Camera, ArrowUp, ArrowDown, RotateCw, Trash2, Upload } from 'lucide-react'
import { Button, Card, CoCharacter } from '@/components/design-system'
import type { AgeBand } from '@/components/design-system'
import { editPage, fullPageCrop, lightingHint, movePage, validCrop, type CropBounds } from '@/lib/material-image'

interface Page { id: string; file: File; url: string }
interface PageCameraProps {
  band: AgeBand
  maxPages: number
  maxBytes: number
  unavailableReason?: string
  faceRedactionVerified: boolean
  submitting: boolean
  onSubmit: (files: File[]) => Promise<void>
  onPagesChange?: () => void
}

/** Device-only capture/editing. The product API owns source acceptance and all AI processing. */
export function PageCamera({ band, maxPages, maxBytes, unavailableReason, faceRedactionVerified, submitting, onSubmit, onPagesChange }: PageCameraProps) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const urls = useRef(new Set<string>())
  const mounted = useRef(true)
  const [camera, setCamera] = useState(false)
  const [opening, setOpening] = useState(false)
  const [message, setMessage] = useState('')
  const [lighting, setLighting] = useState<'dark' | 'check'>('check')
  const [draft, setDraft] = useState<Page | null>(null)
  const [crop, setCrop] = useState<CropBounds>(fullPageCrop)
  const [rotation, setRotation] = useState(0)
  const [pages, setPages] = useState<Page[]>([])
  const [editing, setEditing] = useState(false)
  const [dragged, setDragged] = useState<number | null>(null)

  const stopCamera = () => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; setCamera(false) }
  useEffect(() => {
    mounted.current = true
    const ownedUrls = urls.current
    return () => {
      mounted.current = false
      stream.current?.getTracks().forEach(track => track.stop())
      ownedUrls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [])
  useEffect(() => {
    if (!camera) return
    const sample = window.setInterval(() => {
      if (!video.current?.videoWidth) return
      const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) return
      context.drawImage(video.current, 0, 0, 32, 32)
      setLighting(lightingHint(context.getImageData(0, 0, 32, 32).data))
    }, 1500)
    return () => window.clearInterval(sample)
  }, [camera])

  const makePage = (file: File): Page => {
    const url = URL.createObjectURL(file); urls.current.add(url)
    return { id: crypto.randomUUID(), file, url }
  }
  const release = (page: Page) => { URL.revokeObjectURL(page.url); urls.current.delete(page.url) }
  const choose = (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setMessage('Choose a JPEG, PNG or WebP photo.'); return }
    if (file.size > maxBytes) { setMessage(`This photo is too large. Maximum ${Math.floor(maxBytes / 1024 / 1024)} MB per page.`); return }
    if (pages.length >= maxPages) { setMessage(`This school allows up to ${maxPages} pages per import.`); return }
    if (draft) release(draft)
    setDraft(makePage(file)); setCrop(fullPageCrop); setRotation(0); setMessage('')
  }
  const openCamera = async () => {
    setOpening(true); setMessage('')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access is unavailable. Upload a photo instead.')
      const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      if (!mounted.current) { next.getTracks().forEach(track => track.stop()); return }
      stream.current?.getTracks().forEach(track => track.stop()); stream.current = next
      if (video.current) { video.current.srcObject = next; await video.current.play() }
      setCamera(true)
    } catch (error) {
      stream.current?.getTracks().forEach(track => track.stop()); stream.current = null
      setMessage(error instanceof DOMException && error.name === 'NotAllowedError' ? 'Camera permission was denied. Allow it in your browser settings or upload a photo instead.' : 'No camera is available. Try another device or upload a photo instead.')
    } finally { setOpening(false) }
  }
  const capture = async () => {
    const element = video.current
    if (!element?.videoWidth || !element.videoHeight) { setMessage('The camera is still opening. Try again in a moment.'); return }
    const canvas = document.createElement('canvas'); canvas.width = element.videoWidth; canvas.height = element.videoHeight
    const context = canvas.getContext('2d')
    if (!context) { setMessage('Photo capture is unavailable. Upload a photo instead.'); return }
    context.drawImage(element, 0, 0)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (!blob) { setMessage('Could not capture a page. Upload a photo instead.'); return }
    choose(new File([blob], 'page.jpg', { type: 'image/jpeg' }))
  }
  const accept = async () => {
    if (!draft) return
    setEditing(true)
    try {
      const file = await editPage(draft.file, crop, rotation)
      if (file.size > maxBytes) throw new Error('The edited page exceeds the school upload limit.')
      const page = makePage(file)
      setPages(current => [...current, page]); onPagesChange?.()
      release(draft); setDraft(null); setMessage('Page added. Add another page or send your pages.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not edit this page.') }
    finally { setEditing(false) }
  }
  const send = async () => {
    setMessage('')
    try { await onSubmit(pages.map(page => page.file)); stopCamera() }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Your pages could not be sent. They are still here.') }
  }
  return <div className="space-y-5">
    <Card className="p-5">
      <div className="flex items-center gap-3"><CoCharacter band={band} state="encouraging" decorative size={64} /><div><h2 className="text-xl font-bold">Snap pages, not people</h2><p className="text-sm text-muted-foreground">{faceRedactionVerified ? 'Photos are checked and redacted by the configured processor before analysis.' : 'Automatic face blurring is unavailable. Keep people and personal details out of your photos.'}</p></div></div>
    </Card>
    {unavailableReason && <p role="status" className="rounded-xl border border-border bg-muted p-4">{unavailableReason} You can review photos here; sending stays locked until the school enables this source.</p>}
    <div className="relative min-h-64 overflow-hidden rounded-2xl bg-slate-950">
      <video ref={video} muted playsInline aria-label="Live page camera" className={`max-h-[60vh] w-full object-contain ${camera && !draft ? '' : 'invisible'}`} />
      {!camera && !draft && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white"><Camera size={48} aria-hidden="true" /><p>Fit your page inside the guide</p></div>}
      {camera && !draft && <div aria-hidden="true" className="pointer-events-none absolute inset-[10%] rounded-xl border-2 border-dashed border-white/90" />}
      {draft && <div className="absolute inset-0"><Image src={draft.url} alt="Page to crop" fill unoptimized className="object-contain" style={{ transform: `rotate(${rotation * 90}deg)` }} /></div>}
    </div>
    {camera && !draft && <p role="status">{lighting === 'dark' ? 'Need more light. Move to a brighter spot before taking your photo.' : 'Check the page is sharp and all text is inside the guide.'} <span className="text-sm text-muted-foreground">The guide is manual; lighting is estimated on this device.</span></p>}
    <div className="flex flex-wrap items-center gap-3">
      {!draft && <><Button variant="secondary" onClick={() => void openCamera()} loading={opening} disabled={camera || pages.length >= maxPages}>Open camera</Button>{camera && <><Button onClick={() => void capture()} disabled={pages.length >= maxPages} className={band === 'kids' ? 'min-h-24 min-w-24 rounded-full' : ''}><Camera aria-hidden="true" />Take photo</Button><Button variant="ghost" onClick={stopCamera}>Close camera</Button></>}</>}
      <label className="ds-button ds-button-secondary cursor-pointer"><Upload size={18} aria-hidden="true" />Upload a photo instead<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" disabled={pages.length >= maxPages || submitting} onChange={event => { const file = event.currentTarget.files?.[0]; if (file) choose(file); event.currentTarget.value = '' }} /></label>
    </div>
    {draft && <Card className="space-y-4 p-5"><h2 className="font-bold">Review your page</h2><p className="text-sm text-muted-foreground">Adjust the crop before rotating. No automatic page-edge detection is applied.</p><div className="grid gap-4 sm:grid-cols-2">{(['left', 'top', 'right', 'bottom'] as const).map(edge => <label key={edge} className="flex flex-col gap-1 capitalize">Crop {edge}: {crop[edge]}%<input aria-label={`Crop ${edge}`} type="range" min={0} max={100} value={crop[edge]} onChange={event => setCrop(current => ({ ...current, [edge]: Number(event.target.value) }))} /></label>)}</div>{!validCrop(crop) && <p role="alert">Leave at least 5% of the page inside the crop.</p>}<div className="flex flex-wrap gap-3"><Button variant="secondary" onClick={() => setRotation(value => (value + 1) % 4)}><RotateCw size={18} aria-hidden="true" />Rotate</Button><Button variant="secondary" onClick={() => { release(draft); setDraft(null) }}>Retake</Button><Button onClick={() => void accept()} loading={editing} disabled={!validCrop(crop)}>Use photo</Button></div></Card>}
    {pages.length > 0 && <Card className="space-y-4 p-5"><h2 className="text-xl font-bold">Your pages · {pages.length} of {maxPages}</h2><p className="text-sm text-muted-foreground">Drag pages or use the arrow buttons to change their reading order. Photos stay on this page until you send them.</p><ol className="grid gap-4 sm:grid-cols-3">{pages.map((page, index) => <li key={page.id} draggable onDragStart={() => setDragged(index)} onDragOver={event => event.preventDefault()} onDrop={() => { if (dragged !== null) setPages(current => movePage(current, dragged, index)); onPagesChange?.(); setDragged(null) }} className="rounded-xl border border-border p-3"><div className="relative h-40"><Image src={page.url} alt={`Captured page ${index + 1}`} fill unoptimized className="object-contain" /></div><p className="my-2 font-semibold">Page {index + 1}</p><div className="flex gap-2"><Button variant="secondary" aria-label={`Move page ${index + 1} earlier`} disabled={index === 0 || submitting} onClick={() => { setPages(current => movePage(current, index, index - 1)); onPagesChange?.() }}><ArrowUp size={16} /></Button><Button variant="secondary" aria-label={`Move page ${index + 1} later`} disabled={index === pages.length - 1 || submitting} onClick={() => { setPages(current => movePage(current, index, index + 1)); onPagesChange?.() }}><ArrowDown size={16} /></Button><Button variant="ghost" aria-label={`Delete page ${index + 1}`} disabled={submitting} onClick={() => { release(page); setPages(current => current.filter(item => item.id !== page.id)); onPagesChange?.() }}><Trash2 size={16} /></Button></div></li>)}</ol><Button onClick={() => void send()} loading={submitting} disabled={!!unavailableReason || !!draft}>Send {pages.length} {pages.length === 1 ? 'page' : 'pages'} for reading</Button></Card>}
    {message && <p role="status" className="rounded-xl border border-border p-4">{message}</p>}
  </div>
}

