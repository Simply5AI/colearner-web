import { apiClient } from '@/lib/api/client'

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` })

export interface LearningMemory {
  id: string
  type: string
  content: string
  confidence: number
  status: string
  source: string
  updatedAt: string
  sources?: Array<{ id: string; sourceType: string; sourceId: string }>
}

export interface LearningProfileInsight {
  id: string
  title: string
  summary: string
  status: string
  confidence: number
  evidenceCount: number
  memoryIds: string[]
  sourceTypes: string[]
  lastSeenAt: string
  lastUsedAt: string | null
  conceptId?: string | null
  extractionId?: string | null
}

export interface LearnerConceptLevel {
  conceptId: string
  title: string
  level: 'beginner' | 'intermediate' | 'advanced' | 'needs_attention'
  averageReviewEase: number
  questionsReviewed: number
  lastPracticedAt: string | null
}

export interface MemoryUsageItem {
  id: string
  memoryId: string
  content: string
  type: string
  purpose: string
  createdAt: string
}

export interface LearningProfileDashboard {
  learnerBrief: string
  stats: {
    activeMemories: number
    weakAreas: number
    strengths: number
    reviewedConcepts: number
  }
  profile: LearningProfileInsight[]
  preferences: LearningProfileInsight[]
  weakAreas: LearningProfileInsight[]
  strengths: LearnerConceptLevel[]
  conceptLevels: LearnerConceptLevel[]
  recentEvidence: LearningProfileInsight[]
  usage: MemoryUsageItem[]
  rawMemoryCount: number
}

export async function getMemories(accessToken: string): Promise<LearningMemory[]> {
  return apiClient<LearningMemory[]>('/api/memory', {
    headers: authHeaders(accessToken),
  })
}

export async function getLearningProfile(accessToken: string): Promise<LearningProfileDashboard> {
  return apiClient<LearningProfileDashboard>('/api/memory/profile', {
    headers: authHeaders(accessToken),
  })
}

export async function updateMemory(
  accessToken: string,
  id: string,
  data: { content?: string; status?: string }
): Promise<LearningMemory> {
  return apiClient<LearningMemory>(`/api/memory/${id}`, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: data,
  })
}

export async function archiveMemory(accessToken: string, id: string): Promise<LearningMemory> {
  return apiClient<LearningMemory>(`/api/memory/${id}/archive`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  })
}

export async function deleteMemory(accessToken: string, id: string): Promise<LearningMemory> {
  return apiClient<LearningMemory>(`/api/memory/${id}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  })
}

export async function resolveMemory(
  accessToken: string,
  id: string,
  reason?: string
): Promise<LearningMemory> {
  return apiClient<LearningMemory>(`/api/memory/${id}/resolve`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: reason ? { reason } : {},
  })
}

export interface MemoryDiff {
  since: string
  counts: { created: number; updated: number; resolved: number }
  created: LearningMemory[]
  updated: LearningMemory[]
  resolved: LearningMemory[]
}

export async function getMemoryDiff(accessToken: string, since?: string): Promise<MemoryDiff> {
  const qs = since ? `?since=${encodeURIComponent(since)}` : ''
  return apiClient<MemoryDiff>(`/api/memory/diff${qs}`, {
    headers: authHeaders(accessToken),
  })
}

export async function markMemoryViewed(accessToken: string): Promise<{ ok: boolean }> {
  return apiClient<{ ok: boolean }>(`/api/memory/mark-viewed`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  })
}

export interface MemorySourceDetail {
  memoryId: string
  type: string
  content: string
  confidence: number
  status: string
  createdAt: string
  lastReinforcedAt: string | null
  sources: Array<{
    id: string
    sourceType: string
    sourceId: string
    metadata?: Record<string, unknown> | null
    createdAt: string
  }>
}

export async function getMemorySource(
  accessToken: string,
  id: string
): Promise<MemorySourceDetail> {
  return apiClient<MemorySourceDetail>(`/api/memory/${id}/source`, {
    headers: authHeaders(accessToken),
  })
}
