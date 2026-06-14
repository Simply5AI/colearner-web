import { apiClient } from '@/lib/api/client'
import type { TeacherMaterial } from '@/lib/types/teacher'

export async function fetchTeacherMaterials(
  headers: Record<string, string>,
  query: { planId: string; topicId?: string },
): Promise<TeacherMaterial[]> {
  const params = new URLSearchParams({ planId: query.planId })
  if (query.topicId) params.set('topicId', query.topicId)
  return apiClient<TeacherMaterial[]>(`/api/teacher/materials?${params}`, { headers })
}