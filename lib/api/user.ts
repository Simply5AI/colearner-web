import { apiClient, getApiUrl } from '@/lib/api/client'
import type { UserProfile, StreakData, TopicItem } from '@/lib/types'

export async function getProfile(accessToken: string): Promise<UserProfile> {
  return apiClient<UserProfile>('/api/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export async function updateProfile(
  accessToken: string,
  data: Partial<
    Pick<
      UserProfile,
      'name' | 'bio' | 'avatarUrl' | 'learningGoal' | 'dailyTimeMinutes' | 'dateOfBirth' | 'gradeLevel' | 'gender'
    >
  > & { topicSlugs?: string[] }
): Promise<UserProfile> {
  return apiClient<UserProfile>('/api/users/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: data,
  })
}

export async function getStreak(accessToken: string): Promise<StreakData> {
  return apiClient<StreakData>('/api/user/streak', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

// --- AI Settings API ---

export interface AISettings {
  processingMode: 'cloud' | 'local'
  ollamaBaseUrl: string
  ollamaPass1Model: string | null
  ollamaPass2Model: string | null
}

export async function updateAISettings(
  accessToken: string,
  data: Partial<AISettings>
): Promise<AISettings> {
  return apiClient<AISettings>('/api/users/me/ai-settings', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: data,
  })
}

// --- BYOK AI Credential API (server-side, encrypted at rest) ---

export type AiProvider = 'OPENROUTER' | 'ANTHROPIC' | 'GEMINI' | 'OPENAI'

export interface AiCredentialView {
  provider: AiProvider
  model: string | null
  apiKeyMasked: string
  updatedAt: string
}

export async function getAiCredential(
  accessToken: string,
): Promise<AiCredentialView | null> {
  return apiClient<AiCredentialView | null>('/api/users/me/ai-credential', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export async function upsertAiCredential(
  accessToken: string,
  data: { provider: AiProvider; apiKey: string; model?: string },
): Promise<AiCredentialView> {
  return apiClient<AiCredentialView>('/api/users/me/ai-credential', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: data,
  })
}

export async function deleteAiCredential(accessToken: string): Promise<{ ok: boolean }> {
  return apiClient<{ ok: boolean }>('/api/users/me/ai-credential', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export async function testAiCredential(
  accessToken: string,
  data: { provider: AiProvider; apiKey: string; model?: string },
): Promise<{ ok: boolean; model?: string; error?: string }> {
  return apiClient<{ ok: boolean; model?: string; error?: string }>(
    '/api/users/me/ai-credential/test',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: data,
    },
  )
}

// --- Onboarding API ---

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` })

export async function updateOnboardingProfile(
  accessToken: string,
  data: { displayName: string; bio?: string; avatarUrl?: string; dateOfBirth?: string; gradeLevel?: string; gender?: string; learnerType?: string }
) {
  return apiClient('/api/onboarding/profile', {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: data,
  })
}

export async function updateOnboardingGoal(
  accessToken: string,
  data: { learningGoal: string; goalTitle?: string }
) {
  return apiClient('/api/onboarding/goal', {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: data,
  })
}

export async function updateOnboardingSkills(
  accessToken: string,
  data: { topicIds: string[] }
) {
  return apiClient('/api/onboarding/skills', {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: data,
  })
}

export async function completeOnboarding(accessToken: string) {
  return apiClient('/api/onboarding/complete', {
    method: 'POST',
    headers: authHeaders(accessToken),
  })
}

// --- Onboarding Education & Certification API ---

export async function updateOnboardingEducation(
  accessToken: string,
  data: { educationLevel: string; fieldOfStudy: string; isCurrent?: boolean; institution?: string; graduationYear?: number }
) {
  return apiClient('/api/onboarding/education', {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: data,
  })
}

export async function updateOnboardingCertifications(
  accessToken: string,
  data: { certifications: Array<{ name: string; issuingOrg?: string; credentialUrl?: string }> }
) {
  return apiClient('/api/onboarding/certifications', {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: data,
  })
}

export async function triggerOnboardingSuggestions(accessToken: string) {
  return apiClient('/api/onboarding/generate-suggestions', {
    method: 'POST',
    headers: authHeaders(accessToken),
  })
}

export async function getOnboardingSuggestionStatus(accessToken: string) {
  return apiClient<import('@/lib/types').SuggestionStatus>('/api/onboarding/suggestion-status', {
    headers: authHeaders(accessToken),
  })
}

// --- Topics API ---

export async function getTopics(accessToken: string): Promise<TopicItem[]> {
  return apiClient<TopicItem[]>('/api/onboarding/topics', {
    headers: authHeaders(accessToken),
  })
}

// --- Avatar Upload API ---

export async function uploadAvatar(
  accessToken: string,
  file: File
): Promise<{ avatarUrl: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const apiUrl = getApiUrl()
  const res = await fetch(`${apiUrl}/api/users/me/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(error.data?.message || error.message || 'Upload failed')
  }
  const json = await res.json()
  return json.data ?? json
}
