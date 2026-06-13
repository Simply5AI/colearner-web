import type { Metadata } from 'next'
import { getAdminHeaders } from '@/lib/api/admin-session'
import { getAdminExtractions, type AdminExtractionSort, type AdminExtractionStatus, type AdminExtractionsQuery } from '@/lib/api/admin'
import { AdminContentExtractionsView } from '@/components/admin/admin-content-extractions-view'

export const metadata: Metadata = { title: 'Extractions — Admin' }

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const STATUSES = new Set<AdminExtractionStatus>(['PENDING', 'PROCESSING', 'COMPLETED_PASS1', 'COMPLETED', 'FAILED'])
const SORTS = new Set<AdminExtractionSort>(['created_desc', 'created_asc', 'duration_desc', 'duration_asc'])

export default async function AdminContentExtractionsPage({ searchParams }: PageProps) {
  const [params, headers] = await Promise.all([searchParams, getAdminHeaders()])
  const query = normalizeQuery(params)
  const data = await getAdminExtractions(headers, query)
  return <AdminContentExtractionsView data={data} query={query} />
}

function normalizeQuery(params: Record<string, string | string[] | undefined>): AdminExtractionsQuery {
  const status = first(params.status)
  const sort = first(params.sort)
  const limit = Number(first(params.limit))
  return {
    search: first(params.search) || undefined,
    status: STATUSES.has(status as AdminExtractionStatus) ? (status as AdminExtractionStatus) : undefined,
    orgId: first(params.orgId) || undefined,
    from: first(params.from) || undefined,
    to: first(params.to) || undefined,
    sort: SORTS.has(sort as AdminExtractionSort) ? (sort as AdminExtractionSort) : 'created_desc',
    cursor: first(params.cursor) || undefined,
    limit: [25, 50, 100].includes(limit) ? limit : 25,
  }
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}