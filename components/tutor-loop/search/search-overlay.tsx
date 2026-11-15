'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog } from '@base-ui/react/dialog'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, FileText, MessageCircle, NotebookPen, Search, X, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGoalFilter } from '@/lib/tutor-loop/goal-filter'
import { buildTutorHref } from '@/lib/tutor-loop/open-tutor'
import { isTutorResting } from '@/lib/api/tutor-loop/client'
import {
  SEARCH_CHIPS, SEARCH_GROUP_ORDER, SEARCH_MIN_LENGTH, searchGroupTitle, searchTutor,
  type SearchHit, type SearchKind,
} from '@/lib/api/tutor-loop/search'
import { useTutorShell } from '@/components/tutor-loop/shell/tutor-shell-context'

const icons: Record<SearchKind, LucideIcon> = { TOPIC: BookOpen, MATERIAL: FileText, NOTE: NotebookPen, CHAT: MessageCircle }

/** Typed target to an in-app route; ids only, never learner text. */
export function searchHitHref(hit: SearchHit): string {
  const t = hit.target
  if (t.kind === 'PLAN_TOPIC') return buildTutorHref({ kind: 'PLAN_TOPIC', planId: t.planId, topicId: t.topicId })
  if (t.kind === 'MATERIAL') return `/learn/library/${encodeURIComponent(t.materialId)}`
  if (t.kind === 'NOTE') return t.materialId ? `/learn/library/${encodeURIComponent(t.materialId)}` : '/learn?tab=notes'
  return `/learn/co/${encodeURIComponent(t.sessionId)}`
}

export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const { goalId } = useGoalFilter({ syncUrl: false })
  const { tutorName } = useTutorShell()
  const [text, setText] = useState('')
  const [debounced, setDebounced] = useState('')
  const [chip, setChip] = useState<SearchKind | 'ALL'>('ALL')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { const t = setTimeout(() => setDebounced(text.trim()), 250); return () => clearTimeout(t) }, [text])
  const ready = debounced.length >= SEARCH_MIN_LENGTH
  const kind = chip === 'ALL' ? null : chip
  const query = useQuery({
    queryKey: ['tutor-search', debounced, kind, goalId],
    queryFn: () => searchTutor({ q: debounced, kind, goalId }),
    enabled: ready, retry: false, staleTime: 15_000,
  })
  const go = (href: string) => { onClose(); router.push(href) }
  const groups = SEARCH_GROUP_ORDER
    .map((k) => ({ kind: k, items: (query.data?.items ?? []).filter((i) => i.kind === k) }))
    .filter((g) => g.items.length > 0)
  const empty = ready && query.isSuccess && groups.length === 0

  return <Dialog.Root open onOpenChange={(open) => { if (!open) onClose() }}>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/40" />
      <Dialog.Popup aria-label="Search everything" initialFocus={input}
        className="fixed inset-x-3 top-[8vh] z-50 mx-auto flex max-h-[80vh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-xl outline-none">
        <Dialog.Title className="sr-only">Search</Dialog.Title>
        <div className="flex items-center gap-2 border-b border-border p-3">
          <Search aria-hidden="true" className="size-5 text-muted-foreground" />
          <input ref={input} value={text} onChange={(e) => setText(e.target.value)} maxLength={120} aria-label="Search" autoComplete="off"
            placeholder="Search topics, material, notes and chats" className="min-h-11 flex-1 bg-transparent text-base outline-none" />
          <Dialog.Close aria-label="Close search" className="grid size-11 place-items-center rounded-xl hover:bg-muted"><X aria-hidden="true" className="size-5" /></Dialog.Close>
        </div>
        <div role="group" aria-label="Search in" className="flex flex-wrap gap-2 border-b border-border p-3">
          {SEARCH_CHIPS.map((c) => <button key={c.value} type="button" aria-pressed={chip === c.value} onClick={() => setChip(c.value)}
            className={cn('min-h-9 rounded-full border px-3 text-sm font-bold', chip === c.value ? 'border-primary bg-secondary text-primary' : 'border-border bg-background')}>{c.label}</button>)}
        </div>
        <div className="min-h-24 flex-1 overflow-y-auto p-2" aria-live="polite" data-testid="search-results">
          {!ready && <p className="p-4 text-sm text-muted-foreground">Type at least {SEARCH_MIN_LENGTH} letters to search.</p>}
          {ready && query.isFetching && !query.data && <p role="status" className="p-4 text-sm text-muted-foreground">Searching…</p>}
          {query.isError && <div role="alert" className="space-y-2 p-4">
            <p>{isTutorResting(query.error) ? 'Search is resting for a moment.' : 'Search is not available right now.'}</p>
            <button type="button" onClick={() => void query.refetch()} className="min-h-10 rounded-full border border-border px-4 font-bold">Try again</button>
          </div>}
          {groups.map((g) => <section key={g.kind} aria-label={searchGroupTitle(g.kind, tutorName)}>
            <h2 className="px-3 pb-1 pt-3 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">{searchGroupTitle(g.kind, tutorName)}</h2>
            <ul>{g.items.map((hit) => { const Icon = icons[hit.kind]; return <li key={`${hit.kind}-${hit.id}`}>
              <button type="button" onClick={() => go(searchHitHref(hit))} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-start hover:bg-muted">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><Icon aria-hidden="true" className="size-4" /></span>
                <span className="min-w-0"><b className="block truncate">{hit.title}</b>{hit.subtitle && <span className="block truncate text-sm text-muted-foreground">{hit.subtitle}</span>}</span>
              </button></li> })}</ul>
          </section>)}
          {empty && <div className="space-y-3 p-4">
            <p className="text-muted-foreground">Nothing found for “{debounced}”.</p>
            <button type="button" onClick={() => go(buildTutorHref({ kind: 'GLOBAL' }))} className="min-h-11 rounded-full bg-primary px-4 font-bold text-primary-foreground">Ask {tutorName} instead</button>
          </div>}
        </div>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
}
