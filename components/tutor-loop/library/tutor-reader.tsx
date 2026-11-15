'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Lightbulb, NotebookPen, CircleHelp, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { hasOriginal, materialApi, type MaterialDetail } from '@/lib/api/materials'
import { getTutorWorkspaceScope, tutorLoopClient } from '@/lib/api/tutor-loop/client'
import { buildTutorHref } from '@/lib/tutor-loop/open-tutor'
import { AgeBandScope } from '@/components/design-system'
import { LearnThis, MaterialLoadState, MaterialProgress, materialKeys, useMaterialConfig, sourceLabels } from '@/components/materials/material-common'
import { PdfViewer } from '@/components/materials/pdf-viewer'
import { MaterialNotesPanel } from '@/components/notes/material-notes-panel'
import { useNoteMutations } from '@/components/notes/use-notes'
import { useTutorShell } from '@/components/tutor-loop/shell/tutor-shell-context'

type Tab = 'original' | 'text' | 'ideas'
const pill = 'inline-flex min-h-9 items-center rounded-full border border-border bg-background px-3 text-[13px] font-bold hover:bg-muted'
const MAX_SELECTION = 1500

/** TL15 reader for eligible learners: Original / Text / Key ideas, selection actions, key-idea cards, notes beside the text. */
export function TutorReader({ id }: { id: string }) {
  const config = useMaterialConfig()
  const detail = useQuery({ queryKey: materialKeys.detail(config.actor, id), queryFn: () => materialApi.detail(id), enabled: !!config.data && !config.isError, retry: false, staleTime: 0, gcTime: 0,
    refetchInterval: (q) => (q.state.data && q.state.data.status !== 'ready' && q.state.data.status !== 'failed' && q.state.data.status !== 'cancelled' ? 3000 : false) })
  const material = detail.data
  const { band } = useTutorShell()
  return <AgeBandScope band={band} className="tutor-frame space-y-4 pb-28 pt-5">
    <MaterialLoadState loading={config.isPending || (!!config.data && detail.isPending)} error={config.error ?? detail.error} retry={() => { void config.refetch(); void detail.refetch() }} />
    {!config.error && !detail.error && material && <ReaderBody material={material} />}
  </AgeBandScope>
}

