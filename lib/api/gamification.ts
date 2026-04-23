import { apiClient } from './client'

export interface DailyQuestItem {
  id: string
  title: string
  target: number
  current: number
  isCompleted: boolean
}

export interface DailyQuest {
  date: string
  items: DailyQuestItem[]
  isAllCompleted: boolean
}

export interface BadgeProgress {
  current: number
  threshold: number
}

export interface Badge {
  id: string
  userBadgeId?: string
  slug: string
  name: string
  description: string
  icon: string
  category: string
  tier: string
  isEarned: boolean
  earnedAt?: string
  notified?: boolean
  progress?: BadgeProgress
}

export interface BadgeListResponse {
  earned: Badge[]
  locked: Badge[]
}

export async function getDailyQuest(headers: Record<string, string>): Promise<DailyQuest> {
  return apiClient<DailyQuest>('/api/gamification/daily-quest', { headers })
}

export async function getBadges(headers: Record<string, string>): Promise<BadgeListResponse> {
  return apiClient<BadgeListResponse>('/api/gamification/badges', { headers })
}

export async function getRecentBadges(headers: Record<string, string>): Promise<Badge[]> {
  return apiClient<Badge[]>('/api/gamification/badges/recent', { headers })
}

export async function acknowledgeBadge(id: string, headers: Record<string, string>): Promise<{ success: boolean }> {
  return apiClient<{ success: boolean }>(`/api/gamification/badges/${id}/acknowledge`, {
    method: 'POST',
    headers,
  })
}
