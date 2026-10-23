import { z } from 'zod'
import { TeachingApiError } from './core'
import { idempotent, parseResponse, type TeachingRequest } from './plans'

/* B12 section 6.4: topic materials (upload via presigned URL, link, photo) and the question-to-material link. */
export const materialTypes = ['PDF', 'SLIDES', 'DOCX', 'VIDEO_UPLOAD', 'VIDEO_LINK', 'EXTERNAL_LINK', 'RICH_TEXT', 'EXTENSION_CAPTURE', 'IMAGE'] as const
export type MaterialType = (typeof materialTypes)[number]
const iso = z.string().min(1)
export const teachingMaterialSchema = z.object({
  id: z.string().min(1), topicId: z.string().min(1), type: z.enum(materialTypes), title: z.string(), description: z.string().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED']), downloadable: z.boolean(), visibility: z.enum(['PREVIEW', 'SUBSCRIBER']), sortOrder: z.number().int(),
  externalUrl: z.string().nullable(), mimeType: z.string().nullable(), sizeBytes: z.number().nullable(), hasFile: z.boolean(), createdAt: iso, updatedAt: iso,
})
export type TeachingMaterial = z.infer<typeof teachingMaterialSchema>
export const linkedQuestionSchema = z.strictObject({
  id: z.string().min(1), type: z.string(), status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']), promptPreview: z.string().max(200), materialIds: z.array(z.string()),
})
export type LinkedQuestion = z.infer<typeof linkedQuestionSchema>
const uploadUrlSchema = z.object({ uploadUrl: z.string().url(), storageKey: z.string().min(1), expiresIn: z.number() })
const downloadUrlSchema = z.object({ url: z.string().url(), expiresIn: z.number() })
const materialsList = z.object({ items: z.array(teachingMaterialSchema) }).or(z.array(teachingMaterialSchema).transform(items => ({ items })))

export const materialTypeLabel: Record<MaterialType, string> = {
  PDF: 'PDF', SLIDES: 'Slides', DOCX: 'Document', VIDEO_UPLOAD: 'Video file', VIDEO_LINK: 'Video link', EXTERNAL_LINK: 'Web link',
  RICH_TEXT: 'Note', EXTENSION_CAPTURE: 'Captured page', IMAGE: 'Photo',
}
const MB = 1024 * 1024
export const sizeLimit: Partial<Record<MaterialType, number>> = { PDF: 50 * MB, SLIDES: 50 * MB, DOCX: 50 * MB, VIDEO_UPLOAD: 2048 * MB, IMAGE: 20 * MB }
export const imageMimeTypes = ['image/jpeg', 'image/png', 'image/webp'] as const

export interface FileCheck { type: MaterialType | null; problem: string | null }
/** Picks the material type from the file and refuses what the server would refuse (MATERIAL_TYPE_UNSUPPORTED, UPLOAD_TOO_LARGE). */
export function checkFile(file: { name: string; type: string; size: number }, asPhoto = false): FileCheck {
  const name = file.name.toLowerCase()
  let type: MaterialType | null = null
  if ((imageMimeTypes as readonly string[]).includes(file.type)) type = 'IMAGE'
  else if (asPhoto) return { type: null, problem: 'A photo must be a JPEG, PNG or WebP image.' }
  else if (file.type === 'application/pdf' || name.endsWith('.pdf')) type = 'PDF'
  else if (/\.(pptx?|key)$/.test(name) || file.type.includes('presentation') || file.type.includes('powerpoint')) type = 'SLIDES'
  else if (/\.docx?$/.test(name) || file.type.includes('wordprocessingml') || file.type === 'application/msword') type = 'DOCX'
  else if (file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/.test(name)) type = 'VIDEO_UPLOAD'
  if (!type) return { type: null, problem: 'That file type is not supported. Use a PDF, slides, a Word document, a video or a JPEG, PNG or WebP photo.' }
  if (file.size <= 0) return { type: null, problem: 'That file is empty.' }
  const limit = sizeLimit[type]!
  if (file.size > limit) return { type: null, problem: `That file is too large. ${materialTypeLabel[type]} files can be up to ${Math.round(limit / MB)} MB.` }
  return { type, problem: null }
}

