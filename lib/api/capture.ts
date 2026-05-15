import { apiClient } from '@/lib/api/client'
import type { CaptureStats, ExtractionProgress } from '@/lib/types'

interface CaptureResponse {
  extractionId?: string
  extraction?: { id: string }
  deduped?: boolean
}

export interface CaptureResult {
  extractionId: string
  deduped: boolean
}

function normalizeExtractionId(response: CaptureResponse): CaptureResult {
  const extractionId = response.extractionId ?? response.extraction?.id
  if (!extractionId) {
    throw new Error('Capture queued, but the API did not return an extraction id')
  }
  return { extractionId, deduped: response.deduped === true }
}

export async function getCaptureStats(
  headers: Record<string, string>
): Promise<CaptureStats> {
  return apiClient<CaptureStats>('/api/capture/stats', { headers })
}

export async function captureYouTube(
  headers: Record<string, string>,
  url: string,
  options?: { autoTranscript?: boolean; questionTypes?: string[] },
  topicIds?: string[],
  roadmapId?: string
): Promise<CaptureResult> {
  const response = await apiClient<CaptureResponse>('/api/capture/youtube', {
    method: 'POST',
    headers,
    body: { url, options, topicIds, roadmapId },
  })
  return normalizeExtractionId(response)
}

export async function captureWeb(
  headers: Record<string, string>,
  url: string,
  topicIds?: string[],
  roadmapId?: string
): Promise<CaptureResult> {
  const response = await apiClient<CaptureResponse>('/api/capture/web', {
    method: 'POST',
    headers,
    body: { url, topicIds, roadmapId },
  })
  return normalizeExtractionId(response)
}

function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
}

async function uploadFile(
  path: string,
  headers: Record<string, string>,
  formData: FormData
): Promise<CaptureResult> {
  const res = await fetch(`${getApiUrl()}${path}`, {
    method: 'POST',
    headers: {
      Authorization: headers.Authorization || '',
    },
    body: formData,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(error.data?.message || error.message || res.statusText)
  }

  const json = await res.json()
  return normalizeExtractionId(json.data ?? json)
}

export async function captureDocument(
  headers: Record<string, string>,
  file: File,
  roadmapId?: string
): Promise<CaptureResult> {
  const formData = new FormData()
  formData.append('file', file)
  if (roadmapId) formData.append('roadmapId', roadmapId)
  return uploadFile('/api/capture/document', headers, formData)
}

export async function captureAudio(
  headers: Record<string, string>,
  file: File | Blob,
  roadmapId?: string
): Promise<CaptureResult> {
  const formData = new FormData()
  formData.append('file', file)
  if (roadmapId) formData.append('roadmapId', roadmapId)
  return uploadFile('/api/capture/audio', headers, formData)
}

export async function captureVideo(
  headers: Record<string, string>,
  file: File,
  roadmapId?: string
): Promise<CaptureResult> {
  const formData = new FormData()
  formData.append('file', file)
  if (roadmapId) formData.append('roadmapId', roadmapId)
  return uploadFile('/api/capture/video', headers, formData)
}

export interface SaveLocalResultsPayload {
  videoUrl: string
  title: string
  sourceType?: string
  topicIds?: string[]
  concepts: { title: string; description: string; order: number }[]
  questions: {
    conceptIndex: number
    type: string
    text: string
    options: string[]
    correctIndex: number
    explanation: string
  }[]
}

export async function saveLocalResults(
  headers: Record<string, string>,
  payload: SaveLocalResultsPayload
): Promise<{ extractionId: string }> {
  return apiClient<{ extractionId: string }>('/api/capture/local-results', {
    method: 'POST',
    headers,
    body: payload,
  })
}

export async function getExtractionStatus(
  headers: Record<string, string>,
  extractionId: string
): Promise<ExtractionProgress> {
  return apiClient<ExtractionProgress>(`/api/extractions/${extractionId}`, { headers })
}
