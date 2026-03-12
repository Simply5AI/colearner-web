import { apiClient } from '@/lib/api/client'
import type { Extraction, ExtractionListResponse } from '@/lib/types'

export async function listExtractions(
  headers: Record<string, string>,
  params?: { status?: string; page?: number; limit?: number }
): Promise<ExtractionListResponse> {
  const searchParams = new URLSearchParams()
  if (params?.status) searchParams.set('status', params.status)
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.limit) searchParams.set('limit', String(params.limit))

  const query = searchParams.toString() ? `?${searchParams.toString()}` : ''
  return apiClient<ExtractionListResponse>(`/api/extractions${query}`, {
    headers,
  })
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
