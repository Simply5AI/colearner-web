import { z } from 'zod'
import { type TeachingMethod } from './core'
import { bandSchema, idempotent, parseResponse, type TeachingRequest } from './plans'

/*
 * B13 sections 6.6 and 6.1 (worksheets). Deterministic: the teacher picks PUBLISHED questions, or "Fill for me" picks them on the
 * server (D6). The A4 page and the answer key are rendered in the web app from `render`. Answer-key fields are parsed ONLY by
 * `answerKeyRenderSchema`; the student schema strips them even if a server bug sent them, so they can never reach the print page.
 */
const id = z.string().min(1).max(256)
const iso = z.string().min(1)
const count = z.number().int().nonnegative()

export const WORKSHEET_MAX_ITEMS = 60
export const worksheetStatusSchema = z.enum(['DRAFT', 'FINAL', 'ARCHIVED'])
export type WorksheetStatus = z.infer<typeof worksheetStatusSchema>
export const difficultySchema = z.enum(['EASY', 'MEDIUM', 'HARD'])
export type Difficulty = z.infer<typeof difficultySchema>
export const difficultyLabel: Record<Difficulty, string> = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' }

export const worksheetItemSchema = z.object({
  questionId: id, questionVersion: z.number().int().positive(), sortOrder: z.number().int().nonnegative(), points: z.number().int().min(0).max(100),
})
export type WorksheetItem = z.infer<typeof worksheetItemSchema>
export const worksheetSettingsSchema = z.object({ showHints: z.boolean(), answerLines: z.number().int().min(0).max(12), includeName: z.boolean() })
export type WorksheetSettings = z.infer<typeof worksheetSettingsSchema>
export const DEFAULT_SETTINGS: WorksheetSettings = { showHints: false, answerLines: 3, includeName: true }

export const worksheetSchema = z.object({
  id, planId: id.optional(), title: z.string().max(120), instructions: z.string().max(1000).default(''),
  targetBand: bandSchema.nullable().optional(),
  status: worksheetStatusSchema, version: z.number().int().nonnegative(),
  items: z.array(worksheetItemSchema).max(WORKSHEET_MAX_ITEMS), settings: worksheetSettingsSchema,
  finalizedAt: iso.nullable().optional(), createdAt: iso.optional(), updatedAt: iso.optional(),
})
export type Worksheet = z.infer<typeof worksheetSchema>
/** The platform may send the sheet bare or as `{ worksheet }`; both are accepted. */
const worksheetResponse = z.preprocess(value => (value && typeof value === 'object' && 'worksheet' in value ? (value as { worksheet: unknown }).worksheet : value), worksheetSchema)
/** `GET /worksheets/:id`: items enriched for display. `available` is false when the question is no longer published (a draft sheet) or its frozen version is gone. */
export const worksheetDetailItemSchema = worksheetItemSchema.extend({
  promptPreview: z.string(), type: z.string().nullable(), difficulty: z.string().nullable(), topicTitle: z.string(), available: z.boolean(),
})
export type WorksheetDetailItem = z.infer<typeof worksheetDetailItemSchema>
const worksheetDetailSchema = z.object({ worksheet: worksheetSchema.extend({ items: z.array(worksheetDetailItemSchema).max(WORKSHEET_MAX_ITEMS) }) })
export type WorksheetDetail = z.infer<typeof worksheetDetailSchema>['worksheet']
const worksheetListSchema = z.object({ items: z.array(worksheetSchema), nextCursor: z.string().nullable().optional() })
const fillSchema = z.object({ worksheet: worksheetSchema, shortfall: count })
export type FillResult = z.infer<typeof fillSchema>

/* ---------- bank (the slice of GET /questions the picker needs; PUBLISHED only, no answer key) ---------- */
export const bankQuestionSchema = z.object({
  id, planId: id.optional(), topicId: id, topicTitle: z.string().nullable().optional(),
  type: z.string(), difficulty: difficultySchema.nullable(), status: z.string(), version: z.number().int().positive(),
  promptPreview: z.string(), authorOnly: z.boolean().optional(),
  successRate: z.object({ value: z.number().min(0).max(1), attempts: count }).nullable().optional(),
})
export type BankQuestion = z.infer<typeof bankQuestionSchema>
const bankListSchema = z.object({ items: z.array(bankQuestionSchema), nextCursor: z.string().nullable().optional() })
export interface BankFilters { topicId?: string; type?: string; difficulty?: string; q?: string; cursor?: string | null }

