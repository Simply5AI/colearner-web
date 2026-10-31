'use client'

import Link from 'next/link'
import { useState } from 'react'
import { BookmarkPlus, Check } from 'lucide-react'
import { Button } from '@/components/design-system'
import { useLearnIdentity } from '@/components/learn/learn-common'
import { notesAllowedFor, type NoteKind, type StudyNote } from '@/lib/api/notes'
import { cn } from '@/lib/utils'
import { useNoteMutations } from './use-notes'

export interface SaveToNotesButtonProps {
  materialId: string
  kind: NoteKind
  title: string
  body: string
  conceptRef?: string
  sourceAnchorRef?: string
  onSaved?: (note: StudyNote) => void
  className?: string
}

/**
 * "Save to my pages". One tap saves a note, an analogy or a Co answer to the learner's pages. It saves once (the button
 * then says Saved with a link to My pages), and a failure is a plain sentence with the button still there to try again.
 * Hidden for the youngest learners: My pages are for ages 10 and up.
 */
export function SaveToNotesButton({ materialId, kind, title, body, conceptRef, sourceAnchorRef, onSaved, className }: SaveToNotesButtonProps) {
  const { band } = useLearnIdentity()
  const { create } = useNoteMutations()
  const [saved, setSaved] = useState(false)
  if (!notesAllowedFor(band)) return null
  const save = () => create.mutate({ materialId, kind, title, body, conceptRef, sourceAnchorRef }, { onSuccess: note => { setSaved(true); onSaved?.(note) } })
  if (saved) return <p role="status" data-testid="save-to-notes-saved" className={cn('inline-flex flex-wrap items-center gap-2 font-bold text-primary', className)}><Check size={18} aria-hidden="true" />Saved to My pages <Link href="/learn/notes" className="underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">Open My pages</Link></p>
  return <div className={cn('space-y-1', className)}>
    <Button variant="secondary" onClick={save} loading={create.isPending} data-testid="save-to-notes"><BookmarkPlus size={18} aria-hidden="true" />Save to my pages</Button>
    {create.error && <p role="alert" data-testid="save-to-notes-error" className="text-[length:var(--ds-small)] text-destructive">{create.error.message} Your page was not saved. You can try again.</p>}
  </div>
}
