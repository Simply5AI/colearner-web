import { z } from 'zod'
import { tutorLoopGet, type TutorRequestOptions } from './client'

/** Contract §4 `GET /search`: typed target and one bounded subtitle; never a raw URL or chat snippet. */
export const searchKindSchema = z.enum(['TOPIC', 'MATERIAL', 'NOTE', 'CHAT'])
export type SearchKind = z.infer<typeof searchKindSchema>

export const searchTargetSchema = z.union([
  z.object({ kind: z.literal('PLAN_TOPIC'), planId: z.string(), topicId: z.string() }),
  z.object({ kind: z.literal('MATERIAL'), materialId: z.string(), passageRef: z.string().nullable().optional() }),
  z.object({ kind: z.literal('NOTE'), noteId: z.string(), materialId: z.string().nullable().optional() }),
  z.object({ kind: z.literal('TUTOR_SESSION'), sessionId: z.string() }),
])
export type SearchTarget = z.infer<typeof searchTargetSchema>

export const searchHitSchema = z.object({
  id: z.string(),
  kind: searchKindSchema,
  title: z.string(),
  subtitle: z.string().nullable().optional(),
  target: searchTargetSchema,
})
export type SearchHit = z.infer<typeof searchHitSchema>

export const searchResultSchema = z.object({
  items: z.array(searchHitSchema),
  nextCursor: z.string().nullable(),
})
export type SearchResult = z.infer<typeof searchResultSchema>

export const SEARCH_MIN_LENGTH = 2
export const SEARCH_MAX_LENGTH = 120

export function searchTutor(
  input: { q: string; kind?: SearchKind | null; goalId?: string | null; cursor?: string | null },
  options?: Omit<TutorRequestOptions, 'method' | 'query'>,
) {
  return tutorLoopGet('/search', searchResultSchema, {
    q: input.q.trim().slice(0, SEARCH_MAX_LENGTH),
    kind: input.kind ?? undefined,
    goalId: input.goalId ?? undefined,
    cursor: input.cursor ?? undefined,
  }, options)
}

export const SEARCH_CHIPS: readonly { value: SearchKind | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Everything' },
  { value: 'TOPIC', label: 'Topics' },
  { value: 'MATERIAL', label: 'Material' },
  { value: 'NOTE', label: 'Notes' },
  { value: 'CHAT', label: 'Chats' },
]

export const SEARCH_GROUP_ORDER: readonly SearchKind[] = ['TOPIC', 'MATERIAL', 'NOTE', 'CHAT']

export function searchGroupTitle(kind: SearchKind, tutorName = 'Co'): string {
  if (kind === 'TOPIC') return 'Topics'
  if (kind === 'MATERIAL') return 'Material'
  if (kind === 'NOTE') return 'Notes'
  return `Chats with ${tutorName}`
}