function ReaderBody({ material }: { material: MaterialDetail }) {
  const shell = useTutorShell()
  const name = shell.tutorName
  const workspace = getTutorWorkspaceScope()
  const original = material.sourceType === 'pdf' && hasOriginal(material)
  const tabs: { id: Tab; label: string }[] = [...(original ? [{ id: 'original' as const, label: 'Original' }] : []), { id: 'text', label: 'Text' }, { id: 'ideas', label: 'Key ideas' }]
  const [tab, setTab] = useState<Tab>(original ? 'original' : 'text')
  const [notesOpen, setNotesOpen] = useState(false)
  const [selected, setSelected] = useState('')
  const [saved, setSaved] = useState(false)
  const article = useRef<HTMLDivElement>(null)
  const { create } = useNoteMutations()
  const ready = material.status === 'ready'
  const failed = material.status === 'failed' || material.status === 'cancelled'
  const ctx = (mode: 'EXPLAIN' | 'EXPLAIN_DIFFERENTLY' | 'TEACH_BACK' | 'ASK') => buildTutorHref({ kind: 'MATERIAL', materialId: material.id }, { mode })
  const practise = `/learn/practice?materialId=${encodeURIComponent(material.id)}`
  const next = useQuery({ queryKey: ['tutor-next', workspace, material.id], queryFn: () => tutorLoopClient.nextStep('MATERIAL', material.id, { workspace }), enabled: ready, retry: false, staleTime: 30_000 })

  const readSelection = () => {
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    const text = sel?.toString().trim() ?? ''
    const inside = !!sel && sel.rangeCount > 0 && !!article.current?.contains(sel.getRangeAt(0).commonAncestorContainer)
    setSelected(inside && text ? text.slice(0, MAX_SELECTION) : '')
    setSaved(false)
  }
  const addToNotes = () => create.mutate({ materialId: material.id, kind: 'NOTE', title: selected.slice(0, 60), body: selected }, { onSuccess: () => { setSaved(true); setNotesOpen(true); setSelected('') } })

  return <>
    <div className="flex flex-wrap items-center gap-3">
      <Link href="/learn?tab=library" className={cn(pill, 'gap-2')}><ArrowLeft aria-hidden="true" className="size-4 rtl:rotate-180" />Library</Link>
      <div className="min-w-0 flex-1 basis-60"><h1 className="break-words !text-xl font-extrabold">{material.title}</h1><p className="text-sm text-muted-foreground">{sourceLabels[material.sourceType] ?? material.sourceType}</p></div>
      {ready && <button type="button" aria-pressed={notesOpen} onClick={() => setNotesOpen(!notesOpen)} className={cn(pill, 'gap-2', notesOpen && 'border-primary bg-secondary text-primary')}><NotebookPen aria-hidden="true" className="size-4" />Notes</button>}
    </div>

    {!ready && !failed && <div data-testid="reader-processing"><MaterialProgress material={material} /><p className="mt-2 text-sm text-muted-foreground">You can leave. {name} keeps going.</p></div>}
    {failed && <div role="alert" className="space-y-3 rounded-2xl border border-border bg-card p-6" data-testid="reader-failed">
      <h2>Couldn’t read this file</h2><p className="text-muted-foreground">It may be a scan or locked. Try a clearer copy or a photo of each page.</p>
      <div className="flex gap-2"><Link href="/learn/import" className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 font-bold text-primary-foreground">Upload another</Link></div></div>}

    {ready && <div className={cn('grid gap-5', notesOpen && 'lg:grid-cols-[minmax(0,1fr)_20rem]')}>
      <section aria-label="Material" className="min-w-0 space-y-3">
        <div role="tablist" aria-label="Material views" className="inline-flex gap-0.5 rounded-full bg-muted p-1">
          {tabs.map((t) => <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => setTab(t.id)} data-testid={`reader-tab-${t.id}`}
            className={cn('min-h-10 rounded-full px-4 text-sm font-bold', tab === t.id ? 'bg-background shadow-sm' : 'text-muted-foreground')}>{t.label}</button>)}
        </div>
        <article ref={article} onMouseUp={readSelection} onKeyUp={readSelection} className="min-w-0 rounded-2xl border border-border bg-card p-5">
          {tab === 'original' && original && <PdfViewer materialId={material.id} title={material.title} />}
          {tab === 'text' && (material.source
            ? <div className="max-w-prose whitespace-pre-wrap break-words leading-relaxed" data-testid="reader-text">{material.source.text}</div>
            : <p>The source is not ready to read yet.</p>)}
          {tab === 'ideas' && <ul className="grid gap-3 sm:grid-cols-2" data-testid="reader-ideas">
            {material.concepts.length === 0 && <li className="text-muted-foreground">Key ideas appear here once {name} has finished reading.</li>}
            {material.concepts.map((c) => <li key={c.id} className="flex flex-col gap-2 rounded-xl border border-border bg-background p-4">
              <b className="break-words">{c.label}</b>
              <div className="flex flex-wrap gap-2">
                <LearnThis lessonRoute={material.links.lesson} conceptId={c.id} label={c.label} />
                <Link href={`${practise}&conceptId=${encodeURIComponent(c.id)}`} className={pill}>Practise</Link>
                <Link href={ctx('TEACH_BACK')} className={pill}>Teach back</Link>
                <Link href={ctx('ASK')} className={cn(pill, 'border-transparent bg-secondary text-primary')}>Ask {name}</Link>
              </div></li>)}
          </ul>}
        </article>
        {tab === 'text' && !selected && <p className="text-sm text-muted-foreground">Select a passage to ask {name} about it, practise it or save it to your notes.</p>}
        {selected && <div role="toolbar" aria-label="Selected text" data-testid="selection-toolbar" className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/40 bg-secondary p-3">
          <Link href={ctx('EXPLAIN')} className={cn(pill, 'gap-1.5')}><Lightbulb aria-hidden="true" className="size-4" />Explain</Link>
          <Link href={ctx('EXPLAIN_DIFFERENTLY')} className={cn(pill, 'gap-1.5')}><Sparkles aria-hidden="true" className="size-4" />Analogy</Link>
          <Link href={practise} className={cn(pill, 'gap-1.5')}><CircleHelp aria-hidden="true" className="size-4" />Quiz me</Link>
          <button type="button" onClick={addToNotes} disabled={create.isPending} className={cn(pill, 'gap-1.5')}><NotebookPen aria-hidden="true" className="size-4" />Add to Notes</button>
          {create.error && <span role="alert" className="text-sm">That did not save. Try again.</span>}
        </div>}
        <p role="status" className="sr-only">{saved ? 'Saved to Notes' : ''}</p>
        {saved && <p className="text-sm font-bold text-primary">Saved to Notes</p>}
      </section>
      {notesOpen && <aside aria-label="My notes" className="min-w-0 rounded-2xl border border-border bg-card p-4"><MaterialNotesPanel materialId={material.id} band="teens" /></aside>}
    </div>}

    {ready && next.data && <div data-testid="next-step-bar" className="fixed inset-x-3 bottom-20 z-20 mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-lg lg:bottom-4">
      <p className="min-w-48 flex-1 font-bold">{next.data.briefing.wording}</p>
      <Link href={practise} className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 font-bold text-primary-foreground">{next.data.briefing.action.label || 'Practise'}</Link></div>}
  </>
}
