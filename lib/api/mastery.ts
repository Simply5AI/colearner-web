import { apiClient } from '@/lib/api/client'
import type {
  MasteryAnalyticsStats,
  DailyPassRate,
  TypeBreakdown,
  ConceptLedgerEntry,
} from '@/lib/types'

export async function getMasteryStats(
  headers: Record<string, string>,
  range: '7d' | '30d' | 'all' = '30d'
): Promise<MasteryAnalyticsStats> {
  return apiClient<MasteryAnalyticsStats>(
    `/api/mastery/stats?range=${range}`,
    { headers }
  )
}

export async function getDailyPassRates(
  headers: Record<string, string>,
  range: '7d' | '30d' = '30d'
): Promise<DailyPassRate[]> {
  return apiClient<DailyPassRate[]>(`/api/mastery/daily?range=${range}`, {
    headers,
  })
}

export async function getTypeBreakdown(
  headers: Record<string, string>
): Promise<TypeBreakdown[]> {
  return apiClient<TypeBreakdown[]>('/api/mastery/by-type', { headers })
}

export async function getConceptLedger(
  headers: Record<string, string>,
  params?: { page?: number; sort?: string; order?: 'asc' | 'desc' }
): Promise<{ data: ConceptLedgerEntry[]; total: number; page: number }> {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', String(params.page))
  if (params?.sort) query.set('sort', params.sort)
  if (params?.order) query.set('order', params.order)
  const qs = query.toString()
  return apiClient<{ data: ConceptLedgerEntry[]; total: number; page: number }>(
    `/api/mastery/concepts/ledger${qs ? `?${qs}` : ''}`,
    { headers }
  )
}

export async function exportMasteryCSV(
  headers: Record<string, string>
): Promise<Blob> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
  const res = await fetch(`${apiUrl}/api/mastery/export`, {
    headers: {
      Authorization: headers.Authorization || '',
    },
  })

  if (!res.ok) {
    throw new Error('Failed to export CSV')
  }

  return res.blob()
}
