import type { Metadata } from 'next'
import { auth } from '@/lib/auth/config'
import { getAdminHeaders } from '@/lib/api/admin-session'
import { getAdminUsers, type AdminUserSort, type AdminUserStatus, type AdminUsersQuery } from '@/lib/api/admin'
import { AdminUsersView } from '@/components/admin/admin-users-view'

export const metadata: Metadata = {
  title: 'Admin Users',
}

type AdminUsersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const USER_STATUSES = new Set<AdminUserStatus>(['ACTIVE', 'SUSPENDED', 'DELETED'])
const USER_SORTS = new Set<AdminUserSort>([
  'created_desc',
  'created_asc',
  'name_asc',
  'name_desc',
  'last_active_desc',
  'last_active_asc',
])

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const [params, headers, session] = await Promise.all([searchParams, getAdminHeaders(), auth()])
  const query = normalizeQuery(params)
  const data = await getAdminUsers(headers, query)

  return <AdminUsersView data={data} query={query} currentAdminId={session?.user?.id ?? ''} />
}

function normalizeQuery(params: Record<string, string | string[] | undefined>): AdminUsersQuery {
  const search = first(params.search)
  const orgId = first(params.orgId)
  const systemRole = first(params.systemRole)
  const status = first(params.status)
  const from = first(params.from)
  const to = first(params.to)
  const sort = first(params.sort)
  const cursor = first(params.cursor)
  const limit = Number(first(params.limit))

  return {
    search: search || undefined,
    orgId: orgId || undefined,
    systemRole: systemRole || undefined,
    status: USER_STATUSES.has(status as AdminUserStatus) ? (status as AdminUserStatus) : undefined,
    from: from || undefined,
    to: to || undefined,
    sort: USER_SORTS.has(sort as AdminUserSort) ? (sort as AdminUserSort) : 'created_desc',
    cursor: cursor || undefined,
    limit: [25, 50, 100].includes(limit) ? limit : 25,
  }
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
