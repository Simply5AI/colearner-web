'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTutorWorkspaceScope } from '@/lib/api/tutor-loop/client'
import { NOTE_KIND_FILTERS, listTutorNotes, noteKindLabel, type TutorNoteKind } from '@/lib/api/tutor-loop/library'
import { formatTutorTimestamp } from '@/lib/tutor-loop/date'
import { useTutorShell } from '@/components/tutor-loop/shell/tutor-shell-context'

export function NotesTab({ goalId }: { goalId: string | null }) {
  const { tutorName } = useTutorShell()
  const workspace = getTutorWorkspaceScope()
  const [text, setText] = useState('')
  const [kind, setKind] = useState<TutorNoteKind | 'ALL'>('ALL')
  const query = useQuery({
    queryKey: ['tutor-notes', workspace, goalId, text, kind],
    queryFn: () => listTutorNotes({ goalId, query: text, kind: kind === 'ALL' ? null : kind }, { workspace }),
    retry: false,
  })
  const items = query.data?.items ?? []
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex min-h-11 max-w-xs flex-1 basis-48 items-center gap-2 rounded-full border border-border bg-background px-3">
        <Search aria-hidden="true" className="size-4 text-muted-foreground" />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search notes" aria-label="Search notes" maxLength={120} className="min-w-0 flex-1 bg-transparent outline-none" /></label>
      {NOTE_KIND_FILTERS.map((f) => <button key={f.value} type="button" aria-pressed={kind === f.value} onClick={() => setKind(f.value)}
        className={cn('min-h-9 rounded-full border px-3 text-sm font-bold', kind === f.value ? 'border-primary bg-secondary text-primary' : 'border-border bg-background')}>{f.label}</button>)}
    </div>
    {query.isPending && <div role="status" aria-label="Loading notes" className="h-32 animate-pulse rounded-2xl bg-muted" />}
    {query.isError && <div role="alert" className="space-y-3 rounded-2xl border border-border bg-card p-6"><h3>Your notes could not load</h3>
      <button type="button" onClick={() => void query.refetch()} className="min-h-11 rounded-full bg-primary px-5 font-bold text-primary-foreground">Try again</button></div>}
    {query.isSuccess && items.length === 0 && <p className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-muted-foreground">No notes match. Try another filter or goal.</p>}
    <ul className="grid gap-3 sm:grid-cols-2">{items.map((n) => <li key={n.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <span className="flex items-center justify-between gap-2 text-xs"><b className="rounded-full bg-secondary px-2.5 py-0.5 text-primary">{noteKindLabel(n.kind, tutorName)}</b><span className="text-muted-foreground">{formatTutorTimestamp(n.updatedAt)}</span></span>
      <b className="break-words">{n.title}</b><p className="text-sm">{n.body}</p>
      {n.materialId && <Link href={`/learn/library/${encodeURIComponent(n.materialId)}`} className="mt-auto inline-flex min-h-10 items-center self-start rounded-full border border-border px-4 text-sm font-bold">Open the source</Link>}
    </li>)}</ul>
  </div>
}
