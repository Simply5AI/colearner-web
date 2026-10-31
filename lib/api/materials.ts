'use client'

import { z } from 'zod'
import { materialRequest, MaterialApiError, MaterialSessionError } from './material-request'
import type { Material as PortableMaterial, MaterialConfig as PortableMaterialConfig, MaterialDetail as PortableMaterialDetail, MaterialImportRequest } from '@colearner/api-client'

export const sourceTypes = ['text', 'pdf', 'docx', 'pptx', 'image', 'audio', 'youtube', 'web', 'paper'] as const
export const materialStatuses = ['queued', 'processing', 'ready', 'failed', 'cancelled'] as const
const id = z.string().min(1)
const localPath = z.string().regex(/^\/learn\/[a-zA-Z0-9/_?=&%-]+$/)
const localLink = localPath.nullable()
/**
 * B08: the lesson link is either the local route (or null) of the 0.4.0 contract, or an actionable
 * `{ link, enabled, disabledReason }`. Both reduce to a usable local route or null, and the server's reason is kept
 * so the library can say why a lesson is not available instead of hiding the control.
 */
const lessonLink = z.union([localLink, z.object({ link: z.object({ route: z.literal('LESSON'), id: id.nullable(), planItemId: id.nullish() }).nullable(), enabled: z.boolean(), disabledReason: z.string().nullable() })])
export const materialSchema = z.object({
  id, title: z.string(), sourceType: z.enum(sourceTypes), subjectId: id.nullable(), subjectName: z.string(), planId: id.nullable(), planTitle: z.string().nullable(),
  createdAt: z.string(), updatedAt: z.string(), status: z.enum(materialStatuses), stage: z.enum(['reading', 'concepts', 'ready', 'failed', 'cancelled']), progress: z.number().min(0).max(100),
  jobId: id, sourceVersionRef: z.string().nullable(), concepts: z.array(z.object({ id, label: z.string() })),
  error: z.object({ code: z.string(), message: z.string(), retryable: z.boolean() }).nullable(),
  links: z.object({ reader: localLink, lesson: lessonLink, practice: localLink, original: z.string().nullish() }).transform(links => {
    const lesson = links.lesson
    if (lesson === null || typeof lesson === 'string') return { reader: links.reader, lesson, practice: links.practice, original: links.original ?? null, lessonDisabledReason: null as string | null }
    const route = lesson.enabled && lesson.link?.id && /^[a-zA-Z0-9_-]{1,128}$/.test(lesson.link.id) ? `/learn/lesson/new?materialId=${encodeURIComponent(lesson.link.id)}${lesson.link.planItemId && /^[a-zA-Z0-9_-]{1,128}$/.test(lesson.link.planItemId) ? `&planItemId=${encodeURIComponent(lesson.link.planItemId)}` : ''}` : null
    return { reader: links.reader, lesson: route, practice: links.practice, original: links.original ?? null, lessonDisabledReason: route ? null : lesson.disabledReason }
  }),
  actions: z.object({ retry: z.boolean(), cancel: z.boolean(), delete: z.boolean(), addToPlan: z.boolean() }),
}) satisfies z.ZodType<PortableMaterial>
export const materialConfigSchema = z.object({
  enabled: z.boolean(), band: z.enum(['kids', 'tweens', 'teens']),
  sources: z.array(z.object({ type: z.enum(sourceTypes), label: z.string(), available: z.boolean(), reason: z.string().nullable() })),
  limits: z.object({ maxFiles: z.number().int().positive(), maxPages: z.number().int().positive(), maxBytes: z.number().int().positive(), maxTextLength: z.number().int().positive(), dailyLimit: z.number().int().nonnegative().nullable(), usedToday: z.number().int().nonnegative() }),
  subjects: z.array(z.object({ id, name: z.string() })), plans: z.array(z.object({ id, title: z.string() })),
  faceRedaction: z.object({ verified: z.boolean() }), lessonsAvailable: z.boolean(), practiceAvailable: z.boolean(),
}) satisfies z.ZodType<MaterialConfig>
export const materialDetailSchema = materialSchema.extend({ source: z.object({ text: z.string(), anchors: z.array(z.unknown()) }).nullable(), analysis: z.unknown().nullable() }) satisfies z.ZodType<PortableMaterialDetail>
const pageSchema = z.object({ items: z.array(materialSchema), total: z.number().int().nonnegative(), page: z.number().int().positive(), limit: z.number().int().positive() })
const importedSchema = z.object({ items: z.array(materialSchema) })
export type Material = PortableMaterial
/** B08: `lessonsAvailable` is true only when the server says lessons truly work; the 0.4.0 contract type fixed it to false. */
export type MaterialConfig = Omit<PortableMaterialConfig, 'lessonsAvailable' | 'practiceAvailable'> & { lessonsAvailable: boolean; practiceAvailable: boolean }
/** The server's reason a lesson cannot start for this material, when it gave one. */
/** Whether the server holds an original file for this material (its path is never used directly; the viewer fetches through the same-origin boundary). */
export const hasOriginal = (material: Material): boolean => !!(material.links as { original?: string | null }).original
export const lessonDisabledReason = (material: Material): string | null => (material.links as { lessonDisabledReason?: string | null }).lessonDisabledReason ?? null
export type MaterialDetail = PortableMaterialDetail
export type SourceType = typeof sourceTypes[number]
export interface MaterialFilters { search?: string; subjectId?: string; sourceType?: string; status?: string; page?: number }
export type ImportMaterial = MaterialImportRequest
export const materialApi = {
  config: () => materialRequest('/config', materialConfigSchema),
  list: (filters: MaterialFilters) => {
    const params = new URLSearchParams({ limit: '20' })
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, String(value)) })
    return materialRequest(`?${params}`, pageSchema)
  },
  /** Original file bytes through the learner session (cookie-authenticated same-origin route). */
  original: async (materialId: string, signal?: AbortSignal): Promise<{ blob: Blob; type: string }> => {
    let response: Response
    try { response = await fetch(`/api/materials/${encodeURIComponent(materialId)}/original`, { cache: 'no-store', signal }) } catch (error) { if (signal?.aborted) throw error; throw new MaterialApiError(503, 'Material services are unavailable. Please try again.') }
    if (response.status === 404) throw new MaterialApiError(404, 'The original file is not available for this material.', 'ORIGINAL_UNAVAILABLE')
    if (response.status === 401) throw new MaterialSessionError('Your learning session has ended.')
    if (!response.ok) throw new MaterialApiError(response.status, 'The original file could not be opened right now. Please try again.')
    const blob = await response.blob()
    return { blob, type: response.headers.get('content-type') ?? blob.type }
  },
  detail: (materialId: string) => materialRequest(`/${encodeURIComponent(materialId)}`, materialDetailSchema),
  import: (metadata: ImportMaterial, files: File[] = []) => {
    if (files.length === 0) return materialRequest('/import', importedSchema, 'POST', metadata)
    const body = new FormData(); body.append('metadata', JSON.stringify(metadata)); files.forEach(file => body.append('files', file, file.name))
    return materialRequest('/import', importedSchema, 'POST', body)
  },
  retry: (materialId: string, idempotencyKey: string) => materialRequest(`/${encodeURIComponent(materialId)}/retry`, materialSchema, 'POST', { idempotencyKey }),
  cancel: (materialId: string) => materialRequest(`/${encodeURIComponent(materialId)}/cancel`, materialSchema, 'POST', {}),
  bulk: (action: 'delete' | 'addToPlan', ids: string[], planId?: string) => materialRequest('/bulk', z.object({ updatedIds: z.array(id) }), 'POST', { action, ids, ...(planId ? { planId } : {}) }),
}
export const pendingMaterial = (material: Pick<Material, 'status'>) => material.status === 'queued' || material.status === 'processing'
