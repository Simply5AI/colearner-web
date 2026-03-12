import { apiClient } from '@/lib/api/client'
import type { UserProfile, StreakData } from '@/lib/types'

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
      'name' | 'profileImageUrl' | 'bio' | 'goals' | 'dailyGoalMinutes' | 'skillsInterests' | 'preferredLanguage'
    >
  >
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

// --- Onboarding API ---

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` })

export async function updateOnboardingProfile(
  accessToken: string,
  data: { displayName: string; bio?: string; avatarUrl?: string }
) {
  return apiClient('/api/onboarding/profile', {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: data,
  })
}

export async function updateOnboardingGoal(
  accessToken: string,
  data: { learningGoal: string; dailyTimeMinutes: number }
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
