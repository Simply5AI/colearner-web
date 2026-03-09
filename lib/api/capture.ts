import { apiClient } from '@/lib/api/client'
import type { CaptureStats, ExtractionProgress } from '@/lib/types'

export async function getCaptureStats(
  headers: Record<string, string>
): Promise<CaptureStats> {
  return apiClient<CaptureStats>('/api/capture/stats', { headers })
}

export async function captureYouTube(
  headers: Record<string, string>,
  url: string,
  options?: { autoTranscript?: boolean; questionTypes?: string[] }
): Promise<{ extractionId: string }> {
  return apiClient<{ extractionId: string }>('/api/capture/youtube', {
    method: 'POST',
    headers,
    body: { url, options },
  })
}

export async function captureWeb(
  headers: Record<string, string>,
  url: string
): Promise<{ extractionId: string }> {
  return apiClient<{ extractionId: string }>('/api/capture/web', {
    method: 'POST',
    headers,
    body: { url },
  })
}

function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
}

async function uploadFile(
  path: string,
  headers: Record<string, string>,
  formData: FormData
): Promise<{ extractionId: string }> {
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
  return json.data ?? json
}

export async function captureDocument(
  headers: Record<string, string>,
  file: File
): Promise<{ extractionId: string }> {
  const formData = new FormData()
  formData.append('file', file)
  return uploadFile('/api/capture/document', headers, formData)
}

export async function captureAudio(
  headers: Record<string, string>,
  file: File | Blob
): Promise<{ extractionId: string }> {
  const formData = new FormData()
  formData.append('file', file)
  return uploadFile('/api/capture/audio', headers, formData)
}

export async function captureVideo(
  headers: Record<string, string>,
  file: File
): Promise<{ extractionId: string }> {
  const formData = new FormData()
  formData.append('file', file)
  return uploadFile('/api/capture/video', headers, formData)
}

export function getExtractionProgressSSE(
  extractionId: string,
  onProgress: (data: ExtractionProgress) => void,
  onError?: (error: Event) => void
): EventSource {
  const url = `${getApiUrl()}/api/capture/${extractionId}/status`
  const eventSource = new EventSource(url)

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data) as ExtractionProgress
    onProgress(data)
    if (data.status === 'completed' || data.status === 'failed') {
      eventSource.close()
    }
  }

  eventSource.onerror = (event) => {
    onError?.(event)
    eventSource.close()
  }

  return eventSource
}
