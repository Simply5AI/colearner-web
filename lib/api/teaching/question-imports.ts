import { z } from 'zod'
import { ApiError } from '../client'
import { platformApiBaseUrl } from '../platform-client'
import { TeachingApiError, readErrorDetails, teachingPath, type TeachingMethod } from './core'
import { idempotent, parseResponse, type TeachingRequest } from './plans'

/*
 * B13 section 6.5 (T4 bulk import). Upload -> mapping -> preview -> commit (D10: VALID_ROWS_ONLY, one transaction, idempotent
 * per import id). Every response is Zod-parsed; a mismatch is a 502, never a half-rendered screen. The platform is the only
 * validator of rows; this file only carries the contract and a few honest pre-flight checks on the file.
 */
const id = z.string().min(1).max(256)
const iso = z.string().min(1)
const count = z.number().int().nonnegative()

export const IMPORT_FIELDS = [
  'type', 'topic', 'difficulty', 'prompt',
  'option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'option_f', 'option_g', 'option_h',
  'correct', 'explanation', 'hint_1', 'hint_2', 'hint_3', 'rubric',
] as const
export type ImportField = (typeof IMPORT_FIELDS)[number]
/** Fields the platform cannot build a question without. */
export const REQUIRED_IMPORT_FIELDS: readonly ImportField[] = ['prompt', 'correct']

export const importFieldLabel: Record<ImportField, string> = {
  type: 'Question type', topic: 'Topic', difficulty: 'Difficulty', prompt: 'Question text',
  option_a: 'Option A', option_b: 'Option B', option_c: 'Option C', option_d: 'Option D',
  option_e: 'Option E', option_f: 'Option F', option_g: 'Option G', option_h: 'Option H',
  correct: 'Correct answer', explanation: 'Explanation', hint_1: 'Hint 1 (nudge)', hint_2: 'Hint 2 (hint)', hint_3: 'Hint 3 (similar example)', rubric: 'Marking guide',
}

export const MAX_IMPORT_BYTES = 1024 * 1024
export const MAX_IMPORT_ROWS = 500

const mappingSchema = z.record(z.string(), z.string().nullable())
export type ImportMapping = Record<string, string | null>
export const rowStatusSchema = z.enum(['VALID', 'INVALID', 'DUPLICATE_SUGGESTION'])
export type ImportRowStatus = z.infer<typeof rowStatusSchema>

const previewRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  status: rowStatusSchema,
  errors: z.array(z.object({ field: z.string(), code: z.string(), message: z.string() })),
  // Only what the table shows; the answer key stays unread on this screen.
  content: z.object({ type: z.string(), prompt: z.string(), topicId: z.string().nullable().optional(), difficulty: z.string().nullable().optional() }).nullable(),
  duplicateOf: z.object({ questionId: id.nullable(), rowNumber: z.number().int().nullable() }).nullable(),
})
export type ImportPreviewRow = z.infer<typeof previewRowSchema>
export const importPreviewSchema = z.object({ rows: z.array(previewRowSchema), validCount: count, invalidCount: count })
export type ImportPreview = z.infer<typeof importPreviewSchema>

export const importStatusSchema = z.enum(['UPLOADED', 'MAPPED', 'COMMITTED', 'EXPIRED'])
export const commitResultSchema = z.object({ committedCount: count, skippedCount: count, questionIds: z.array(id) })
export type ImportCommitResult = z.infer<typeof commitResultSchema>
const importSchema = z.object({
  id, planId: id.optional(), fileName: z.string().nullable().optional(),
  status: importStatusSchema.optional(),
  headers: z.array(z.string()), rowCount: count,
  suggestedMapping: mappingSchema.optional(),
  mapping: mappingSchema.nullable().optional(),
  defaultTopicId: id.nullable().optional(), defaultType: z.string().nullable().optional(),
  preview: importPreviewSchema.nullable().optional(),
  committedCount: count.optional(), skippedCount: count.optional(),
  /** Stored commit result (GET /question-imports/:id once COMMITTED). */
  result: commitResultSchema.nullable().optional(),
  expiresAt: iso.nullable().optional(),
}).transform(value => (value.result ? { ...value, committedCount: value.result.committedCount, skippedCount: value.result.skippedCount } : value))
export type QuestionImport = z.output<typeof importSchema>
const importEnvelope = z.object({ import: importSchema })
const previewEnvelope = z.object({ preview: importPreviewSchema })

/** Question types a CSV can create. CODE and PICTURE_CHOICE rows are refused by the platform (TYPE_NOT_IMPORTABLE). */
export const importableTypes = ['MCQ', 'MULTI_SELECT', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'LONG_ANSWER', 'ORDERING'] as const
export const typeLabel: Record<string, string> = {
  MCQ: 'Multiple choice', MULTI_SELECT: 'Select all that apply', TRUE_FALSE: 'True or false', FILL_BLANK: 'Fill in the blank',
  SHORT_ANSWER: 'Short answer', LONG_ANSWER: 'Long answer', CODE: 'Code', PICTURE_CHOICE: 'Picture choice', ORDERING: 'Ordering',
}

export interface FileProblem { problem: string }
/** Cheap pre-flight so an obviously wrong file never leaves the browser. The platform repeats every check. */
export async function checkCsvFile(file: File): Promise<FileProblem | null> {
  const looksCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv' || file.type === 'application/vnd.ms-excel'
  if (!looksCsv) return { problem: 'Choose a .csv file. In a spreadsheet, use File, then Save as, then CSV.' }
  if (file.size === 0) return { problem: 'That file is empty.' }
  if (file.size > MAX_IMPORT_BYTES) return { problem: 'That file is larger than 1 MB. Split it into smaller files.' }
  try {
    const text = await file.text()
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '').length
    if (lines - 1 > MAX_IMPORT_ROWS) return { problem: `That file has more than ${MAX_IMPORT_ROWS} questions. Split it and import in parts.` }
    if (lines < 2) return { problem: 'The file needs a header row and at least one question row.' }
  } catch {
    return { problem: 'That file could not be read.' }
  }
  return null
}

