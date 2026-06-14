import { apiClient } from '@/lib/api/client'
import type {
  AssignStudentsResult,
  OrgStudentOption,
  TeacherEnrollment,
  TeacherInviteCode,
  TeacherStudentRosterEntry,
} from '@/lib/types/teacher'

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

export async function fetchOrgStudents(
  headers: Record<string, string>,
  search?: string,
): Promise<OrgStudentOption[]> {
  const params = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiClient<OrgStudentOption[]>(`/api/teacher/org-students${params}`, { headers })
}

export async function fetchTeacherStudentRoster(
  headers: Record<string, string>,
): Promise<TeacherStudentRosterEntry[]> {
  return apiClient<TeacherStudentRosterEntry[]>('/api/teacher/students/roster', { headers })
}