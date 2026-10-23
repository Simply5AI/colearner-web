'use client'

import { useId, useRef, useState, type FormEvent } from 'react'
import { Camera, Link2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { checkFile, checkLink, materialTypeLabel, putToPresignedUrl, type MaterialType, type TeachingMaterial } from '@/lib/api/teaching/materials'
import { IntentKey, teachingErrorText } from '@/lib/api/teaching/plans'
import { cn } from '@/lib/utils'
import { FieldHint, InlineAlert } from '@/components/teacher/plans/fields'
import { useTeachingApis } from '@/components/teacher/plans/use-teaching-apis'

type Mode = 'FILE' | 'LINK' | 'PHOTO'
const chosenLabel = (file: File, photo: boolean) => { const type = checkFile(file, photo).type; return type ? materialTypeLabel[type] : 'Unsupported type' }
export interface AddMaterialFormProps {
  planId: string
  topicId: string
  /** Photo capture needs configured storage (`features.photoUpload`). When unavailable the reason is shown and the option is disabled. */
  photo: { available: boolean; reason: string | null }
  onAdded: (material: TeachingMaterial) => void
}

/**
 * F-T3-02: upload (presigned URL), link or photo. The title, file and link stay in the form on any failure, and a retry of
 * the same material reuses one Idempotency-Key so it never adds it twice. Co does not read or analyse teacher material in B12.
 */
export function AddMaterialForm({ planId, topicId, photo, onAdded }: AddMaterialFormProps) {
  const apis = useTeachingApis()
  const uid = useId()
  const intent = useRef(new IntentKey())
  const fileInput = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<Mode>('FILE')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fraction, setFraction] = useState<number | null>(null)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const abort = useRef<AbortController | null>(null)

  const reset = () => { setTitle(''); setDescription(''); setUrl(''); setFile(null); setFraction(null); if (fileInput.current) fileInput.current.value = ''; intent.current.done() }
  const pick = (next: File | null) => {
    setFailure(null)
    setFile(next)
    if (next && !title.trim()) setTitle(next.name.replace(/\.[^.]+$/, ''))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setFailure(null)
    const name = title.trim()
    if (!name) { setFailure('Give the material a title.'); return }
    try {
      setPending(true)
      if (mode === 'LINK') {
        const link = checkLink(url)
        if (!link.ok) { setFailure(link.problem); return }
        const type: MaterialType = link.video ? 'VIDEO_LINK' : 'EXTERNAL_LINK'
        const body = { type, title: name, ...(description.trim() ? { description: description.trim() } : {}), externalUrl: link.url }
        const material = await apis.materials.create(planId, topicId, body, intent.current.keyFor(body))
        setAnnounce(`${name} added.`)
        reset(); onAdded(material)
        return
      }
      if (!file) { setFailure(mode === 'PHOTO' ? 'Take or choose a photo first.' : 'Choose a file first.'); return }
      const verdict = checkFile(file, mode === 'PHOTO')
      if (!verdict.type) { setFailure(verdict.problem); return }
      abort.current = new AbortController()
      setFraction(0)
      const target = await apis.materials.uploadUrl(planId, topicId, { type: verdict.type, filename: file.name, mimeType: file.type || 'application/octet-stream', sizeBytes: file.size })
      await putToPresignedUrl(target.uploadUrl, file, file.type || 'application/octet-stream', setFraction, abort.current.signal)
      const body = { type: verdict.type, title: name, ...(description.trim() ? { description: description.trim() } : {}), storageKey: target.storageKey, mimeType: file.type || undefined, sizeBytes: file.size }
      const material = await apis.materials.create(planId, topicId, body, intent.current.keyFor(body))
      setAnnounce(`${name} added.`)
      reset(); onAdded(material)
    } catch (error) {
      setFraction(null)
      setFailure(teachingErrorText(error))
    } finally {
      setPending(false)
    }
  }

  const modeButton = (key: Mode, label: string, Icon: typeof Upload, disabled = false) => (
    <button type="button" role="radio" aria-checked={mode === key} disabled={disabled || pending} onClick={() => { setMode(key); setFailure(null); setFile(null); if (fileInput.current) fileInput.current.value = '' }} data-testid={`material-mode-${key.toLowerCase()}`}
      className={cn('flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50', mode === key ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted')}><Icon aria-hidden="true" className="size-4" />{label}</button>
  )

  return <form onSubmit={e => void submit(e)} className="space-y-3 rounded-xl border border-border p-4" aria-busy={pending} data-testid="add-material" noValidate>
    <h4 className="text-sm font-bold">Add material</h4>
    <div role="radiogroup" aria-label="How to add material" className="flex flex-wrap gap-2">
      {modeButton('FILE', 'Upload a file', Upload)}{modeButton('LINK', 'Add a link', Link2)}{modeButton('PHOTO', 'Take a photo', Camera, !photo.available)}
    </div>
    {!photo.available && <p className="text-xs text-muted-foreground" data-testid="photo-unavailable">Photos are not available: {photo.reason ?? 'file storage is not set up for your school yet.'}</p>}
    {mode === 'LINK' ? <div className="space-y-1.5">
      <Label htmlFor={`${uid}-url`}>Link</Label>
      <Input id={`${uid}-url`} type="url" inputMode="url" value={url} onChange={e => { setUrl(e.target.value); setFailure(null) }} placeholder="https://" aria-describedby={`${uid}-url-hint`} disabled={pending} />
      <FieldHint id={`${uid}-url-hint`}>Only https links. A YouTube or Vimeo link is added as a video.</FieldHint>
    </div> : <div className="space-y-1.5">
      <Label htmlFor={`${uid}-file`}>{mode === 'PHOTO' ? 'Photo' : 'File'}</Label>
      <input id={`${uid}-file`} ref={fileInput} type="file" disabled={pending} onChange={e => pick(e.target.files?.[0] ?? null)} aria-describedby={`${uid}-file-hint`} data-testid="material-file"
        {...(mode === 'PHOTO' ? { accept: 'image/jpeg,image/png,image/webp', capture: 'environment' as const } : { accept: '.pdf,.ppt,.pptx,.key,.doc,.docx,.mp4,.mov,.webm,.m4v,image/jpeg,image/png,image/webp' })}
        className="block min-h-10 w-full text-sm file:me-3 file:rounded-lg file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm" />
      <FieldHint id={`${uid}-file-hint`}>{mode === 'PHOTO' ? 'JPEG, PNG or WebP up to 20 MB.' : 'PDF, slides or Word up to 50 MB, video up to 2 GB, or a photo up to 20 MB.'} Co does not read or analyse teacher material in this release.</FieldHint>
      {file && <p className="text-xs text-muted-foreground" data-testid="material-file-chosen">{file.name} · {chosenLabel(file, mode === 'PHOTO')}</p>}
    </div>}
    <div className="space-y-1.5"><Label htmlFor={`${uid}-title`}>Title</Label><Input id={`${uid}-title`} value={title} onChange={e => setTitle(e.target.value)} maxLength={200} disabled={pending} /></div>
    <div className="space-y-1.5"><Label htmlFor={`${uid}-desc`}>Description (optional)</Label><Textarea id={`${uid}-desc`} rows={2} value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} disabled={pending} /></div>
    {fraction !== null && <div role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)} data-testid="upload-progress" className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary motion-safe:transition-[width]" style={{ width: `${Math.round(fraction * 100)}%` }} /></div>}
    {failure && <InlineAlert testId="add-material-failure">{failure} Your entries are still here.</InlineAlert>}
    <p className="sr-only" role="status" aria-live="polite">{announce}</p>
    <div className="flex gap-2">
      <Button type="submit" size="lg" disabled={pending} data-testid="add-material-submit">{pending ? (fraction !== null ? 'Uploading…' : 'Adding…') : 'Add material'}</Button>
      {pending && fraction !== null && <Button type="button" variant="outline" size="lg" onClick={() => abort.current?.abort()}>Cancel upload</Button>}
    </div>
  </form>
}
