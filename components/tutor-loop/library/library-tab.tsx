'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { FileText, Link2, Mic, Play, Plus, Search, Camera, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTutorWorkspaceScope } from '@/lib/api/tutor-loop/client'
import {
  LIBRARY_PAGE_SIZE, MATERIAL_KIND_FILTERS, listTutorLibrary, materialStatusView, materialTypeLabel,
  type LibraryGroupBy, type LibraryItem, type LibrarySort, type MaterialKindFilter,
} from '@/lib/api/tutor-loop/library'
import { formatTutorTimestamp } from '@/lib/tutor-loop/date'
import { buildHrefWithGoal } from '@/lib/tutor-loop/goal-filter'
import { buildTutorHref } from '@/lib/tutor-loop/open-tutor'
import { useTutorShell } from '@/components/tutor-loop/shell/tutor-shell-context'

const iconFor = (t: string): LucideIcon => {
  const v = materialTypeLabel(t)
  return v === 'Link' ? Link2 : v === 'Video' ? Play : v === 'Audio' ? Mic : v === 'Photo' ? Camera : FileText
}
const chip = (on: boolean) => cn('min-h-9 rounded-full border px-3 text-sm font-bold', on ? 'border-primary bg-secondary text-primary' : 'border-border bg-background')

export function LibraryTab({ goalId }: { goalId: string | null }) {
  const shell = useTutorShell()
  const workspace = getTutorWorkspaceScope()
  const [text, setText] = useState('')
  const [kind, setKind] = useState<MaterialKindFilter>('ALL')
  const [groupBy, setGroupBy] = useState<LibraryGroupBy>('NONE')
  const [sort, setSort] = useState<LibrarySort>('NEWEST')
  const [recent, setRecent] = useState(false)
  // Cursor stack: page n uses cursors[n]; changing any filter resets to page one.
  const [cursors, setCursors] = useState<(string | null)[]>([null])
  const page = cursors.length - 1
  const reset = () => setCursors([null])
  const sourceType = MATERIAL_KIND_FILTERS.find((k) => k.value === kind)?.sourceType ?? null
  const query = useQuery({
    queryKey: ['tutor-library', workspace, goalId, text, sourceType, groupBy, sort, recent, cursors[page]],
    queryFn: () => listTutorLibrary({ goalId, query: text, sourceType, groupBy, sort, recentDays: recent ? 7 : null, cursor: cursors[page], limit: LIBRARY_PAGE_SIZE }, { workspace }),
    retry: false, placeholderData: (prev) => prev,
  })
  const name = shell.tutorName
  const findState = shell.entry?.capabilities.findMaterial ?? 'HIDDEN'
  const data = query.data
  const pages = data ? Math.max(1, Math.ceil(data.total / LIBRARY_PAGE_SIZE)) : 1
  const byId = new Map((data?.items ?? []).map((i) => [i.id, i]))
  const sections: { key: string; title: string | null; items: LibraryItem[] }[] = data?.groups && groupBy !== 'NONE'
    ? data.groups.map((g) => ({ key: g.key, title: g.title, items: g.itemIds.map((id) => byId.get(id)).filter((i): i is LibraryItem => !!i) }))
    : [{ key: 'all', title: null, items: data?.items ?? [] }]

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="me-auto">Library</h2>
      {findState === 'AVAILABLE' && <Link href={buildTutorHref({ kind: 'GLOBAL' }, { mode: 'ASK' })} className="inline-flex min-h-11 items-center rounded-full border border-border px-4 font-bold">Ask {name} to find material</Link>}
      {findState === 'LOCKED' && <Link href="/settings" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 font-bold">Ask {name} to find material <span className="rounded-full bg-secondary px-2 text-xs text-primary">Plus</span></Link>}
      <Link href={buildHrefWithGoal('/learn/import', goalId)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 font-bold text-primary-foreground"><Plus aria-hidden="true" className="size-4" />Add material</Link>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex min-h-11 max-w-xs flex-1 basis-48 items-center gap-2 rounded-full border border-border bg-background px-3">
        <Search aria-hidden="true" className="size-4 text-muted-foreground" />
        <input value={text} onChange={(e) => { setText(e.target.value); reset() }} placeholder="Search" aria-label="Search material" maxLength={120} className="min-w-0 flex-1 bg-transparent outline-none" /></label>
      {MATERIAL_KIND_FILTERS.map((f) => <button key={f.value} type="button" aria-pressed={kind === f.value} onClick={() => { setKind(f.value); reset() }} className={chip(kind === f.value)}>{f.label}</button>)}
    </div>
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <b aria-live="polite">{data ? `${data.total} ${data.total === 1 ? 'item' : 'items'}` : '…'}{goalId ? ` · Showing: ${shell.goals.find((g) => g.id === goalId)?.title ?? 'this goal'}` : ''}</b>
      <label className="flex items-center gap-1.5">Group<select value={groupBy} onChange={(e) => { setGroupBy(e.target.value as LibraryGroupBy); reset() }} className="min-h-9 rounded-lg border border-border bg-background px-2">
        <option value="NONE">None</option><option value="SUBJECT">By subject</option><option value="TOPIC">By topic</option></select></label>
      <label className="flex items-center gap-1.5">Sort<select value={sort} onChange={(e) => { setSort(e.target.value as LibrarySort); reset() }} className="min-h-9 rounded-lg border border-border bg-background px-2">
        <option value="NEWEST">Newest first</option><option value="TITLE">A to Z</option></select></label>
      <button type="button" aria-pressed={recent} onClick={() => { setRecent(!recent); reset() }} className={chip(recent)}>Last 7 days</button>
    </div>

    {query.isPending && <div role="status" aria-label="Loading library" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />)}</div>}
    {query.isError && <div role="alert" className="space-y-3 rounded-2xl border border-border bg-card p-6"><h3>Your library could not load</h3><p className="text-muted-foreground">Try again in a moment.</p>
      <button type="button" onClick={() => void query.refetch()} className="min-h-11 rounded-full bg-primary px-5 font-bold text-primary-foreground">Try again</button></div>}
    {data && data.total === 0 && <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-muted-foreground">
      {text || kind !== 'ALL' || recent || goalId ? 'Nothing matches. Try clearing a filter.' : <>Nothing here yet. <Link href="/learn/import" className="font-bold text-primary underline">Add your first material</Link>.</>}</div>}
    {sections.map((s) => s.items.length > 0 && <section key={s.key} className="space-y-2" aria-label={s.title ?? 'Material'}>
      {s.title && <div className="flex items-baseline gap-3"><h3>{s.title}</h3><span className="text-sm text-muted-foreground">{s.items.length} {s.items.length === 1 ? 'item' : 'items'}</span></div>}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{s.items.map((m) => <MaterialCard key={m.id} item={m} name={name} />)}</ul></section>)}
    {pages > 1 && <nav aria-label="Pages" className="flex items-center justify-center gap-3">
      <button type="button" disabled={page === 0} onClick={() => setCursors(cursors.slice(0, -1))} className="min-h-10 rounded-full border border-border px-4 font-bold disabled:opacity-40">Previous</button>
      <b className="text-sm">Page {page + 1} of {pages}</b>
      <button type="button" disabled={!data?.nextCursor} onClick={() => data?.nextCursor && setCursors([...cursors, data.nextCursor])} className="min-h-10 rounded-full border border-border px-4 font-bold disabled:opacity-40">Next</button></nav>}
  </div>
}

