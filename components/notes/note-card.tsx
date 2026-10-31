'use client'

import Link from 'next/link'
import { useState } from 'react'
import { BookOpen, Lightbulb, MessageCircle, Pencil, StickyNote, Trash2 } from 'lucide-react'
import { Button, Card } from '@/components/design-system'
import { NOTE_BODY_MAX, NOTE_TITLE_MAX, noteKindLabels, type NoteKind, type StudyNote } from '@/lib/api/notes'
import { useNoteMutations } from './use-notes'

const kindIcon: Record<NoteKind, typeof StickyNote> = { NOTE: StickyNote, ANALOGY: Lightbulb, CO_ANSWER: MessageCircle }

/** One page: read, edit in place, delete after a plain confirmation, and a way back to the material it belongs to. */
export function NoteCard({ note, materialTitle, showMaterial = false }: { note: StudyNote; materialTitle?: string | null; showMaterial?: boolean }) {
  const { update, remove } = useNoteMutations()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body)
  const Icon = kindIcon[note.kind]
  const startEdit = () => { setTitle(note.title); setBody(note.body); setEditing(true); setConfirming(false) }
  const save = () => update.mutate({ id: note.id, title: title.trim(), body: body.trim() }, { onSuccess: () => setEditing(false) })
  const invalid = !title.trim() || !body.trim()
  const error = update.error ?? remove.error
  return <Card data-testid="note-card" data-kind={note.kind} className="min-w-0 space-y-3">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <span className="ds-pill border border-border"><Icon size={16} aria-hidden="true" />{noteKindLabels[note.kind]}</span>
      <time dateTime={note.createdAt} className="text-[length:var(--ds-small)] text-muted-foreground">{new Date(note.createdAt).toLocaleDateString()}</time>
    </header>
    {editing ? <div className="space-y-3">
      <div className="ds-field"><label htmlFor={`note-title-${note.id}`}>Title</label><input id={`note-title-${note.id}`} className="ds-input" value={title} maxLength={NOTE_TITLE_MAX} onChange={event => setTitle(event.target.value)} /></div>
      <div className="ds-field"><label htmlFor={`note-body-${note.id}`}>Your page</label><textarea id={`note-body-${note.id}`} rows={6} className="ds-input" value={body} maxLength={NOTE_BODY_MAX} onChange={event => setBody(event.target.value)} /></div>
      <div className="flex flex-wrap gap-2"><Button onClick={save} loading={update.isPending} disabled={invalid}>Save changes</Button><Button variant="secondary" onClick={() => { setEditing(false); update.reset() }}>Cancel</Button></div>
    </div> : <>
      <h3 className="break-words text-lg font-bold">{note.title}</h3>
      <p className="max-w-prose whitespace-pre-line break-words leading-relaxed" data-testid="note-body">{note.body}</p>
      <div className="flex flex-wrap items-center gap-2">
        {note.materialId && <Link href={`/learn/library/${encodeURIComponent(note.materialId)}`} className="ds-button ds-button-ghost"><BookOpen size={18} aria-hidden="true" />{showMaterial && materialTitle ? `Open ${materialTitle}` : 'Open in reader'}</Link>}
        <Button variant="ghost" onClick={startEdit}><Pencil size={18} aria-hidden="true" />Edit<span className="sr-only"> {note.title}</span></Button>
        {confirming
          ? <span role="group" aria-label="Confirm delete" className="inline-flex flex-wrap items-center gap-2"><span className="font-semibold">Delete this page?</span><Button onClick={() => remove.mutate(note.id)} loading={remove.isPending}>Yes, delete</Button><Button variant="secondary" onClick={() => setConfirming(false)}>Keep it</Button></span>
          : <Button variant="ghost" onClick={() => { setConfirming(true); remove.reset() }}><Trash2 size={18} aria-hidden="true" />Delete<span className="sr-only"> {note.title}</span></Button>}
      </div>
    </>}
    {error && <p role="alert" className="text-[length:var(--ds-small)] text-destructive">{error.message}</p>}
  </Card>
}
