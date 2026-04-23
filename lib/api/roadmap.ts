import { apiClient } from '@/lib/api/client'
import type { Roadmap, Goal, StudyPlanListItem, CreateRoadmapInput, Recommendation } from '@/lib/types'

export async function getRoadmaps(
  headers: Record<string, string>
): Promise<{ roadmaps: Roadmap[] }> {
  return apiClient<{ roadmaps: Roadmap[] }>('/api/roadmaps', { headers })
}

export async function getRoadmap(
  headers: Record<string, string>,
  id: string
): Promise<{ roadmap: Roadmap }> {
  return apiClient<{ roadmap: Roadmap }>(`/api/roadmaps/${id}`, { headers })
}

export async function createRoadmap(
  headers: Record<string, string>,
  input: CreateRoadmapInput
): Promise<{ roadmap: Roadmap }> {
  return apiClient<{ roadmap: Roadmap }>('/api/roadmaps', {
    method: 'POST',
    headers,
    body: input,
  })
}

export async function updateRoadmap(
  headers: Record<string, string>,
  id: string,
  data: { goalId?: string; status?: string }
): Promise<{ roadmap: Roadmap }> {
  return apiClient<{ roadmap: Roadmap }>(`/api/roadmaps/${id}`, {
    method: 'PATCH',
    headers,
    body: data,
  })
}

export async function deleteRoadmap(
  headers: Record<string, string>,
  id: string
): Promise<void> {
  await apiClient(`/api/roadmaps/${id}`, { method: 'DELETE', headers })
}

export async function captureRoadmapItem(
  headers: Record<string, string>,
  roadmapId: string,
  itemId: string,
  url?: string
): Promise<{ extraction: { id: string; status: string } }> {
  return apiClient(`/api/roadmaps/${roadmapId}/items/${itemId}/capture`, {
    method: 'POST',
    headers,
    ...(url ? { body: { url } } : {}),
  })
}

export async function skipRoadmapItem(
  headers: Record<string, string>,
  roadmapId: string,
  itemId: string
): Promise<void> {
  await apiClient(`/api/roadmaps/${roadmapId}/items/${itemId}/skip`, {
    method: 'POST',
    headers,
  })
}

// ─── Unified ────────────────────────────────────────────────────────────────

export async function getUnifiedRoadmaps(
  headers: Record<string, string>
): Promise<{ roadmaps: Roadmap[]; goalsWithoutRoadmap: Goal[]; studyPlans: StudyPlanListItem[] }> {
  return apiClient<{ roadmaps: Roadmap[]; goalsWithoutRoadmap: Goal[]; studyPlans: StudyPlanListItem[] }>(
    '/api/roadmaps/unified',
    { headers }
  )
}

// ─── Recommendations ────────────────────────────────────────────────────────

export async function getRecommendations(
  headers: Record<string, string>,
  roadmapId: string
): Promise<{ recommendations: Recommendation[] }> {
  return apiClient<{ recommendations: Recommendation[] }>(`/api/roadmaps/${roadmapId}/recommendations`, { headers })
}

export async function generateRecommendations(
  headers: Record<string, string>,
  roadmapId: string
): Promise<{ status: string }> {
  return apiClient<{ status: string }>(`/api/roadmaps/${roadmapId}/recommendations/generate`, {
    method: 'POST',
    headers,
  })
}

export async function acceptRecommendation(
  headers: Record<string, string>,
  roadmapId: string,
  recommendationId: string,
  phaseId?: string
): Promise<{ item: unknown }> {
  return apiClient(`/api/roadmaps/${roadmapId}/recommendations/${recommendationId}/accept`, {
    method: 'POST',
    headers,
    ...(phaseId ? { body: { phaseId } } : {}),
  })
}

export async function dismissRecommendation(
  headers: Record<string, string>,
  roadmapId: string,
  recommendationId: string
): Promise<{ dismissed: boolean }> {
  return apiClient<{ dismissed: boolean }>(`/api/roadmaps/${roadmapId}/recommendations/${recommendationId}/dismiss`, {
    method: 'POST',
    headers,
  })
}
