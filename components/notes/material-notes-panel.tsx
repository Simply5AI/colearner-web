'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button, ErrorState, LoadingState } from '@/components/design-system'
import type { LearnBand } from '@/lib/api/learn'
import { NOTE_BODY_MAX, NOTE_TITLE_MAX, notesAllowedFor } from '@/lib/api/notes'
import { NoteCard } from './note-card'
import { useNoteMutations, useNotes } from './use-notes'

/** The reader's "My pages" rail: this material's pages, plus a small form for a new one. Mounted by the reader. */
export function MaterialNotesPanel({ materialId, band }: { materialId: string; band: LearnBand }) {
  const allowed = notesAllowedFor(band)
  const notes = useNotes({ materialId }, allowed)
  const { create } = useNoteMutations()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  if (!allowed) return <p data-testid="notes-unavailable" className="rounded-[var(--radius)] border border-border bg-card p-4">My pages are for ages 10 and up. Ask a grown-up to help you keep notes.</p>
  const add = () => create.mutate({ materialId, kind: 'NOTE', title: title.trim() || body.trim().slice(0, 60), body }, { onSuccess: () => { setTitle(''); setBody(''); setOpen(false) } })
  const items = notes.data?.items ?? []
  return <section aria-label="My pages for this material" data-testid="material-notes" className="space-y-4">
    {open
      ? <form onSubmit={event => { event.preventDefault(); if (body.trim()) add() }} className="space-y-3 rounded-[var(--radius)] border border-border bg-card p-3">
        <div className="ds-field"><label htmlFor={`new-note-title-${materialId}`}>Title (optional)</label><input id={`new-note-title-${materialId}`} className="ds-input" value={title} maxLength={NOTE_TITLE_MAX} onChange={event => setTitle(event.target.value)} /></div>
        <div className="ds-field"><label htmlFor={`new-note-body-${materialId}`}>Write a page</label><textarea id={`new-note-body-${materialId}`} rows={5} className="ds-input" value={body} maxLength={NOTE_BODY_MAX} onChange={event => setBody(event.target.value)} /></div>
        <div className="flex flex-wrap gap-2"><Button type="submit" loading={create.isPending} disabled={!body.trim()}>Save page</Button><Button variant="secondary" onClick={() => { setOpen(false); create.reset() }}>Cancel</Button></div>
        {create.error && <p role="alert" className="text-[length:var(--ds-small)] text-destructive">{create.error.message} Your page is still here. You can try again.</p>}
      </form>
      : <Button variant="secondary" onClick={() => setOpen(true)} data-testid="add-note"><Plus size={18} aria-hidden="true" />Add a page</Button>}
    {notes.isPending && <LoadingState label="Opening your pages…" />}
    {notes.error && <ErrorState band={band} title="Your pages did not open" description={notes.error.message} action={<Button onClick={() => void notes.refetch()}>Try again</Button>} />}
    {notes.data && items.length === 0 && <p data-testid="notes-empty" className="text-muted-foreground">No pages for this material yet. Write one, or save an answer from Co.</p>}
    <ul className="space-y-3">{items.map(note => <li key={note.id}><NoteCard note={note} /></li>)}</ul>
  </section>
}
