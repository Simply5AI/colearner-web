import { apiClient } from '@/lib/api/client'
import type { TeacherQuestion, TeacherQuestionStatus } from '@/lib/types/teacher'

export async function fetchTeacherQuestions(
  headers: Record<string, string>,
  query: { planId: string; topicId?: string; status?: TeacherQuestionStatus },
): Promise<TeacherQuestion[]> {
  const params = new URLSearchParams({ planId: query.planId })
  if (query.topicId) params.set('topicId', query.topicId)
  if (query.status) params.set('status', query.status)
  return apiClient<TeacherQuestion[]>(`/api/teacher/questions?${params}`, { headers })
}

export async function fetchTeacherQuestion(
  headers: Record<string, string>,
  questionId: string,
): Promise<TeacherQuestion | null> {
  try {
    return await apiClient<TeacherQuestion>(`/api/teacher/questions/${questionId}`, { headers })
  } catch {
    return null
  }
}