const privateHost = /^(localhost|.*\.localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|\[?::1?\]?|\[?f[cd][0-9a-f]{2}:.*)$/i
export interface LinkCheck { ok: boolean; url: string; video: boolean; problem: string | null }
/** The same rules as the server: https only, at most 2048 characters, no credentials, no private or loopback host. */
export function checkLink(value: string): LinkCheck {
  const text = value.trim()
  const fail = (problem: string): LinkCheck => ({ ok: false, url: text, video: false, problem })
  if (!text) return fail('Paste a link that starts with https://.')
  if (text.length > 2048) return fail('That link is too long.')
  let url: URL
  try { url = new URL(text) } catch { return fail('That does not look like a link. It should start with https://.') }
  if (url.protocol !== 'https:') return fail('Only https:// links can be added.')
  if (url.username || url.password) return fail('Links with a user name or password cannot be added.')
  if (privateHost.test(url.hostname)) return fail('Links to private or local addresses cannot be added.')
  return { ok: true, url: url.toString(), video: /(^|\.)(youtube\.com|youtu\.be|vimeo\.com)$/i.test(url.hostname), problem: null }
}

export interface CreateMaterialInput {
  type: MaterialType; title: string; description?: string; externalUrl?: string; storageKey?: string; mimeType?: string; sizeBytes?: number
  richText?: string; visibility?: 'PREVIEW' | 'SUBSCRIBER'; downloadable?: boolean
}
const topicBase = (planId: string, topicId: string) => `/plans/${encodeURIComponent(planId)}/topics/${encodeURIComponent(topicId)}`
const materialBase = (planId: string, materialId: string) => `/plans/${encodeURIComponent(planId)}/materials/${encodeURIComponent(materialId)}`

export function materialsApi(request: TeachingRequest) {
  return {
    uploadUrl: async (planId: string, topicId: string, input: { type: MaterialType; filename: string; mimeType: string; sizeBytes: number }) =>
      parseResponse(uploadUrlSchema, await request<unknown>(`${topicBase(planId, topicId)}/materials/upload-url`, 'POST', input, idempotent())),
    create: async (planId: string, topicId: string, input: CreateMaterialInput, key?: string) =>
      parseResponse(teachingMaterialSchema, await request<unknown>(`${topicBase(planId, topicId)}/materials`, 'POST', input, idempotent(key))),
    update: async (planId: string, materialId: string, input: { title?: string; description?: string; visibility?: 'PREVIEW' | 'SUBSCRIBER'; downloadable?: boolean }) =>
      parseResponse(teachingMaterialSchema, await request<unknown>(materialBase(planId, materialId), 'PATCH', input, idempotent())),
    publish: async (planId: string, materialId: string) =>
      parseResponse(teachingMaterialSchema, await request<unknown>(`${materialBase(planId, materialId)}/publish`, 'POST', {}, idempotent())),
    remove: async (planId: string, materialId: string) => { await request<unknown>(materialBase(planId, materialId), 'DELETE', undefined, idempotent()) },
    reorder: async (planId: string, topicId: string, items: { id: string; sortOrder: number }[]) =>
      parseResponse(materialsList, await request<unknown>(`${topicBase(planId, topicId)}/materials/reorder`, 'POST', { items }, idempotent())).items,
    downloadUrl: async (planId: string, materialId: string) => parseResponse(downloadUrlSchema, await request<unknown>(`${materialBase(planId, materialId)}/download-url`)),
    linkQuestion: async (planId: string, questionId: string, materialIds: string[]) =>
      parseResponse(linkedQuestionSchema, await request<unknown>(`/plans/${encodeURIComponent(planId)}/questions/${encodeURIComponent(questionId)}/materials`, 'PUT', { materialIds }, idempotent())),
  }
}
export type MaterialsApi = ReturnType<typeof materialsApi>

/** PUTs the file to the presigned URL with progress. A failure never loses the form: the caller keeps the file and the fields. */
export function putToPresignedUrl(url: string, file: Blob, contentType: string, onProgress?: (fraction: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const failed = (status: number) => new TeachingApiError(status || 503, 'The file could not be uploaded. Your details are still here; try again.')
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = event => { if (event.lengthComputable && onProgress) onProgress(event.loaded / event.total) }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(failed(xhr.status)))
    xhr.onerror = () => reject(failed(0))
    xhr.onabort = () => reject(failed(0))
    signal?.addEventListener('abort', () => xhr.abort())
    xhr.send(file)
  })
}
