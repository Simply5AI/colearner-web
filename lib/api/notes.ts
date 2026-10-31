import { z } from 'zod'
import { learnRequest } from './learn-request'

/*
 * DEMO-B learner notes ("My pages"). Contract: agents/contracts/DEMO-student-contracts.md, section B.
 * Learner-private. Goes through the same-origin learner BFF (`/api/learn/notes`), which forwards the learner session.
 * The UI never shows server text for a failure: `LearnApiError.message` is already a safe learner message.
 */
export const noteKinds = ['NOTE', 'ANALOGY', 'CO_ANSWER'] as const
export type NoteKind = (typeof noteKinds)[number]
export const noteKindLabels: Record<NoteKind, string> = { NOTE: 'My note', ANALOGY: 'Analogy', CO_ANSWER: 'Co’s answer' }
export const NOTE_TITLE_MAX = 120
export const NOTE_BODY_MAX = 8000

export interface StudyNote {
  id: string
  materialId: string | null
  kind: NoteKind
  title: string
  body: string
  conceptRef: string | null
  sourceAnchorRef: string | null
  createdAt: string
  updatedAt: string
}
export interface NewStudyNote {
  materialId?: string | null
  kind: NoteKind
  title: string
  body: string
  conceptRef?: string | null
  sourceAnchorRef?: string | null
}
export interface NoteFilters { materialId?: string; kind?: NoteKind }

const note = z.object({
  id: z.string().min(1),
  materialId: z.string().nullable().optional().transform(value => value ?? null),
  kind: z.enum(noteKinds),
  title: z.string(),
  body: z.string(),
  conceptRef: z.string().nullable().optional().transform(value => value ?? null),
  sourceAnchorRef: z.string().nullable().optional().transform(value => value ?? null),
  createdAt: z.string(),
  updatedAt: z.string(),
}) satisfies z.ZodType<StudyNote, unknown>
const list = z.object({ items: z.array(note) })

/** Trims to the server limits so a long Co answer or title can still be saved. */
export function fitNote(input: NewStudyNote): NewStudyNote {
  const title = input.title.trim().replace(/\s+/g, ' ').slice(0, NOTE_TITLE_MAX).trim() || 'My page'
  return { ...input, title, body: input.body.trim().slice(0, NOTE_BODY_MAX) }
}

export const notesApi = {
  list: (filters: NoteFilters = {}) => {
    const params = new URLSearchParams()
    if (filters.materialId) params.set('materialId', filters.materialId)
    if (filters.kind) params.set('kind', filters.kind)
    const query = params.toString()
    return learnRequest(`/notes${query ? `?${query}` : ''}`, list)
  },
  create: (input: NewStudyNote) => {
    const { materialId, conceptRef, sourceAnchorRef, ...rest } = fitNote(input)
    return learnRequest('/notes', note, 'POST', { ...rest, ...(materialId ? { materialId } : {}), ...(conceptRef ? { conceptRef } : {}), ...(sourceAnchorRef ? { sourceAnchorRef } : {}) })
  },
  update: (id: string, changes: { title?: string; body?: string }) => learnRequest(`/notes/${encodeURIComponent(id)}`, note, 'PATCH', changes),
  remove: (id: string) => learnRequest(`/notes/${encodeURIComponent(id)}`, z.undefined(), 'DELETE'),
}

export const notesKeys = {
  root: ['learn-notes'] as const,
  list: (actor: string, filters: NoteFilters) => ['learn-notes', actor, 'list', filters] as const,
}
/** My pages are for ages 10 and up (the lesson-note rule). The server enforces it; the UI simply does not offer them to 6-9. */
export const notesAllowedFor = (band: 'kids' | 'tweens' | 'teens' | 'adults' | string | null | undefined) => band !== 'kids'
