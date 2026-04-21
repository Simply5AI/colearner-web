import { apiClient } from '@/lib/api/client'
import type {
  MasteryAnalyticsStats,
  DailyPassRate,
  TypeBreakdown,
  ConceptLedgerEntry,
} from '@/lib/types'

function appendRoadmap(qs: URLSearchParams, roadmapId?: string) {
  if (roadmapId) qs.set('roadmapId', roadmapId)
}

export async function getMasteryStats(
  headers: Record<string, string>,
  range: '7d' | '30d' | 'all' = '30d',
  roadmapId?: string
): Promise<MasteryAnalyticsStats> {
  const qs = new URLSearchParams({ range })
  appendRoadmap(qs, roadmapId)
  return apiClient<MasteryAnalyticsStats>(
    `/api/mastery/stats?${qs.toString()}`,
    { headers }
  )
}

export async function getDailyPassRates(
  headers: Record<string, string>,
  range: '7d' | '30d' = '30d',
  roadmapId?: string
): Promise<DailyPassRate[]> {
  const qs = new URLSearchParams({ range })
  appendRoadmap(qs, roadmapId)
  return apiClient<DailyPassRate[]>(`/api/mastery/daily?${qs.toString()}`, {
    headers,
  })
}

type LegacyTypeBreakdownResponse = Record<
  string,
  { passRate?: number; attempts?: number } | undefined
>

type LegacyConceptLedgerEntry = {
  id: string
  title: string
  attempts?: number
  passRate?: number
  ef?: number
  nextReview?: string | null
  status?: 'Strong' | 'Fair' | 'Weak' | string
}

type LegacyConceptLedgerResponse = {
  data: LegacyConceptLedgerEntry[]
  meta?: {
    total?: number
    page?: number
  }
}

function isNormalizedConceptLedgerResponse(
  response: { data: ConceptLedgerEntry[]; total: number; page: number } | LegacyConceptLedgerResponse
): response is { data: ConceptLedgerEntry[]; total: number; page: number } {
  return 'total' in response && typeof response.total === 'number'
}

const masteryTypeMap: Record<string, TypeBreakdown['type']> = {
  FREE_TEXT: 'FREE_TEXT',
  MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
  TRUE_FALSE: 'TRUE_FALSE',
  open: 'FREE_TEXT',
  mcq: 'MULTIPLE_CHOICE',
  cloze: 'TRUE_FALSE',
}

function isTypeBreakdownArray(value: unknown): value is TypeBreakdown[] {
  return Array.isArray(value)
}

function normalizeTypeBreakdown(
  value: TypeBreakdown[] | LegacyTypeBreakdownResponse
): TypeBreakdown[] {
  if (isTypeBreakdownArray(value)) {
    return value
  }

  return Object.entries(value).flatMap(([type, metrics]) => {
    const mappedType = masteryTypeMap[type]
    if (!mappedType || !metrics) return []

    return [
      {
        type: mappedType,
        passRate: metrics.passRate ?? 0,
        attempts: metrics.attempts ?? 0,
      },
    ]
  })
}

function normalizeConceptLedgerStatus(
  status?: string
): ConceptLedgerEntry['status'] {
  switch (status?.toLowerCase()) {
    case 'strong':
      return 'strong'
    case 'weak':
      return 'weak'
    default:
      return 'fair'
  }
}

function normalizeConceptLedger(
  response:
    | { data: ConceptLedgerEntry[]; total: number; page: number }
    | LegacyConceptLedgerResponse
): { data: ConceptLedgerEntry[]; total: number; page: number } {
  if (isNormalizedConceptLedgerResponse(response)) {
    return response
  }

  return {
    data: (response.data ?? []).map((entry) => ({
      conceptId: entry.id,
      conceptTitle: entry.title,
      attempts: entry.attempts ?? 0,
      passRate: entry.passRate ?? 0,
      avgScore: entry.passRate ?? 0,
      easeFactor: entry.ef ?? 2.5,
      nextReviewDate: entry.nextReview ?? new Date(0).toISOString(),
      status: normalizeConceptLedgerStatus(entry.status),
    })),
    total: response.meta?.total ?? response.data?.length ?? 0,
    page: response.meta?.page ?? 1,
  }
}

export async function getTypeBreakdown(
  headers: Record<string, string>,
  roadmapId?: string
): Promise<TypeBreakdown[]> {
  const qs = new URLSearchParams()
  appendRoadmap(qs, roadmapId)
  const queryString = qs.toString()
  const response = await apiClient<TypeBreakdown[] | LegacyTypeBreakdownResponse>(
    `/api/mastery/by-type${queryString ? `?${queryString}` : ''}`,
    { headers }
  )

  return normalizeTypeBreakdown(response)
}

export async function getConceptLedger(
  headers: Record<string, string>,
  params?: { page?: number; sort?: string; order?: 'asc' | 'desc'; roadmapId?: string }
): Promise<{ data: ConceptLedgerEntry[]; total: number; page: number }> {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', String(params.page))
  if (params?.sort) query.set('sort', params.sort)
  if (params?.order) query.set('order', params.order)
  appendRoadmap(query, params?.roadmapId)
  const qs = query.toString()
  const response = await apiClient<
    { data: ConceptLedgerEntry[]; total: number; page: number } | LegacyConceptLedgerResponse
  >(
    `/api/mastery/concepts/ledger${qs ? `?${qs}` : ''}`,
    { headers }
  )

  return normalizeConceptLedger(response)
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
