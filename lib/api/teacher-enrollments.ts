import { apiClient } from '@/lib/api/client'
import type { TeacherEnrollment, TeacherInviteCode } from '@/lib/types/teacher'

export async function fetchPlanEnrollments(
  headers: Record<string, string>,
  planId: string,
): Promise<TeacherEnrollment[]> {
  return apiClient<TeacherEnrollment[]>(`/api/teacher/plans/${planId}/enrollments`, { headers })
}

export async function fetchPlanInviteCodes(
  headers: Record<string, string>,
  planId: string,
): Promise<TeacherInviteCode[]> {
  return apiClient<TeacherInviteCode[]>(`/api/teacher/plans/${planId}/invite-codes`, { headers })
}