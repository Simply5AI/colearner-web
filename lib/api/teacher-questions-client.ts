'use client'

import { ApiError } from '@/lib/api/client'
import type {
  TeacherQuestion,
  TeacherQuestionStatus,
  TeacherQuestionType,
} from '@/lib/types/teacher'

export interface BulkImportResult {
  imported: Array<Pick<TeacherQuestion, 'id' | 'planId' | 'topicId' | 'type' | 'status' | 'prompt'>>
  errors: Array<{ row: number; message: string }>
  importedCount: number
  errorCount: number
  totalRows: number
}

export interface AiDraftResult {
  questions: TeacherQuestion[]
  requested: number
  generated: number
}

async function questionsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new ApiError(res.status, error.message ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export function listTeacherQuestionsClient(query: {
  planId: string
  topicId?: string
  status?: TeacherQuestionStatus
}): Promise<TeacherQuestion[]> {
  const params = new URLSearchParams({ planId: query.planId })
  if (query.topicId) params.set('topicId', query.topicId)
  if (query.status) params.set('status', query.status)
  return questionsFetch(`/api/teacher/questions?${params}`)
}

export function getTeacherQuestionClient(questionId: string): Promise<TeacherQuestion> {
  return questionsFetch(`/api/teacher/questions/${questionId}`)
}

export function createTeacherQuestionClient(
  body: Omit<TeacherQuestion, 'id' | 'status'> & { status?: TeacherQuestionStatus },
): Promise<TeacherQuestion> {
  return questionsFetch('/api/teacher/questions', { method: 'POST', body: JSON.stringify(body) })
}

export function updateTeacherQuestionClient(
  questionId: string,
  body: Partial<Omit<TeacherQuestion, 'id' | 'planId'>>,
): Promise<TeacherQuestion> {
  return questionsFetch(`/api/teacher/questions/${questionId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function publishTeacherQuestionClient(questionId: string): Promise<TeacherQuestion> {
  return questionsFetch(`/api/teacher/questions/${questionId}/publish`, { method: 'POST' })
}

export function deleteTeacherQuestionClient(questionId: string): Promise<void> {
  return questionsFetch(`/api/teacher/questions/${questionId}`, { method: 'DELETE' })
}

export function archiveTeacherQuestionClient(questionId: string): Promise<TeacherQuestion> {
  return questionsFetch(`/api/teacher/questions/${questionId}/archive`, { method: 'POST' })
}

export function generateAiDraftsClient(body: {
  planId: string
  topicId: string
  materialIds?: string[]
  types: TeacherQuestionType[]
  count: number
  difficultyHint?: string
}): Promise<AiDraftResult> {
  return questionsFetch('/api/teacher/questions/ai-draft', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function bulkImportQuestionsClient(body: {
  planId: string
  questions: Array<{
    topicId: string
    type: TeacherQuestionType
    prompt: string
    explanation: string
    options?: unknown
    correctAnswer: unknown
    status?: TeacherQuestionStatus
  }>
}): Promise<BulkImportResult> {
  return questionsFetch('/api/teacher/questions/bulk-import', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function bulkImportCsvClient(planId: string, file: File): Promise<BulkImportResult> {
  const form = new FormData()
  form.append('planId', planId)
  form.append('file', file)

  const res = await fetch('/api/teacher/questions/bulk-import/file', {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new ApiError(res.status, error.message ?? res.statusText)
  }
  return res.json() as Promise<BulkImportResult>
}