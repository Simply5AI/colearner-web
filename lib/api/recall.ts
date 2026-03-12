import { apiClient } from '@/lib/api/client'
import type {
  RecallSessionConfig,
  RecallSessionResponse,
  QuestionWithMeta,
  AnswerResult,
  SessionSummaryDetailed,
  QueueStats,
  QueueItem,
} from '@/lib/types'

export async function createRecallSession(
  headers: Record<string, string>,
  config: RecallSessionConfig
): Promise<RecallSessionResponse> {
  return apiClient<RecallSessionResponse>('/api/recall/sessions', {
    method: 'POST',
    headers,
    body: config,
  })
}

export async function getSessionQuestions(
  headers: Record<string, string>,
  sessionId: string
): Promise<QuestionWithMeta[]> {
  return apiClient<QuestionWithMeta[]>(
    `/api/recall/sessions/${sessionId}/questions`,
    { headers }
  )
}

export async function submitRecallAnswer(
  headers: Record<string, string>,
  sessionId: string,
  data: { questionId: string; answer: string; timeSpentSeconds: number }
): Promise<AnswerResult> {
  return apiClient<AnswerResult>(
    `/api/recall/sessions/${sessionId}/answers`,
    { method: 'POST', headers, body: data }
  )
}

export async function skipRecallQuestion(
  headers: Record<string, string>,
  sessionId: string,
  questionId: string
): Promise<{ skipped: boolean; questionId: string }> {
  return apiClient<{ skipped: boolean; questionId: string }>(
    `/api/recall/sessions/${sessionId}/skip`,
    { method: 'POST', headers, body: { questionId } }
  )
}

export async function completeRecallSession(
  headers: Record<string, string>,
  sessionId: string
): Promise<void> {
  return apiClient<void>(
    `/api/recall/sessions/${sessionId}/complete`,
    { method: 'POST', headers }
  )
}

export async function getSessionSummary(
  headers: Record<string, string>,
  sessionId: string
): Promise<SessionSummaryDetailed> {
  return apiClient<SessionSummaryDetailed>(
    `/api/recall/sessions/${sessionId}/summary`,
    { headers }
  )
}

export async function getQueueStats(
  headers: Record<string, string>,
  extractionId?: string
): Promise<QueueStats> {
  const query = extractionId ? `?extractionId=${extractionId}` : ''
  return apiClient<QueueStats>(`/api/recall/queue/stats${query}`, { headers })
}

export async function getQueueItems(
  headers: Record<string, string>,
  extractionId?: string
): Promise<QueueItem[]> {
  const query = extractionId ? `?extractionId=${extractionId}` : ''
  return apiClient<QueueItem[]>(`/api/recall/queue/items${query}`, { headers })
}