/** Reasons for the codes a teacher can act on. */
export const importErrorText: Record<string, string> = {
  IMPORT_EXPIRED: 'This import expired (imports are kept for 24 hours). Upload the file again.',
  IMPORT_NOT_MAPPED: 'Match the columns and check the preview before importing.',
  IMPORT_COMMITTED: 'This import was already committed.',
  VALIDATION: 'The file or mapping was not accepted. Check it and try again.',
  PAYLOAD_TOO_LARGE: 'That file is too large. Split it into smaller files.',
}

/** Reasons for the file problems the platform reports as `details[].code` on a 400 VALIDATION. */
export const fileProblemText: Record<string, string> = {
  EMPTY: 'That file is empty.', TOO_LARGE: 'That file is larger than 1 MB. Split it into smaller files.', NOT_UTF8: 'The file must be saved as UTF-8 text. In a spreadsheet, choose "CSV UTF-8".',
  NOT_CSV: 'Choose a .csv file.', UNCLOSED_QUOTE: 'A quote in the file is never closed. Check the cells with quotation marks.', NO_HEADER: 'The file needs a header row.',
  BAD_HEADER: 'Header names must be unique and not empty.', NO_ROWS: 'The file has a header row but no questions.', TOO_MANY_ROWS: `That file has more than ${MAX_IMPORT_ROWS} questions. Split it and import in parts.`,
  REQUIRED: 'Attach a CSV file.',
  CSV_TOO_MANY_COLUMNS: 'That file has more than 40 columns. Remove the columns you do not need.',
  CSV_CELL_TOO_LONG: 'A cell in that file is longer than 4000 characters. Shorten it.',
  CSV_INVALID_CHARACTER: 'That file contains an unreadable character (NUL). Re-save it as a plain UTF-8 CSV.',
}

/**
 * Multipart upload. `core.ts` only sends JSON, so this helper uses the same credential path (verified cookie session via
 * next-auth, bearer token to the platform) and the same error mapping.
 */
export async function uploadTeachingFile<T>(schoolId: string, suffix: string, file: File, fieldName = 'file'): Promise<T> {
  const { getSession } = await import('next-auth/react')
  let session
  try {
    session = await getSession({ broadcast: false })
  } catch {
    throw new ApiError(503, 'Your session could not be checked. Try again.')
  }
  if (!session?.accessToken || !session.user?.id) throw new ApiError(401, 'Your session has expired. Log in again.')
  const form = new FormData()
  form.append(fieldName, file, file.name)
  let response: Response
  try {
    // No Content-Type header: the browser adds the multipart boundary.
    response = await fetch(`${platformApiBaseUrl()}${teachingPath(schoolId, suffix)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.accessToken}`, 'Idempotency-Key': idempotent()['Idempotency-Key'] },
      body: form,
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    })
  } catch {
    throw new ApiError(503, 'Teaching services are unavailable. Your file is still selected; try again.')
  }
  if (!response.ok) {
    let code: string | null = null
    let details: ReturnType<typeof readErrorDetails> = []
    try {
      const json = (await response.json()) as Record<string, unknown>
      const data = (json.data ?? json) as Record<string, unknown>
      const err = (json.error ?? data) as Record<string, unknown>
      const candidate = err.code ?? err.error ?? json.code
      code = typeof candidate === 'string' ? candidate : null
      details = readErrorDetails(json, data)
    } catch { /* optional body */ }
    const fileDetail = details.find(detail => detail.path === 'file')
    const message = (fileDetail && fileProblemText[fileDetail.code]) ?? (code && importErrorText[code]) ?? (response.status === 413 ? importErrorText.PAYLOAD_TOO_LARGE! : response.status === 401 ? 'Your session has expired. Log in again.' : response.status === 403 ? 'You do not have permission for this plan.' : response.status === 404 ? 'That plan was not found, or you no longer have access to it.' : response.status === 422 || response.status === 400 ? 'That file could not be read. Check it is a UTF-8 CSV and try again.' : 'Teaching services are unavailable. Please try again.')
    throw new TeachingApiError(response.status, message, code, null, details)
  }
  const json = await response.json()
  return (json.data ?? json) as T
}
export type UploadFn = <T>(suffix: string, file: File) => Promise<T>

const importPath = (importId: string) => `/question-imports/${encodeURIComponent(importId)}`

export function questionImportsApi(request: TeachingRequest, upload: UploadFn) {
  const send = async <T>(schema: z.ZodType<T>, suffix: string, method: TeachingMethod, body: unknown) =>
    parseResponse(schema, await request<unknown>(suffix, method, body, idempotent()))
  return {
    upload: async (planId: string, file: File) => parseResponse(importEnvelope, await upload<unknown>(`/plans/${encodeURIComponent(planId)}/question-imports`, file)).import,
    get: async (importId: string) => parseResponse(importEnvelope, await request<unknown>(importPath(importId))).import,
    setMapping: async (importId: string, body: { mapping: ImportMapping; defaultTopicId: string | null; defaultType: string | null }) =>
      (await send(previewEnvelope, `${importPath(importId)}/mapping`, 'PUT', body)).preview,
    commit: (importId: string, includeDuplicateSuggestions: boolean) =>
      send(commitResultSchema, `${importPath(importId)}/commit`, 'POST', { includeDuplicateSuggestions }),
  }
}
export type QuestionImportsApi = ReturnType<typeof questionImportsApi>
