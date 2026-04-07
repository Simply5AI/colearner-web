import { apiClient } from '@/lib/api/client'
import type { Roadmap, CreateRoadmapInput } from '@/lib/types'

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
  itemId: string
): Promise<{ extraction: { id: string; status: string } }> {
  return apiClient(`/api/roadmaps/${roadmapId}/items/${itemId}/capture`, {
    method: 'POST',
    headers,
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
