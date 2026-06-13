import type { Metadata } from 'next'
import { getAdminHeaders } from '@/lib/api/admin-session'
import { getAdminPods, type AdminPodSort, type AdminPodVisibility, type AdminPodsQuery } from '@/lib/api/admin'
import { AdminContentPodsView } from '@/components/admin/admin-content-pods-view'

export const metadata: Metadata = { title: 'Pods — Admin' }

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const VISIBILITIES = new Set<AdminPodVisibility>(['PUBLIC', 'INVITE_ONLY'])
const SORTS = new Set<AdminPodSort>(['created_desc', 'created_asc', 'members_desc', 'members_asc'])

export default async function AdminContentPodsPage({ searchParams }: PageProps) {
  const [params, headers] = await Promise.all([searchParams, getAdminHeaders()])
  const query = normalizeQuery(params)
  const data = await getAdminPods(headers, query)
  return <AdminContentPodsView data={data} query={query} />
}

function normalizeQuery(params: Record<string, string | string[] | undefined>): AdminPodsQuery {
  const visibility = first(params.visibility)
  const sort = first(params.sort)
  const limit = Number(first(params.limit))
  return {
    search: first(params.search) || undefined,
    visibility: VISIBILITIES.has(visibility as AdminPodVisibility) ? (visibility as AdminPodVisibility) : undefined,
    orgId: first(params.orgId) || undefined,
    sort: SORTS.has(sort as AdminPodSort) ? (sort as AdminPodSort) : 'created_desc',
    cursor: first(params.cursor) || undefined,
    limit: [25, 50, 100].includes(limit) ? limit : 25,
  }
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}