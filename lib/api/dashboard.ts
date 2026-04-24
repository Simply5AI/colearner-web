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
  extractionId: string | null
  conceptTitle: string
  type: string
  source: string
  reviewSchedule: { reviewEase: number; interval: number; nextReviewDate: string } | null
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

  // Group by extraction so each source appears once, with the worst mastery signal across its questions
  const grouped = new Map<string, RecallQueueItem>()
  const sourceRank: Record<RecallQueueItem['source'], number> = { weak: 0, new: 1, practiced: 2 }
  for (const r of raw) {
    const reviewEase = r.reviewSchedule?.reviewEase ?? null
    let masteryState: RecallQueueItem['source']
    if (reviewEase === null) masteryState = 'new'
    else if (reviewEase < 2.0) masteryState = 'weak'
    else masteryState = 'practiced'

    const key = r.extractionId ?? r.source
    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, {
        id: r.questionId,
        extractionId: r.extractionId,
        conceptTitle: r.source,
        type: r.type as RecallQueueItem['type'],
        source: masteryState,
        lastScore: null,
        reviewEase: reviewEase ?? 2.5,
        interval: r.reviewSchedule?.interval ?? 0,
        dueDate: r.reviewSchedule?.nextReviewDate ?? '',
        dueCount: 1,
      })
    } else {
      existing.dueCount++
      if ((reviewEase ?? 2.5) < existing.reviewEase) existing.reviewEase = reviewEase ?? 2.5
      if ((r.reviewSchedule?.interval ?? 0) < existing.interval) existing.interval = r.reviewSchedule?.interval ?? 0
      if (sourceRank[masteryState] < sourceRank[existing.source]) existing.source = masteryState
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
