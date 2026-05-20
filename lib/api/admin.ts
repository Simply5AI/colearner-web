import { apiClient } from '@/lib/api/client'

export interface AdminMetric {
  total: number
  deltaPct: number | null
}

export interface AdminOverviewMetrics {
  users: AdminMetric
  orgs: AdminMetric
  extractions: AdminMetric & { byStatus: Record<string, number> }
  mrr: { value: number; deltaPct: number | null }
}

export interface AdminSeriesPoint {
  date: string
  count: number
}

export interface AdminActiveUsers {
  count: number
  series: AdminSeriesPoint[]
}

export interface AdminSignups {
  series: AdminSeriesPoint[]
}

export interface AdminQueueMetrics {
  available: boolean
  pending: number
  active: number
  failed: number
  completedLast24h: number
  message?: string
}

export interface AdminRecentUser {
  id: string
  email: string
  name: string
  orgName: string
  createdAt: string
}

export type AdminUserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED'

export type AdminUserSort =
  | 'created_desc'
  | 'created_asc'
  | 'name_asc'
  | 'name_desc'
  | 'last_active_desc'
  | 'last_active_asc'

export interface AdminUserListRow {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  systemRole: string
  status: AdminUserStatus
  org: {
    id: string
    name: string
    slug: string
    type: string
  }
  lastActiveAt: string | null
  createdAt: string
  suspendedAt: string | null
  deletedAt: string | null
}

export interface AdminUsersResponse {
  items: AdminUserListRow[]
  nextCursor: string | null
  total: number
}

export interface AdminUsersQuery {
  search?: string
  orgId?: string
  systemRole?: string
  status?: AdminUserStatus
  from?: string
  to?: string
  sort?: AdminUserSort
  cursor?: string
  limit?: number
}

export interface AdminBulkUsersResponse {
  succeeded: string[]
  failed: Array<{ userId: string; reason: string }>
}

export interface AdminPanel<T> {
  data: T | null
  error: string | null
}

export interface AdminDashboardData {
  overview: AdminPanel<AdminOverviewMetrics>
  activeUsers: AdminPanel<AdminActiveUsers>
  signups: AdminPanel<AdminSignups>
  queues: AdminPanel<AdminQueueMetrics>
  recentUsers: AdminPanel<AdminRecentUser[]>
  lastRefreshedAt: string
}

async function settlePanel<T>(promise: Promise<T>): Promise<AdminPanel<T>> {
  try {
    return { data: await promise, error: null }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unable to load panel',
    }
  }
}

function buildQueryString(query: AdminUsersQuery) {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    params.set(key, String(value))
  })
  return params.toString()
}

export async function getAdminDashboardData(
  headers: Record<string, string>
): Promise<AdminDashboardData> {
  const [overview, activeUsers, signups, queues, recentUsers] = await Promise.all([
    settlePanel(apiClient<AdminOverviewMetrics>('/api/admin/metrics/overview', { headers })),
    settlePanel(apiClient<AdminActiveUsers>('/api/admin/metrics/active-users?window=7d', { headers })),
    settlePanel(apiClient<AdminSignups>('/api/admin/metrics/signups?days=30', { headers })),
    settlePanel(apiClient<AdminQueueMetrics>('/api/admin/metrics/queues', { headers })),
    settlePanel(apiClient<AdminRecentUser[]>('/api/admin/users/recent?limit=10', { headers })),
  ])

  return {
    overview,
    activeUsers,
    signups,
    queues,
    recentUsers,
    lastRefreshedAt: new Date().toISOString(),
  }
}

export async function getAdminUsers(
  headers: Record<string, string>,
  query: AdminUsersQuery = {}
): Promise<AdminUsersResponse> {
  const qs = buildQueryString(query)
  return apiClient<AdminUsersResponse>(`/api/admin/users${qs ? `?${qs}` : ''}`, {
    headers,
  })
}

export async function suspendAdminUsers(
  headers: Record<string, string>,
  body: { userIds: string[]; reason?: string }
) {
  return apiClient<AdminBulkUsersResponse>('/api/admin/users/bulk/suspend', {
    method: 'POST',
    headers,
    body,
  })
}

export async function reactivateAdminUsers(
  headers: Record<string, string>,
  body: { userIds: string[] }
) {
  return apiClient<AdminBulkUsersResponse>('/api/admin/users/bulk/reactivate', {
    method: 'POST',
    headers,
    body,
  })
}

export async function deleteAdminUsers(
  headers: Record<string, string>,
  body: { userIds: string[] }
) {
  return apiClient<AdminBulkUsersResponse>('/api/admin/users/bulk/delete', {
    method: 'POST',
    headers,
    body,
  })
}
