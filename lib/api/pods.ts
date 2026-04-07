import { apiClient } from '@/lib/api/client'
import type {
  Pod,
  PodCapture,
  PodInvite,
  LeaderboardEntry,
  PodActivity,
  CreatePodInput,
  UpdatePodInput,
  UpdatePrivacyInput,
  ShareCaptureInput,
  PodMember,
} from '@/lib/types/pods'

// ---- Pod CRUD ----

export async function createPod(
  headers: Record<string, string>,
  data: CreatePodInput
): Promise<Pod> {
  return apiClient<Pod>('/api/pods', { method: 'POST', headers, body: data })
}

export async function getUserPods(
  headers: Record<string, string>
): Promise<Pod[]> {
  return apiClient<Pod[]>('/api/pods', { headers })
}

export async function getPod(
  headers: Record<string, string>,
  id: string
): Promise<Pod> {
  return apiClient<Pod>(`/api/pods/${id}`, { headers })
}

export async function updatePod(
  headers: Record<string, string>,
  id: string,
  data: UpdatePodInput
): Promise<Pod> {
  return apiClient<Pod>(`/api/pods/${id}`, { method: 'PATCH', headers, body: data })
}

export async function deletePod(
  headers: Record<string, string>,
  id: string
): Promise<{ message: string }> {
  return apiClient<{ message: string }>(`/api/pods/${id}`, { method: 'DELETE', headers })
}

// ---- Members ----

export async function removeMember(
  headers: Record<string, string>,
  podId: string,
  userId: string
): Promise<{ message: string }> {
  return apiClient<{ message: string }>(`/api/pods/${podId}/members/${userId}`, {
    method: 'DELETE',
    headers,
  })
}

export async function updatePrivacy(
  headers: Record<string, string>,
  podId: string,
  data: UpdatePrivacyInput
): Promise<PodMember> {
  return apiClient<PodMember>(`/api/pods/${podId}/privacy`, {
    method: 'PATCH',
    headers,
    body: data,
  })
}

// ---- Invites ----

export async function inviteMember(
  headers: Record<string, string>,
  podId: string,
  email: string
): Promise<PodInvite> {
  return apiClient<PodInvite>(`/api/pods/${podId}/invite`, {
    method: 'POST',
    headers,
    body: { email },
  })
}

export async function joinByCode(
  headers: Record<string, string>,
  code: string
): Promise<{ podId: string; userId: string }> {
  return apiClient<{ podId: string; userId: string }>(`/api/pods/join/${code}`, {
    method: 'POST',
    headers,
  })
}

export async function joinByToken(
  headers: Record<string, string>,
  token: string
): Promise<{ podId: string; userId: string }> {
  return apiClient<{ podId: string; userId: string }>(`/api/pods/join/token/${token}`, {
    method: 'POST',
    headers,
  })
}

// ---- Captures ----

export async function shareCapture(
  headers: Record<string, string>,
  podId: string,
  data: ShareCaptureInput
): Promise<PodCapture> {
  return apiClient<PodCapture>(`/api/pods/${podId}/captures`, {
    method: 'POST',
    headers,
    body: data,
  })
}

export async function getPodCaptures(
  headers: Record<string, string>,
  podId: string,
  params?: { page?: number; limit?: number }
): Promise<{ captures: PodCapture[]; total: number }> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.limit) searchParams.set('limit', String(params.limit))
  const query = searchParams.toString() ? `?${searchParams.toString()}` : ''
  return apiClient<{ captures: PodCapture[]; total: number }>(
    `/api/pods/${podId}/captures${query}`,
    { headers }
  )
}

export async function addCaptureToQueue(
  headers: Record<string, string>,
  podId: string,
  captureId: string
): Promise<{ message: string }> {
  return apiClient<{ message: string }>(
    `/api/pods/${podId}/captures/${captureId}/add-to-queue`,
    { method: 'POST', headers }
  )
}

// ---- Leaderboard & Activity ----

export async function getPodLeaderboard(
  headers: Record<string, string>,
  podId: string
): Promise<LeaderboardEntry[]> {
  return apiClient<LeaderboardEntry[]>(`/api/pods/${podId}/leaderboard`, { headers })
}

export async function getPodActivity(
  headers: Record<string, string>,
  podId: string
): Promise<PodActivity[]> {
  return apiClient<PodActivity[]>(`/api/pods/${podId}/activity`, { headers })
}
