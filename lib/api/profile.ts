import { apiClient } from '@/lib/api/client'
import type { ProfileSummary, UserEducation, UserCertification, SuggestionStatus } from '@/lib/types'

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` })

export async function getProfileSummary(accessToken: string): Promise<ProfileSummary> {
  return apiClient<ProfileSummary>('/api/profile', {
    headers: authHeaders(accessToken),
  })
}

// ─── Education ──────────────────────────────────────────

export async function addEducation(
  accessToken: string,
  data: { educationLevel: string; fieldOfStudy: string; institution?: string; graduationYear?: number; isCurrent?: boolean }
): Promise<UserEducation> {
  return apiClient<UserEducation>('/api/profile/education', {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: data,
  })
}

export async function updateEducation(
  accessToken: string,
  id: string,
  data: { educationLevel: string; fieldOfStudy: string; institution?: string; graduationYear?: number; isCurrent?: boolean }
): Promise<UserEducation> {
  return apiClient<UserEducation>(`/api/profile/education/${id}`, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: data,
  })
}

export async function deleteEducation(accessToken: string, id: string) {
  return apiClient(`/api/profile/education/${id}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  })
}

// ─── Certifications ──────────────────────────────────────

export async function addCertification(
  accessToken: string,
  data: { name: string; issuingOrg?: string; issueDate?: string; expiryDate?: string; credentialUrl?: string }
): Promise<UserCertification> {
  return apiClient<UserCertification>('/api/profile/certifications', {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: data,
  })
}

export async function updateCertification(
  accessToken: string,
  id: string,
  data: { name: string; issuingOrg?: string; issueDate?: string; expiryDate?: string; credentialUrl?: string }
): Promise<UserCertification> {
  return apiClient<UserCertification>(`/api/profile/certifications/${id}`, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: data,
  })
}

export async function deleteCertification(accessToken: string, id: string) {
  return apiClient(`/api/profile/certifications/${id}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  })
}

// ─── AI Suggestions ──────────────────────────────────────

export async function regenerateSuggestions(accessToken: string) {
  return apiClient('/api/profile/regenerate-suggestions', {
    method: 'POST',
    headers: authHeaders(accessToken),
  })
}

export async function getSuggestionStatus(accessToken: string): Promise<SuggestionStatus> {
  return apiClient<SuggestionStatus>('/api/profile/suggestion-status', {
    headers: authHeaders(accessToken),
  })
}
