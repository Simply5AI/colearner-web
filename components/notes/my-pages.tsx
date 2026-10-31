'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { NotebookPen } from 'lucide-react'
import { Button, EmptyState, ErrorState, LoadingState, Select } from '@/components/design-system'
import { LearnFrame, useLearnIdentity } from '@/components/learn/learn-common'
import { MaterialIdentityProvider } from '@/components/materials/material-identity'
import { materialKeys, useMaterialConfig } from '@/components/materials/material-common'
import { materialApi } from '@/lib/api/materials'
import { noteKindLabels, noteKinds, notesAllowedFor, type NoteFilters, type NoteKind } from '@/lib/api/notes'
import { NoteCard } from './note-card'
import { useNotes } from './use-notes'

/** "My pages": everything the learner kept, across all materials. Filter by material and kind; edit, delete, jump back to the reader. */
export function MyPages() {
  const { actor, band: identityBand } = useLearnIdentity()
  return <MaterialIdentityProvider scope={actor}><MyPagesBody band={identityBand} /></MaterialIdentityProvider>
}

function MyPagesBody({ band: identityBand }: { band: 'kids' | 'tweens' | 'teens' | null }) {
  const config = useMaterialConfig()
  const band = config.data?.band ?? identityBand ?? 'teens'
  const allowed = notesAllowedFor(band)
  const [materialId, setMaterialId] = useState('')
  const [kind, setKind] = useState<NoteKind | ''>('')
  const filters: NoteFilters = { ...(materialId ? { materialId } : {}), ...(kind ? { kind } : {}) }
  const notes = useNotes(filters, allowed && !!config.data)
  const materials = useQuery({ queryKey: materialKeys.list(config.actor, { notes: true }), queryFn: () => materialApi.list({ page: 1 }), enabled: !!config.data && allowed, retry: false, staleTime: 0, gcTime: 0 })
  const titles = new Map((materials.data?.items ?? []).map(material => [material.id, material.title]))
  const items = notes.data?.items ?? []
  const filtered = !!materialId || !!kind
  return <LearnFrame band={band} label="My pages">
    <header className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Your learning</p>
      <h1 className="text-3xl sm:text-4xl">My pages</h1>
      <p className="max-w-2xl text-muted-foreground">Your notes, the answers you saved from Co, and the analogies that helped. Only you can see these.</p>
    </header>
    {config.isPending && <LoadingState label="Opening your pages…" />}
    {config.error && <ErrorState band={band} title="My pages did not open" description={config.error.message} action={<div className="flex flex-wrap justify-center gap-3"><Button onClick={() => void config.refetch()}>Try again</Button><Link href="/learn/library" className="ds-button ds-button-secondary">Go to your library</Link></div>} />}
    {config.data && !allowed && <EmptyState band={band} title="My pages are for ages 10 and up" description="Ask a grown-up to help you keep notes. You can still read your material and ask Co questions." action={<Link href="/learn/library" className="ds-button ds-button-primary">Go to your library</Link>} />}
    {config.data && allowed && <>
      <div className="ds-card grid gap-4 sm:grid-cols-2" role="search" aria-label="Filter my pages">
        <Select label="Material" value={materialId} onChange={event => setMaterialId(event.target.value)}>
          <option value="">All materials</option>
          {[...titles].map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </Select>
        <Select label="Kind of page" value={kind} onChange={event => setKind(event.target.value as NoteKind | '')}>
          <option value="">All kinds</option>
          {noteKinds.map(value => <option key={value} value={value}>{noteKindLabels[value]}</option>)}
        </Select>
      </div>
      {notes.isPending && <LoadingState label="Opening your pages…" />}
      {notes.error && <ErrorState band={band} title="Your pages did not open" description={notes.error.message} action={<Button onClick={() => void notes.refetch()}>Try again</Button>} />}
      {notes.data && items.length === 0 && <EmptyState band={band} title={filtered ? 'No pages match' : 'No pages yet'}
        description={filtered ? 'Try another material or kind.' : 'Write a note in the reader, or press Save to my pages on an answer from Co.'}
        action={filtered ? <Button variant="secondary" onClick={() => { setMaterialId(''); setKind('') }}>Show all pages</Button> : <Link href="/learn/library" className="ds-button ds-button-primary"><NotebookPen size={18} aria-hidden="true" />Open your library</Link>} />}
      {items.length > 0 && <>
        <p className="text-sm text-muted-foreground" data-testid="notes-count">{items.length} {items.length === 1 ? 'page' : 'pages'}</p>
        <ul className="grid gap-4 md:grid-cols-2">{items.map(note => <li key={note.id}><NoteCard note={note} showMaterial materialTitle={note.materialId ? titles.get(note.materialId) ?? null : null} /></li>)}</ul>
      </>}
    </>}
  </LearnFrame>
}
