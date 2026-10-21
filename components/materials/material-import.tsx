'use client'

import Link from 'next/link'
import { useRef, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LockKeyhole } from 'lucide-react'
import { Button, Card, Input } from '@/components/design-system'
import { materialApi, pendingMaterial, type MaterialConfig, type SourceType } from '@/lib/api/materials'
import { MaterialFrame, MaterialLoadState, MaterialProgress, MaterialSelectors, materialKeys, sourceIcons, useMaterialConfig } from './material-common'

const fileAccept: Partial<Record<SourceType, string>> = { pdf: '.pdf,application/pdf', docx: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document', pptx: '.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation', image: 'image/jpeg,image/png,image/webp', audio: 'audio/*' }

export function MaterialJobs({ ids, actor }: { ids: string[]; actor: string }) {
  const cache = useQueryClient()
  const retryKeys = useRef(new Map<string, string>())
  const jobs = useQuery({ queryKey: ['materials', actor, 'jobs', ids], queryFn: () => Promise.all(ids.map(id => materialApi.detail(id))), enabled: !!actor && ids.length > 0, retry: false, staleTime: 0, gcTime: 0, refetchInterval: query => query.state.data?.some(pendingMaterial) ? 3000 : false })
  const change = useMutation({ mutationFn: ({ id, action }: { id: string; action: 'retry' | 'cancel' }) => {
    if (action === 'cancel') return materialApi.cancel(id)
    const key = retryKeys.current.get(id) ?? crypto.randomUUID(); retryKeys.current.set(id, key)
    return materialApi.retry(id, key)
  }, retry: false, onSuccess: material => { retryKeys.current.delete(material.id); void cache.invalidateQueries({ queryKey: materialKeys.root }) } })
  return <div className="space-y-4"><MaterialLoadState loading={jobs.isPending} error={jobs.error} retry={() => void jobs.refetch()} />{!jobs.error && jobs.data?.map(material => <section key={material.id} className="space-y-3"><MaterialProgress material={material} /><div className="flex flex-wrap gap-3">{material.actions.cancel && <Button variant="secondary" loading={change.isPending && change.variables?.id === material.id} onClick={() => change.mutate({ id: material.id, action: 'cancel' })}>Cancel processing</Button>}{material.actions.retry && <Button variant="secondary" loading={change.isPending && change.variables?.id === material.id} onClick={() => change.mutate({ id: material.id, action: 'retry' })}>Retry this material</Button>}{material.links.reader && <Link href={material.links.reader} className="ds-button ds-button-primary">Open reader</Link>}{material.links.lesson && <Link href={material.links.lesson} className="ds-button ds-button-primary">Start lesson</Link>}{material.links.practice && <Link href={material.links.practice} className="ds-button ds-button-secondary">Practice now</Link>}</div>{material.status === 'ready' && !material.links.lesson && !material.links.practice && <p className="text-sm text-muted-foreground">Lesson and practice creation are not available for this material yet.</p>}{(material.status === 'failed' || material.status === 'cancelled') && <Link href="/learn/import" className="ds-button ds-button-secondary">Choose another source</Link>}</section>)}{change.error && <p role="alert">{change.error.message}</p>}</div>
}

function ImportForm({ config }: { config: MaterialConfig }) {
  const router = useRouter()
  const cache = useQueryClient()
  const key = useRef<string | null>(null)
  const [type, setType] = useState<SourceType>('text')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [planId, setPlanId] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [validation, setValidation] = useState('')
  const source = config.sources.find(item => item.type === type)
  const quotaReached = config.limits.dailyLimit !== null && config.limits.usedToday >= config.limits.dailyLimit
  const edit = (action: () => void) => { action(); key.current = null; setValidation('') }
  const pickFiles = (next: File[]) => {
    if (next.length > config.limits.maxFiles) { setValidation(`Choose up to ${config.limits.maxFiles} files.`); return }
    if (next.reduce((total, file) => total + file.size, 0) > config.limits.maxBytes) { setValidation(`The combined upload must be at most ${Math.floor(config.limits.maxBytes / 1024 / 1024)} MB.`); return }
    edit(() => setFiles(next))
  }
  const submit = useMutation({ mutationFn: async () => {
    const idempotencyKey = key.current ?? crypto.randomUUID(); key.current = idempotencyKey
    return materialApi.import({ idempotencyKey, title: title.trim(), sourceType: type, ...(type === 'text' ? { text } : ['youtube', 'web', 'paper'].includes(type) ? { url } : {}), ...(subjectId ? { subjectId } : {}), ...(planId ? { planId } : {}) }, files)
  }, retry: false, onSuccess: result => {
    void cache.invalidateQueries({ queryKey: materialKeys.root })
    const ids = result.items.map(item => item.id)
    if (ids.length) router.push(`/learn/import?material=${encodeURIComponent(ids[0]!)}&batch=${encodeURIComponent(ids.join(','))}`)
  } })
  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!source?.available || !config.enabled || quotaReached) { setValidation(source?.reason ?? 'Importing is currently unavailable for this learner.'); return }
    if (type !== 'text' && !['youtube', 'web', 'paper'].includes(type) && files.length === 0) { setValidation('Choose a file before importing.'); return }
    submit.mutate()
  }
  const sources = [...config.sources].sort((a, b) => config.band === 'kids' ? Number(b.type === 'image') - Number(a.type === 'image') : 0)
  return <form onSubmit={onSubmit} className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-3">{sources.map(item => { const Icon = sourceIcons[item.type]; return <button type="button" key={item.type} aria-pressed={type === item.type} onClick={() => edit(() => { setType(item.type); setFiles([]) })} className={`flex min-h-24 min-w-0 flex-col items-start gap-2 rounded-2xl border p-4 text-start focus-visible:outline-2 focus-visible:outline-offset-2 ${type === item.type ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}><span className="flex items-center gap-2 font-bold"><Icon size={22} aria-hidden="true" />{item.label}{!item.available && <LockKeyhole size={16} aria-label="Unavailable source" />}</span>{!item.available && <span className="text-xs text-muted-foreground">{item.reason ?? 'Ask your school or grown-up to enable this source.'}</span>}</button> })}</div>
    <Card className="space-y-4 p-5">
      {!config.enabled && <p role="status">Imports are not enabled for the current learner. Your school and guardian permissions must be checked before sending.</p>}
      <p className="text-sm text-muted-foreground">{config.limits.dailyLimit === null ? 'School import quota: no daily cap configured.' : `Today: ${config.limits.usedToday} of ${config.limits.dailyLimit} imports used.`} Up to {config.limits.maxFiles} files, {Math.floor(config.limits.maxBytes / 1024 / 1024)} MB combined.</p>
      {!source?.available && <p role="status" className="rounded-xl bg-muted p-3">{source?.reason ?? 'This source is unavailable.'} Choose an enabled source to continue.</p>}
      <Input label="Material title" value={title} maxLength={300} required onChange={event => edit(() => setTitle(event.target.value))} />
      <MaterialSelectors config={config} subjectId={subjectId} planId={planId} setSubjectId={value => edit(() => setSubjectId(value))} setPlanId={value => edit(() => setPlanId(value))} />
      {type === 'text' && <label className="ds-field"><span>Paste the source text</span><textarea required value={text} maxLength={config.limits.maxTextLength} onChange={event => edit(() => setText(event.target.value))} rows={10} className="ds-input resize-y" /><span className="text-xs text-muted-foreground">{text.length} / {config.limits.maxTextLength} characters. Only submit material you are permitted to use.</span></label>}
      {['youtube', 'web', 'paper'].includes(type) && <Input label="Source link" type="url" value={url} required onChange={event => edit(() => setUrl(event.target.value))} hint="Only public, permitted sources can be read. A login or paywall is never bypassed." />}
      {fileAccept[type] && <div className="space-y-3"><label className="ds-field rounded-xl border-2 border-dashed border-border p-5" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); pickFiles(Array.from(event.dataTransfer.files)) }}><span>Choose or drop {source?.label.toLowerCase()} files</span><input className="w-full min-w-0 max-w-full text-sm" type="file" accept={fileAccept[type]} multiple={config.limits.maxFiles > 1} onChange={event => pickFiles(Array.from(event.target.files ?? []))} /><span className="text-sm text-muted-foreground">Files are sent in this order. Scanned or unreadable documents need an available image processor; they are never treated as extracted text.</span></label>{files.length > 0 && <ol className="list-inside list-decimal text-sm">{files.map((file, index) => <li key={`${file.name}-${index}`} className="break-words">{file.name} · {Math.ceil(file.size / 1024)} KB</li>)}</ol>}{type === 'image' && <Link href="/learn/snap" className="ds-button ds-button-secondary max-w-full whitespace-normal text-center">Open camera and page editor</Link>}{type === 'audio' && <p className="text-sm text-muted-foreground">Audio transcription requires a qualified processor. Recording and audio imports remain locked while it is unavailable.</p>}</div>}
      {(validation || submit.error) && <p role="alert" className="rounded-xl border border-border p-3">{validation || submit.error?.message}</p>}
      <Button type="submit" loading={submit.isPending} disabled={!source?.available || !config.enabled || quotaReached}>Read this material</Button>
      <p className="text-xs text-muted-foreground">Your draft stays here if sending fails. It is not saved across a page reload until the server accepts the import.</p>
    </Card>
  </form>
}

export function MaterialImport() {
  const config = useMaterialConfig()
  const params = useSearchParams()
  const rawIds = params.get('batch') ?? params.get('material') ?? ''
  const ids = [...new Set(rawIds.split(',').filter(id => /^[a-zA-Z0-9_-]{1,128}$/.test(id)))].slice(0, 10)
  return <MaterialFrame title={ids.length ? 'Your material' : 'What do you want to learn?'} description={ids.length ? 'Return here from your library to see the actual saved processing state.' : 'Bring a source you have permission to use. Co reads enabled sources and finds key ideas.'} config={config.data}>
    <MaterialLoadState loading={config.isPending} error={config.error} retry={() => void config.refetch()} />
    {config.data && !config.error && (ids.length ? <MaterialJobs ids={ids} actor={config.actor} /> : <ImportForm config={config.data} />)}
  </MaterialFrame>
}


