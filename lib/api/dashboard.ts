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

export async function getRecallQueue(
  headers: Record<string, string>,
  params?: { type?: string; failed?: boolean }
): Promise<RecallQueueItem[]> {
  const query = new URLSearchParams()
  if (params?.type) query.set('type', params.type)
  if (params?.failed) query.set('failed', 'true')
  const qs = query.toString()
  return apiClient<RecallQueueItem[]>(
    `/api/dashboard/recall-queue${qs ? `?${qs}` : ''}`,
    { headers }
  )
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
