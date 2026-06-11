import type { Metadata } from 'next'
import { getAdminHeaders } from '@/lib/api/admin-session'
import {
  getAdminOrgs,
  type AdminOrgSort,
  type AdminOrgSsoFilter,
  type AdminOrgType,
  type AdminOrgsQuery,
  type AdminSubscriptionPlan,
} from '@/lib/api/admin'
import { AdminOrgsView } from '@/components/admin/admin-orgs-view'

export const metadata: Metadata = {
  title: 'Admin Organizations',
}

type AdminOrgsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const ORG_TYPES = new Set<AdminOrgType>(['PERSONAL', 'TEAM', 'ENTERPRISE'])
const PLANS = new Set<AdminSubscriptionPlan>(['FREE', 'PRO', 'ENTERPRISE'])
const SSO_FILTERS = new Set<AdminOrgSsoFilter>(['true', 'false', 'any'])
const ORG_SORTS = new Set<AdminOrgSort>([
  'created_desc',
  'created_asc',
  'member_count_desc',
  'member_count_asc',
  'mrr_desc',
  'mrr_asc',
])

export default async function AdminOrgsPage({ searchParams }: AdminOrgsPageProps) {
  const [params, headers] = await Promise.all([searchParams, getAdminHeaders()])
  const query = normalizeQuery(params)
  const data = await getAdminOrgs(headers, query)

  return <AdminOrgsView data={data} query={query} />
}

function normalizeQuery(params: Record<string, string | string[] | undefined>): AdminOrgsQuery {
  const search = first(params.search)
  const type = first(params.type)
  const plan = first(params.plan)
  const sso = first(params.sso)
  const sort = first(params.sort)
  const cursor = first(params.cursor)
  const limit = Number(first(params.limit))
  const showArchived = first(params.showArchived)

  return {
    search: search || undefined,
    type: ORG_TYPES.has(type as AdminOrgType) ? (type as AdminOrgType) : undefined,
    plan: PLANS.has(plan as AdminSubscriptionPlan) ? (plan as AdminSubscriptionPlan) : undefined,
    sso: SSO_FILTERS.has(sso as AdminOrgSsoFilter) && sso !== 'any' ? (sso as AdminOrgSsoFilter) : undefined,
    sort: ORG_SORTS.has(sort as AdminOrgSort) ? (sort as AdminOrgSort) : 'created_desc',
    cursor: cursor || undefined,
    limit: [25, 50, 100].includes(limit) ? limit : 25,
    showArchived: showArchived === 'true' ? true : undefined,
  }
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