/* ---------- render ---------- */
const optionSchema = z.object({ id, label: z.string() })
const mediaSchema = z.object({ optionImages: z.record(z.string(), z.string()).optional(), language: z.string().optional(), starterCode: z.string().optional() }).nullable()
const hintSchema = z.object({ rung: z.enum(['NUDGE', 'HINT', 'SIMILAR_EXAMPLE']), text: z.string() })
const renderWorksheetSchema = z.object({
  id, title: z.string(), instructions: z.string().default(''), status: worksheetStatusSchema, settings: worksheetSettingsSchema,
  planTitle: z.string().nullable().optional(), version: z.number().int().nonnegative().optional(), finalizedAt: iso.nullable().optional(),
})
const baseItem = z.object({
  number: z.number().int().positive(), points: z.number().int().min(0), type: z.string(), prompt: z.string(),
  options: z.array(optionSchema).nullable(), media: mediaSchema.optional().default(null), hints: z.array(hintSchema).optional(), answerLines: z.number().int().min(0).max(12),
})
export const correctAnswerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('option'), optionId: z.string() }),
  z.object({ kind: z.literal('options'), optionIds: z.array(z.string()) }),
  z.object({ kind: z.literal('blanks'), blanks: z.array(z.array(z.string())) }),
  z.object({ kind: z.literal('order'), optionIds: z.array(z.string()) }),
  z.object({ kind: z.literal('text'), sample: z.string() }),
  z.object({ kind: z.literal('code'), sample: z.string(), language: z.string() }),
])
export type CorrectAnswer = z.infer<typeof correctAnswerSchema>
/** Strips unknown keys on purpose: a student render can never carry `correctAnswer`, `explanation` or `rubric` into the page. */
export const studentRenderSchema = z.object({ worksheet: renderWorksheetSchema, items: z.array(baseItem) })
export const answerKeyRenderSchema = z.object({
  worksheet: renderWorksheetSchema,
  items: z.array(baseItem.extend({ correctAnswer: correctAnswerSchema, explanation: z.string().default(''), rubric: z.string().nullable().default(null) })),
})
export type StudentRender = z.infer<typeof studentRenderSchema>
export type AnswerKeyRender = z.infer<typeof answerKeyRenderSchema>
export type StudentItem = StudentRender['items'][number]
export type AnswerKeyItem = AnswerKeyRender['items'][number]

/** Plain-text answer for a key line. Pure, so the print page and the tests share it. */
export function formatCorrectAnswer(item: AnswerKeyItem): string[] {
  const label = (optionId: string) => item.options?.find(option => option.id === optionId)?.label ?? optionId
  const letter = (optionId: string) => { const index = item.options?.findIndex(option => option.id === optionId) ?? -1; return index >= 0 ? `${String.fromCharCode(65 + index)}. ` : '' }
  const answer = item.correctAnswer
  switch (answer.kind) {
    case 'option': return [`${letter(answer.optionId)}${label(answer.optionId)}`]
    case 'options': return answer.optionIds.map(optionId => `${letter(optionId)}${label(optionId)}`)
    case 'blanks': return answer.blanks.map((accepted, index) => `Blank ${index + 1}: ${accepted.join(' / ')}`)
    case 'order': return answer.optionIds.map((optionId, index) => `${index + 1}. ${label(optionId)}`)
    case 'text': return [answer.sample]
    case 'code': return [answer.sample]
  }
}
export const totalPoints = (items: { points: number }[]) => items.reduce((sum, item) => sum + item.points, 0)

/** Error reasons a teacher can act on. */
export const worksheetErrorText: Record<string, string> = {
  VERSION_CONFLICT: 'This worksheet changed somewhere else. Reload to see the latest, then try again.',
  NOT_PUBLISHED: 'Only published questions can go on a worksheet.',
  WORKSHEET_NOT_DRAFT: 'Only a draft worksheet can be changed. Final and archived worksheets are frozen.',
  WORKSHEET_EMPTY: 'Add at least one question before finalising.',
  WORKSHEET_ITEMS_UNAVAILABLE: 'Some questions are no longer published. Remove them, then finalise.',
  VALIDATION: 'Check the worksheet details and try again.',
}

const base = (worksheetId: string) => `/worksheets/${encodeURIComponent(worksheetId)}`
export function worksheetsApi(request: TeachingRequest) {
  const get = async <T>(schema: z.ZodType<T>, suffix: string) => parseResponse(schema, await request<unknown>(suffix))
  const send = async <T>(schema: z.ZodType<T>, suffix: string, method: TeachingMethod, body: unknown, key?: string) =>
    parseResponse(schema, await request<unknown>(suffix, method, body, idempotent(key)))
  return {
    get: async (worksheetId: string): Promise<WorksheetDetail> => (await get(worksheetDetailSchema, base(worksheetId))).worksheet,
    list: (planId: string) => get(worksheetListSchema, `/plans/${encodeURIComponent(planId)}/worksheets`),
    create: (planId: string, body: { title: string; instructions: string; items?: WorksheetItem[] }, key?: string) =>
      send(worksheetResponse, `/plans/${encodeURIComponent(planId)}/worksheets`, 'POST', body, key),
    save: (worksheetId: string, body: { title: string; instructions: string; items: WorksheetItem[]; settings: WorksheetSettings; expectedVersion: number }) =>
      send(worksheetResponse, base(worksheetId), 'PUT', body),
    fill: (worksheetId: string, body: { topicIds: string[]; count: number; mix: Partial<Record<Difficulty, number>> | null; types: string[] | null }, key?: string) =>
      send(fillSchema, `${base(worksheetId)}/fill`, 'POST', body, key),
    finalize: (worksheetId: string, key?: string) => send(worksheetResponse, `${base(worksheetId)}/finalize`, 'POST', {}, key),
    archive: (worksheetId: string, key?: string) => send(worksheetResponse, `${base(worksheetId)}/archive`, 'POST', {}, key),
    renderStudent: (worksheetId: string) => get(studentRenderSchema, `${base(worksheetId)}/render?part=student`),
    renderAnswerKey: (worksheetId: string) => get(answerKeyRenderSchema, `${base(worksheetId)}/render?part=answer-key`),
    /** Published questions of one plan for the picker. */
    bank: (planId: string, filters: BankFilters = {}) => {
      const params = new URLSearchParams({ planId, status: 'PUBLISHED', limit: '30' })
      for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
      return get(bankListSchema, `/questions?${params.toString()}`)
    },
  }
}
export type WorksheetsApi = ReturnType<typeof worksheetsApi>
