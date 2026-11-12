import { TeachingApiError, type TeachingMethod } from './core'
import { idempotent, parseResponse, teachingErrorInfo, type TeachingRequest } from './plans'
import {
  questionEnvelopeSchema, questionListSchema, type QuestionContent, type QuestionDetail, type QuestionIssue, type QuestionList,
} from './question-schema'

/* B13 sections 6.1 and 6.2. Every response is Zod-parsed; a mismatch is a 502, never a half-rendered screen. */
export interface ListQuestionsParams {
  planId?: string; topicId?: string; type?: string; difficulty?: string; origin?: string; status?: string; reviewState?: string
  flagged?: boolean; q?: string; cursor?: string | null; limit?: number
}

export function questionsQuery(params: ListQuestionsParams): string {
  const query = new URLSearchParams()
  const set = (key: string, value: string | undefined | null) => { if (value) query.set(key, value) }
  set('planId', params.planId); set('topicId', params.topicId); set('type', params.type); set('difficulty', params.difficulty)
  set('origin', params.origin); set('status', params.status); set('reviewState', params.reviewState)
  if (params.flagged) query.set('flagged', 'true')
  set('q', params.q?.trim().slice(0, 100)); set('cursor', params.cursor)
  query.set('limit', String(Math.min(params.limit ?? 25, 50)))
  return query.toString()
}

const questionPath = (id: string) => `/questions/${encodeURIComponent(id)}`

export function questionsApi(request: TeachingRequest) {
  const read = async (suffix: string, method: TeachingMethod, body?: unknown, key?: string): Promise<QuestionDetail> =>
    parseResponse(questionEnvelopeSchema, await request<unknown>(suffix, method, body, idempotent(key)))
  return {
    list: async (params: ListQuestionsParams = {}): Promise<QuestionList> => parseResponse(questionListSchema, await request<unknown>(`/questions?${questionsQuery(params)}`)),
    get: async (id: string): Promise<QuestionDetail> => parseResponse(questionEnvelopeSchema, await request<unknown>(questionPath(id))),
    create: (planId: string, content: QuestionContent, key: string) => read(`/plans/${encodeURIComponent(planId)}/questions`, 'POST', content, key),
    update: (id: string, content: QuestionContent, expectedVersion: number) => read(questionPath(id), 'PUT', { content, expectedVersion }),
    publish: (id: string, expectedVersion: number, key?: string) => read(`${questionPath(id)}/publish`, 'POST', { expectedVersion }, key),
    discardDraft: (id: string, key?: string) => read(`${questionPath(id)}/discard-draft`, 'POST', {}, key),
    archive: (id: string, key?: string) => read(`${questionPath(id)}/archive`, 'POST', {}, key),
    review: (id: string, decision: 'ACCEPT' | 'REJECT', expectedVersion: number, key?: string) => read(`${questionPath(id)}/review`, 'POST', { decision, expectedVersion }, key),
    remove: async (id: string) => { await request<unknown>(questionPath(id), 'DELETE', undefined, idempotent()) },
    dismissFlag: async (id: string, flagId: string) => { await request<unknown>(`${questionPath(id)}/flags/${encodeURIComponent(flagId)}/dismiss`, 'POST', {}, idempotent()) },
  }
}
export type QuestionsApi = ReturnType<typeof questionsApi>

/* ---------- errors ---------- */

const messages: Record<string, string> = {
  VERSION_CONFLICT: 'This question changed somewhere else. Your edits are still here.',
  USE_ARCHIVE: 'This question has been published, so it cannot be deleted. Archive it instead.',
  QUESTION_INVALID: 'The server found a problem with this question. Fix the marked fields and try again.',
  NOT_TEACHING_SCOPE: 'You are not assigned to teach this class and subject, so you cannot change its questions.',
  PLAN_SCOPE_REQUIRED: 'Choose a plan first.',
  CO_DRAFT_DAILY_LIMIT: 'You have reached today’s limit of Co drafts. Try again tomorrow, or write questions yourself.',
  CO_UNAVAILABLE: 'Co is not available right now. Nothing was drafted.',
  VALIDATION: 'Check the details and try again.',
}
export function questionErrorText(error: unknown): string {
  const info = teachingErrorInfo(error)
  return (info.code ? messages[info.code] : undefined) ?? info.message
}
export const isVersionConflict = (error: unknown) => {
  const info = teachingErrorInfo(error)
  return info.code === 'VERSION_CONFLICT' || (info.status === 409 && info.code === null)
}
export const errorCode = (error: unknown) => teachingErrorInfo(error).code

const issueMessages: Record<string, string> = {
  REQUIRED: 'This is required.', TOO_LONG: 'This is too long.', TOO_MANY: 'There are too many.', TOO_FEW: 'There are too few.', DUPLICATE: 'This repeats another entry.',
  UNKNOWN_TOPIC: 'Choose a topic from this plan.', UNKNOWN_OPTION: 'This refers to an option that does not exist.', UNKNOWN_MATERIAL: 'This material is not in this plan.',
  UNKNOWN_IMAGE: 'Choose a picture from this plan’s images.', BLANK_COUNT_MISMATCH: 'Each ___ in the question needs its own accepted answers.',
  BLANK_MARKER_REQUIRED: 'Put ___ where each blank goes.', NOT_A_PERMUTATION: 'List every item once, in the correct order.', NOT_ALLOWED: 'This does not apply to this question type.',
}

/**
 * Field-level errors from a 422 QUESTION_INVALID (`details: [{ path, code }]`, carried by `TeachingApiError`). Server paths
 * are mapped onto the editor's own field paths: `media.optionImages.<optionId>` becomes `options.<index>.image` when the
 * current content is given.
 */
export function serverIssues(error: unknown, content?: QuestionContent): QuestionIssue[] | null {
  if (!(error instanceof TeachingApiError) || error.status !== 422) return null
  return error.details.map(({ path, code }) => {
    const image = /^media\.optionImages\.(.+)$/.exec(path)
    const index = image ? content?.options?.findIndex(option => option.id === image[1]) ?? -1 : -1
    const mapped = image && index >= 0 ? `options.${index}.image` : path
    return { path: mapped, code, message: issueMessages[code] ?? 'The server did not accept this field.' }
  })
}
