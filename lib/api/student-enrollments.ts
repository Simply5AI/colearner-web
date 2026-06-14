import { apiClient } from '@/lib/api/client'
import type { RedeemInviteResult, StudentEnrollmentSummary } from '@/lib/types/student-enrollment'

export async function fetchStudentEnrollments(
  headers: Record<string, string>,
): Promise<StudentEnrollmentSummary[]> {
  return apiClient<StudentEnrollmentSummary[]>('/api/student/enrollments', { headers })
}

export async function fetchStudentEnrollment(
  headers: Record<string, string>,
  enrollmentId: string,
): Promise<StudentEnrollmentSummary | null> {
  try {
    return await apiClient<StudentEnrollmentSummary>(`/api/student/enrollments/${enrollmentId}`, {
      headers,
    })
  } catch {
    return null
  }
}

export async function redeemInviteCode(
  headers: Record<string, string>,
  code: string,
): Promise<RedeemInviteResult> {
  return apiClient<RedeemInviteResult>('/api/student/enrollments/redeem', {
    method: 'POST',
    headers,
    body: { code },
  })
}