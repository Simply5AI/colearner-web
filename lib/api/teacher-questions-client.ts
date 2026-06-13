'use client'

import { ApiError } from '@/lib/api/client'
import type { TeacherQuestion, TeacherQuestionStatus } from '@/lib/types/teacher'

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