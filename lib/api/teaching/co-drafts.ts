import { z } from 'zod'
import { idempotent, parseResponse, type TeachingRequest } from './plans'
import { questionDetailSchema, type QuestionDetail, type QuestionDifficulty, type QuestionType } from './question-schema'

/* B13 section 6.3 (F-T4-05, F-T4-08). Co output is never published by Co: drafts arrive PENDING_REVIEW. */
export interface AiState { state: 'AVAILABLE' | 'UNAVAILABLE'; reason: string | null; code: 'FLAG_OFF' | 'PACK_NOT_APPROVED' | 'RUNTIME_DOWN' | 'NO_SOURCE' | 'PLAN_NOT_IN_SCOPE' | null }
export const aiStateSchema = z.object({
  state: z.enum(['AVAILABLE', 'UNAVAILABLE']), reason: z.string().nullable(),
  code: z.enum(['FLAG_OFF', 'PACK_NOT_APPROVED', 'RUNTIME_DOWN', 'NO_SOURCE', 'PLAN_NOT_IN_SCOPE']).nullable(),
}) satisfies z.ZodType<AiState>
const coStateSchema = z.object({ generate: aiStateSchema, review: aiStateSchema })
export type CoState = z.infer<typeof coStateSchema>

export type BatchStatus = 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED' | 'CANCELLED'
export interface DraftBatch {
  id: string; status: BatchStatus; requestedCount: number; draftCount: number; failureCode: string | null
  topicTitle: string; materialTitles: string[]; createdAt: string; finishedAt: string | null
}
export const batchSchema = z.object({
  id: z.string().min(1), status: z.enum(['QUEUED', 'RUNNING', 'READY', 'FAILED', 'CANCELLED']), requestedCount: z.number().int(), draftCount: z.number().int(),
  failureCode: z.string().nullable(), topicTitle: z.string(), materialTitles: z.array(z.string()), createdAt: z.string(), finishedAt: z.string().nullable(),
}) satisfies z.ZodType<DraftBatch>
/** One row of `GET /plans/:planId/questions/co-drafts` (newest first): no material titles, no drafts. */
export type DraftBatchSummary = Omit<DraftBatch, 'materialTitles'>
export const batchSummarySchema = z.object({
  id: z.string().min(1), status: z.enum(['QUEUED', 'RUNNING', 'READY', 'FAILED', 'CANCELLED']), requestedCount: z.number().int(), draftCount: z.number().int(),
  failureCode: z.string().nullable(), topicTitle: z.string(), createdAt: z.string(), finishedAt: z.string().nullable(),
}) satisfies z.ZodType<DraftBatchSummary>
const batchListSchema = z.object({ batches: z.array(batchSummarySchema) })
const createdSchema = z.object({ batch: batchSchema })
const batchDetailSchema = z.object({ batch: batchSchema, drafts: z.array(questionDetailSchema) })
export interface BatchDetail { batch: DraftBatch; drafts: QuestionDetail[] }

export interface CoDraftInput {
  topicId: string; materialIds: string[]; count: number; types: QuestionType[]; difficulty: QuestionDifficulty | null
}
export const isWorking = (status: BatchStatus) => status === 'QUEUED' || status === 'RUNNING'
export const POLL_MS = 3000

export function coDraftsApi(request: TeachingRequest) {
  return {
    state: async (planId: string): Promise<CoState> => parseResponse(coStateSchema, await request<unknown>(`/questions/co/state?planId=${encodeURIComponent(planId)}`)),
    create: async (planId: string, input: CoDraftInput, key: string) =>
      parseResponse(createdSchema, await request<unknown>(`/plans/${encodeURIComponent(planId)}/questions/co-drafts`, 'POST', input, idempotent(key))).batch,
    /** The plan's Co batches, newest first (the way back into a review queue). */
    list: async (planId: string): Promise<DraftBatchSummary[]> =>
      parseResponse(batchListSchema, await request<unknown>(`/plans/${encodeURIComponent(planId)}/questions/co-drafts`)).batches,
    batch: async (batchId: string): Promise<BatchDetail> => parseResponse(batchDetailSchema, await request<unknown>(`/questions/co-drafts/${encodeURIComponent(batchId)}`)),
    recheck: async (questionIds: string[]) => { await request<unknown>('/questions/co-review', 'POST', { questionIds }, idempotent()) },
  }
}
export type CoDraftsApi = ReturnType<typeof coDraftsApi>

export const batchFailureText = (code: string | null) =>
  code === 'invalid_output' ? 'Co could not produce questions it was confident in from this material. Nothing was drafted. Try a different topic or material.'
    : code === 'NO_SOURCE' || code === 'insufficient_source' ? 'The selected material does not have enough readable text to draft from.'
      : code === 'unsafe_content' ? 'Co could not use this material to draft questions. Nothing was added.'
        : code === 'age_band_unsupported' ? 'Co cannot draft questions for this class level yet. Nothing was added.'
          : code === 'authorization_changed' ? 'Your access to this plan or material changed while Co was working. Nothing was added.'
            : 'Co could not finish this draft. Nothing was added to your question bank. You can try again.'
