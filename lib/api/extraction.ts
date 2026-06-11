import { apiClient } from '@/lib/api/client'
import type { Extraction, ExtractionListResponse, TopicItem } from '@/lib/types'

export async function listExtractions(
  headers: Record<string, string>,
  params?: { status?: string; page?: number; limit?: number; topicSlug?: string; sourceType?: string; roadmapId?: string; subjectId?: string }
): Promise<ExtractionListResponse> {
  const searchParams = new URLSearchParams()
  if (params?.status) searchParams.set('status', params.status)
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.topicSlug) searchParams.set('topicSlug', params.topicSlug)
  if (params?.sourceType) searchParams.set('sourceType', params.sourceType)
  if (params?.roadmapId) searchParams.set('roadmapId', params.roadmapId)
  if (params?.subjectId) searchParams.set('subjectId', params.subjectId)

  const query = searchParams.toString() ? `?${searchParams.toString()}` : ''
  return apiClient<ExtractionListResponse>(`/api/extractions${query}`, {
    headers,
  })
}

export async function getExtractionTopics(
  headers: Record<string, string>,
): Promise<TopicItem[]> {
  return apiClient<TopicItem[]>('/api/extractions/topics', { headers })
}

export async function getExtractionRoadmaps(
  headers: Record<string, string>,
): Promise<{ id: string; title: string; status: string }[]> {
  return apiClient<{ id: string; title: string; status: string }[]>('/api/extractions/roadmaps', { headers })
}

export async function getExtraction(
  headers: Record<string, string>,
  id: string
): Promise<Extraction> {
  return apiClient<Extraction>(`/api/extractions/${id}`, { headers })
}

export async function refreshExtractionMetadata(
  headers: Record<string, string>,
  id: string
): Promise<Extraction> {
  return apiClient<Extraction>(`/api/extractions/${id}/refresh-metadata`, {
    method: 'PATCH',
    headers,
  })
}

export async function deleteExtraction(
  headers: Record<string, string>,
  id: string
): Promise<{ message: string }> {
  return apiClient<{ message: string }>(`/api/extractions/${id}`, {
    method: 'DELETE',
    headers,
  })
}
