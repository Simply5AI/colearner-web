import { z } from 'zod'
import { tutorLoopGet, type TutorRequestOptions } from './client'

/**
 * Contract §4 `GET /library` and `GET /notes` through the typed client. Statuses and source types are open strings
 * (the materials pipeline owns them), so the UI maps them with the helpers below instead of the schema rejecting new values.
 */
export const libraryGroupSchema = z.object({
  key: z.string(),
  title: z.string(),
  itemIds: z.array(z.string()),
})
export type LibraryGroup = z.infer<typeof libraryGroupSchema>

export const libraryItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  subjectId: z.string().nullable().optional(),
  subjectTitle: z.string().nullable().optional(),
  topicIds: z.array(z.string()).default([]),
  sourceType: z.string(),
  status: z.string(),
  sourceVersionRef: z.string().nullable().optional(),
  addedViaTutor: z.boolean().default(false),
  externalAttribution: z.unknown().nullable().optional(),
  createdAt: z.string(),
})
export type LibraryItem = z.infer<typeof libraryItemSchema>

export const libraryListSchema = z.object({
  items: z.array(libraryItemSchema),
  nextCursor: z.string().nullable(),
  total: z.number(),
  groups: z.array(libraryGroupSchema).optional(),
})
export type LibraryList = z.infer<typeof libraryListSchema>

export const tutorNoteKindSchema = z.enum(['NOTE', 'ANALOGY', 'CO_ANSWER'])
export type TutorNoteKind = z.infer<typeof tutorNoteKindSchema>

export const tutorNoteSchema = z.object({
  id: z.string(),
  kind: tutorNoteKindSchema,
  title: z.string(),
  body: z.string(),
  materialId: z.string().nullable().optional(),
  topicId: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type TutorNote = z.infer<typeof tutorNoteSchema>

export const tutorNotesListSchema = z.object({
  items: z.array(tutorNoteSchema),
  nextCursor: z.string().nullable(),
})
export type TutorNotesList = z.infer<typeof tutorNotesListSchema>

export type LibrarySort = 'NEWEST' | 'TITLE'
export type LibraryGroupBy = 'NONE' | 'SUBJECT' | 'TOPIC'

export interface LibraryFilters {
  goalId?: string | null
  subjectId?: string | null
  topicId?: string | null
  sourceType?: string | null
  query?: string
  recentDays?: 7 | null
  sort?: LibrarySort
  groupBy?: LibraryGroupBy
  cursor?: string | null
  limit?: number
}

export interface NotesFilters {
  goalId?: string | null
  materialId?: string | null
  topicId?: string | null
  query?: string
  kind?: TutorNoteKind | null
  cursor?: string | null
  limit?: number
}

export const LIBRARY_PAGE_SIZE = 12

export function listTutorLibrary(filters: LibraryFilters = {}, options?: Omit<TutorRequestOptions, 'method' | 'query'>) {
  return tutorLoopGet('/library', libraryListSchema, {
    goalId: filters.goalId ?? undefined,
    subjectId: filters.subjectId ?? undefined,
    topicId: filters.topicId ?? undefined,
    sourceType: filters.sourceType ?? undefined,
    query: filters.query?.trim() || undefined,
    recentDays: filters.recentDays ?? undefined,
    sort: filters.sort ?? 'NEWEST',
    groupBy: filters.groupBy ?? 'NONE',
    cursor: filters.cursor ?? undefined,
    limit: filters.limit ?? LIBRARY_PAGE_SIZE,
  }, options)
}

export function listTutorNotes(filters: NotesFilters = {}, options?: Omit<TutorRequestOptions, 'method' | 'query'>) {
  return tutorLoopGet('/notes', tutorNotesListSchema, {
    goalId: filters.goalId ?? undefined,
    materialId: filters.materialId ?? undefined,
    topicId: filters.topicId ?? undefined,
    query: filters.query?.trim() || undefined,
    kind: filters.kind ?? undefined,
    cursor: filters.cursor ?? undefined,
    limit: filters.limit ?? 20,
  }, options)
}

/* ---------- presentation helpers (copy from the design) ---------- */

export type MaterialStatusView = 'ready' | 'processing' | 'failed'

export function materialStatusView(status: string): MaterialStatusView {
  const value = status.toLowerCase()
  if (value.includes('fail') || value.includes('error') || value === 'rejected') return 'failed'
  if (value === 'ready' || value === 'complete' || value === 'completed' || value === 'processed' || value === 'new') return 'ready'
  return 'processing'
}

export type MaterialKindFilter = 'ALL' | 'PDF' | 'LINK' | 'VIDEO' | 'AUDIO'

export const MATERIAL_KIND_FILTERS: readonly { value: MaterialKindFilter; label: string; sourceType: string | null }[] = [
  { value: 'ALL', label: 'All', sourceType: null },
  { value: 'PDF', label: 'PDFs', sourceType: 'pdf' },
  { value: 'LINK', label: 'Links', sourceType: 'link' },
  { value: 'VIDEO', label: 'Video', sourceType: 'video' },
  { value: 'AUDIO', label: 'Audio', sourceType: 'audio' },
]

export function materialTypeLabel(sourceType: string): string {
  const value = sourceType.toLowerCase()
  if (value === 'pdf') return 'PDF'
  if (value === 'link' || value === 'url' || value === 'paper' || value === 'web') return 'Link'
  if (value === 'video' || value === 'youtube') return 'Video'
  if (value === 'audio' || value === 'recording') return 'Audio'
  if (value === 'image' || value === 'photo' || value === 'snap') return 'Photo'
  if (value === 'text' || value === 'paste') return 'Text'
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'File'
}

export const NOTE_KIND_FILTERS: readonly { value: TutorNoteKind | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'NOTE', label: 'My notes' },
  { value: 'ANALOGY', label: 'Analogies' },
  { value: 'CO_ANSWER', label: 'Tutor answers' },
]

export function noteKindLabel(kind: TutorNoteKind, tutorName = 'Co'): string {
  if (kind === 'NOTE') return 'My note'
  if (kind === 'ANALOGY') return 'Analogy'
  return `${tutorName}’s answer`
}