function MaterialCard({ item, name }: { item: LibraryItem; name: string }) {
  const Icon = iconFor(item.sourceType)
  const view = materialStatusView(item.status)
  const open = `/learn/library/${encodeURIComponent(item.id)}`
  return <li className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
    <span className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-lg bg-secondary text-primary"><Icon aria-hidden="true" className="size-4" /></span>
      {item.addedViaTutor && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-primary">Added by {name}</span>}</span>
    <b className="break-words">{item.title}</b>
    <span className="text-sm text-muted-foreground">{materialTypeLabel(item.sourceType)} · {formatTutorTimestamp(item.createdAt)}</span>
    {item.subjectTitle && <span className="text-sm">{item.subjectTitle}</span>}
    {view === 'ready' && <div className="mt-auto flex flex-wrap gap-2"><Link href={open} className="inline-flex min-h-10 items-center rounded-full border border-border px-4 text-sm font-bold">Open</Link>
      <Link href={buildTutorHref({ kind: 'MATERIAL', materialId: item.id }, { mode: 'EXPLAIN' })} className="inline-flex min-h-10 items-center rounded-full bg-secondary px-4 text-sm font-bold text-primary">Start lesson</Link></div>}
    {view === 'processing' && <p role="status" className="mt-auto text-sm font-bold">{name} is reading it…</p>}
    {view === 'failed' && <div className="mt-auto flex flex-wrap items-center gap-2"><span className="text-sm font-bold">Couldn’t read this</span>
      <Link href="/learn/import" className="inline-flex min-h-10 items-center rounded-full border border-border px-4 text-sm font-bold">Try again</Link></div>}
  </li>
}
