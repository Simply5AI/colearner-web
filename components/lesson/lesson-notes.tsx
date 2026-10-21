'use client'

import { useId, useRef, useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { NotebookPen, Trash2 } from 'lucide-react'
import { Button } from '@/components/design-system'
import type { LearnBand } from '@/lib/api/learn'
import { isAccessChangedError, lessonApi, lessonErrorMessage, type LessonNote } from '@/lib/api/lesson'

export const NOTE_LIMIT = 500

/** Server writes for private notes. Callers refresh the lesson afterwards, so the list is always the server's. */
export function useLessonNotes(lessonId: string, refresh: () => Promise<void>) {
  const add = useMutation({
    mutationFn: (body: { stepIndex: number; text?: string; termIndex?: number }) => lessonApi.addNote(lessonId, body),
    retry: false, onSuccess: refresh, onError: error => { if (isAccessChangedError(error)) void refresh() },
  })
  const remove = useMutation({ mutationFn: (noteId: string) => lessonApi.deleteNote(lessonId, noteId), retry: false, onSuccess: refresh, onError: error => { if (isAccessChangedError(error)) void refresh() } })
  return { add, remove }
}
export type LessonNotesApi = ReturnType<typeof useLessonNotes>

/**
 * F-L7-07 revision notes, for ages 10 to 17 only (the player never renders this for 6-9). Notes are private to the
 * learner, at most 500 characters, and a draft stays in the box when saving fails.
 */
export function NotesPanel({ band, stepIndex, notes, api }: { band: LearnBand; stepIndex: number; notes: readonly LessonNote[]; api: LessonNotesApi }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const field = useRef<HTMLTextAreaElement>(null)
  const panelId = useId()
  const label = band === 'teens' ? 'Save to revision notes' : 'My notes'
  const trimmed = draft.trim()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!trimmed || api.add.isPending) return
    api.add.mutate({ stepIndex, text: trimmed.slice(0, NOTE_LIMIT) }, { onSuccess: () => setDraft('') })
  }
  const sorted = [...notes].sort((a, b) => a.stepIndex - b.stepIndex || a.createdAt.localeCompare(b.createdAt))
  return <section aria-label="Notes" className="space-y-3" data-testid="notes">
    <Button variant="secondary" aria-expanded={open} aria-controls={panelId} onClick={() => { setOpen(value => !value); if (!open) setTimeout(() => field.current?.focus(), 0) }}>
      <NotebookPen size={18} aria-hidden="true" />{label}{notes.length > 0 && <span className="ds-pill">{notes.length}</span>}
    </Button>
    {!open && api.add.error && <p role="alert" className="ds-field-error">{lessonErrorMessage(api.add.error, 'Your note could not be saved. Try again.')}</p>}
    {open && <div id={panelId} className="space-y-4 rounded-[var(--radius)] border border-border bg-card p-4">
      <form onSubmit={submit} className="space-y-3" noValidate>
        <div className="ds-field">
          <label htmlFor={`${panelId}-text`}>Write a note about step {stepIndex + 1}</label>
          <textarea ref={field} id={`${panelId}-text`} className="ds-input min-h-24 resize-y" value={draft} maxLength={NOTE_LIMIT} onChange={event => setDraft(event.target.value)} aria-describedby={`${panelId}-count`} />
          <p id={`${panelId}-count`} className="ds-field-hint">{draft.length} of {NOTE_LIMIT} characters. Only you can see your notes.</p>
        </div>
        {api.add.error && <p role="alert" className="ds-field-error">{lessonErrorMessage(api.add.error, 'Your note could not be saved. It is still in the box, so you can try again.')}</p>}
        <Button type="submit" disabled={!trimmed} loading={api.add.isPending}>Save note</Button>
      </form>
      {sorted.length > 0 ? <ul aria-label="Your notes" className="space-y-2">{sorted.map(note => <li key={note.id} className="flex items-start gap-3 rounded-[var(--radius)] bg-muted p-3">
        <div className="min-w-0 flex-1"><p className="text-[length:var(--ds-caption)] font-bold uppercase tracking-wide text-muted-foreground">Step {note.stepIndex + 1}</p><p className="whitespace-pre-wrap break-words">{note.text}</p></div>
        <Button variant="ghost" aria-label={`Delete note from step ${note.stepIndex + 1}: ${note.text.slice(0, 40)}`} disabled={api.remove.isPending && api.remove.variables === note.id} onClick={() => api.remove.mutate(note.id)}><Trash2 size={18} aria-hidden="true" /></Button>
      </li>)}</ul> : <p className="text-muted-foreground">No notes yet.</p>}
      {api.remove.error && <p role="alert" className="ds-field-error">{lessonErrorMessage(api.remove.error, 'That note could not be deleted. Try again.')}</p>}
    </div>}
  </section>
}
