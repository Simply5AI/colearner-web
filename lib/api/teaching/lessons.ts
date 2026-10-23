import { z } from 'zod'
import {
  bandFitSchema, studentLessonViewSchema, teacherLessonContentSchema, type LessonBand, type TeacherLessonContent,
} from './lesson-schema'
import { idempotent, parseResponse, type TeachingRequest } from './plans'

/*
 * B12 section 6.5. Lesson versions are immutable once published; edits go to one draft per (topic, variant). The owner's
 * detail carries the answer key (`check.correctOptionId`); the preview `view` is exactly what a learner receives and is
 * parsed with the STRICT learner schema, so an answer key in it is a parse failure.
 */
export type LessonVariant = 'STANDARD' | 'EASIER' | 'HARDER'
export const lessonVariants = ['STANDARD', 'EASIER', 'HARDER'] as const satisfies readonly LessonVariant[]
export const variantLabel: Record<LessonVariant, string> = { STANDARD: 'Standard', EASIER: 'Easier copy', HARDER: 'Harder copy' }
const iso = z.string().min(1)

export const lessonSummarySchema = z.object({
  variant: z.enum(lessonVariants), version: z.number().int().positive(), status: z.enum(['DRAFT', 'PUBLISHED', 'SUPERSEDED']),
  title: z.string(), stepCount: z.number().int().nonnegative(), origin: z.enum(['MANUAL', 'AI_DRAFT']), revision: z.number().int().nonnegative(),
  updatedAt: iso, publishedAt: iso.nullable(), authoredByMe: z.boolean(),
})
export type TeachingLessonSummary = z.infer<typeof lessonSummarySchema>
export const lessonDetailSchema = lessonSummarySchema.extend({
  content: teacherLessonContentSchema, sourceMaterialIds: z.array(z.string()), contentHash: z.string(),
  /** Present on a publish response: false when the draft was already published. */
  changed: z.boolean().optional(),
})
export type TeachingLessonDetail = Omit<z.infer<typeof lessonDetailSchema>, 'content'> & { content: TeacherLessonContent }
const versionsSchema = z.object({ versions: z.array(lessonSummarySchema) })
const previewSchema = z.object({ band: z.enum(['6-9', '10-13', '14-17']), view: studentLessonViewSchema, bandFit: z.array(bandFitSchema) })
export type LessonPreview = z.infer<typeof previewSchema>

export interface SaveDraftInput { expectedRevision: number | null; baseVersion?: number; content: TeacherLessonContent; sourceMaterialIds?: string[] }

const base = (planId: string, topicId: string) => `/plans/${encodeURIComponent(planId)}/topics/${encodeURIComponent(topicId)}/lessons`
const variantQuery = (variant: LessonVariant) => `variant=${variant}`

export function lessonsApi(request: TeachingRequest) {
  return {
    list: async (planId: string, topicId: string) => parseResponse(versionsSchema, await request<unknown>(base(planId, topicId))).versions,
    get: async (planId: string, topicId: string, version: number, variant: LessonVariant = 'STANDARD'): Promise<TeachingLessonDetail> =>
      parseResponse(lessonDetailSchema, await request<unknown>(`${base(planId, topicId)}/${version}?${variantQuery(variant)}`)),
    saveDraft: async (planId: string, topicId: string, variant: LessonVariant, input: SaveDraftInput): Promise<TeachingLessonDetail> =>
      parseResponse(lessonDetailSchema, await request<unknown>(`${base(planId, topicId)}/draft?${variantQuery(variant)}`, 'PUT', input, idempotent())),
    deleteDraft: async (planId: string, topicId: string, variant: LessonVariant, expectedRevision: number) => {
      await request<unknown>(`${base(planId, topicId)}/draft?${variantQuery(variant)}`, 'DELETE', { expectedRevision }, idempotent())
    },
    preview: async (planId: string, topicId: string, version: number, band: LessonBand, variant: LessonVariant = 'STANDARD'): Promise<LessonPreview> =>
      parseResponse(previewSchema, await request<unknown>(`${base(planId, topicId)}/${version}/preview?band=${band}&${variantQuery(variant)}`)),
    publish: async (planId: string, topicId: string, variant: LessonVariant, expectedRevision: number, key?: string): Promise<TeachingLessonDetail> =>
      parseResponse(lessonDetailSchema, await request<unknown>(`${base(planId, topicId)}/draft/publish?${variantQuery(variant)}`, 'POST', { expectedRevision }, idempotent(key))),
    duplicateAs: async (planId: string, topicId: string, variant: 'EASIER' | 'HARDER', fromVersion?: number): Promise<TeachingLessonDetail> =>
      parseResponse(lessonDetailSchema, await request<unknown>(`${base(planId, topicId)}/draft/duplicate-as`, 'POST', { variant, fromVariant: 'STANDARD', ...(fromVersion ? { fromVersion } : {}) }, idempotent())),
  }
}
export type LessonsApi = ReturnType<typeof lessonsApi>
