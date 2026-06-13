import { apiClient } from '@/lib/api/client'
import { auth } from '@/lib/auth/config'

export interface FreelanceBootstrapPayload {
  displayName: string
  language?: string
  timezone?: string
}

export interface FreelanceBootstrapResponse {
  orgId: string
  orgName: string
  role: 'TEACHER'
}

export interface TeacherProfile {
  isTeacher: boolean
  orgId?: string
  orgName?: string
}

export async function getTeacherHeaders(): Promise<Record<string, string>> {
  const session = await auth()
  if (!session?.accessToken) {
    throw new Error('Not authenticated')
  }
  return {
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  }
}

export async function bootstrapFreelanceOrg(
  payload: FreelanceBootstrapPayload,
): Promise<FreelanceBootstrapResponse> {
  const headers = await getTeacherHeaders()
  return apiClient<FreelanceBootstrapResponse>('/api/auth/org/freelance-bootstrap', {
    method: 'POST',
    headers,
    body: payload,
  })
}

export async function getTeacherProfile(): Promise<TeacherProfile> {
  const headers = await getTeacherHeaders()
  return apiClient<TeacherProfile>('/api/users/me/teacher-profile', {
    headers,
  })
}