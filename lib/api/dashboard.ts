import { apiClient } from '@/lib/api/client'
import type {
  DashboardStats,
  RecallQueueItem,
  ActivityItem,
  SourceProgress,
  StreakCalendar,
} from '@/lib/types'

export async function getDashboardStats(
  headers: Record<string, string>
): Promise<DashboardStats> {
  return apiClient<DashboardStats>('/api/dashboard/stats', { headers })
}

interface BackendQueueItem {
  questionId: string
  conceptTitle: string
  type: string
  source: string
  sm2: { ef: number; interval: number; nextReviewDate: string } | null
}

export async function getRecallQueue(
  headers: Record<string, string>,
  params?: { type?: string; failed?: boolean }
): Promise<RecallQueueItem[]> {
  const query = new URLSearchParams()
  if (params?.type) query.set('type', params.type)
  if (params?.failed) query.set('failed', 'true')
  const qs = query.toString()
  const res = await apiClient<{ items: BackendQueueItem[]; count: number } | BackendQueueItem[]>(
    `/api/dashboard/recall-queue${qs ? `?${qs}` : ''}`,
    { headers }
  )
  const raw = Array.isArray(res) ? res : res.items ?? []
  const mapped = raw.map((r) => ({
    id: r.questionId,
    conceptTitle: r.conceptTitle,
    type: r.type as RecallQueueItem['type'],
    source: (r.sm2 ? 'sm2_due' : 'failed') as RecallQueueItem['source'],
    lastScore: null as number | null,
    easeFactor: r.sm2?.ef ?? 2.5,
    interval: r.sm2?.interval ?? 0,
    dueDate: r.sm2?.nextReviewDate ?? new Date().toISOString(),
    dueCount: 1,
  }))

  // Group by concept title so each concept appears once
  const grouped = new Map<string, RecallQueueItem>()
  for (const item of mapped) {
    const existing = grouped.get(item.conceptTitle)
    if (!existing) {
      grouped.set(item.conceptTitle, item)
    } else {
      existing.dueCount++
      // Keep worst metrics (lowest EF = hardest, shortest interval)
      if (item.easeFactor < existing.easeFactor) existing.easeFactor = item.easeFactor
      if (item.interval < existing.interval) existing.interval = item.interval
      // Prefer failed source if any question failed
      if (item.source === 'failed') existing.source = 'failed'
    }
  }
  return Array.from(grouped.values())
}

export async function getActivity(
  headers: Record<string, string>,
  page = 1
): Promise<ActivityItem[]> {
  return apiClient<ActivityItem[]>(`/api/dashboard/activity?page=${page}`, {
    headers,
  })
}

export async function getSourceProgress(
  headers: Record<string, string>
): Promise<SourceProgress> {
  return apiClient<SourceProgress>('/api/dashboard/source-progress', {
    headers,
  })
}

export async function getStreakCalendar(
  headers: Record<string, string>
): Promise<StreakCalendar> {
  return apiClient<StreakCalendar>('/api/dashboard/streak', { headers })
}
