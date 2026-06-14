import { apiClient } from '@/lib/api/client'
import type { StudentEnrolledMaterial, StudentEnrolledPlan } from '@/lib/types/student-enrollment'

export async function fetchStudentEnrolledPlan(
  headers: Record<string, string>,
  clonedPlanId: string,
): Promise<StudentEnrolledPlan | null> {
  try {
    return await apiClient<StudentEnrolledPlan>(`/api/student/plans/${clonedPlanId}`, { headers })
  } catch {
    return null
  }
}

export async function fetchStudentTopicMaterials(
  headers: Record<string, string>,
  clonedPlanId: string,
  topicId: string,
): Promise<{ topicId: string; materials: StudentEnrolledMaterial[]; questionCount: number } | null> {
  try {
    return await apiClient(`/api/student/plans/${clonedPlanId}/topics/${topicId}`, { headers })
  } catch {
    return null
  }
}