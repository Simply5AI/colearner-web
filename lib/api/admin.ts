import { apiClient } from '@/lib/api/client'
import { adminBrowserClient, toAdminBffPath } from '@/lib/api/admin-browser'

type AdminApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
}

/** Server: forwards cookie/bearer headers to the API. Browser: uses the web BFF. */
async function adminApiClient<T>(path: string, options: AdminApiOptions = {}): Promise<T> {
  if (typeof window !== 'undefined') {
    return adminBrowserClient<T>(toAdminBffPath(path), {
      method: options.method,
      body: options.body,
      signal: options.signal,
    })
  }
  return apiClient<T>(path, options)
}

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

export type AdminOrgType = 'PERSONAL' | 'TEAM' | 'ENTERPRISE'
export type AdminSubscriptionPlan = 'FREE' | 'PRO' | 'ENTERPRISE'
export type AdminOrgSsoFilter = 'true' | 'false' | 'any'

export type AdminOrgSort =
  | 'created_desc'
  | 'created_asc'
  | 'member_count_desc'
  | 'member_count_asc'
  | 'mrr_desc'
  | 'mrr_asc'

export interface AdminOrgListRow {
  id: string
  name: string
  slug: string
  type: AdminOrgType
  ssoEnabled: boolean
  ownerId: string | null
  ownerEmail: string | null
  createdAt: string
  deletedAt: string | null
  suspendedAt: string | null
  memberCount: number
  mrr: number
  plan: AdminSubscriptionPlan
}

export interface AdminOrgsResponse {
  items: AdminOrgListRow[]
  nextCursor: string | null
  total: number
}

export interface AdminOrgsQuery {
  search?: string
  type?: AdminOrgType
  plan?: AdminSubscriptionPlan
  sso?: AdminOrgSsoFilter
  sort?: AdminOrgSort
  cursor?: string
  limit?: number
  showArchived?: boolean
}

export interface CreateAdminOrgBody {
  name: string
  slug: string
  type: AdminOrgType
  ownerEmail: string
  plan: AdminSubscriptionPlan
}

export type AdminBillingCycle = 'MONTHLY' | 'YEARLY'

export interface AdminOrgRoleOption {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  orgId: string | null
}

export interface AdminOrgDetail {
  id: string
  name: string
  slug: string
  type: AdminOrgType
  ssoEnabled: boolean
  owner: {
    id: string
    name: string
    email: string
  } | null
  plan: AdminSubscriptionPlan
  billingCycle: AdminBillingCycle | null
  nextRenewal: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  suspendedAt: string | null
  suspendedBy: string | null
  suspensionReason: string | null
  stats: {
    memberCount: number
    extractionCount: number
    recallSessionCount: number
    mrr: number
  }
  availableRoles: AdminOrgRoleOption[]
}

export interface AdminOrgMember {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  systemRole: string
  roleId: string | null
  role: string
  joinedAt: string
  lastActiveAt: string | null
}

export interface AdminOrgMembersResponse {
  items: AdminOrgMember[]
  nextCursor: string | null
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

type QueryStringValue = string | number | boolean | undefined | null

function buildQueryString(query: object) {
  const params = new URLSearchParams()
  const entries = Object.entries(query) as Array<[string, QueryStringValue]>
  entries.forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    params.set(key, String(value))
  })
  return params.toString()
}

export async function getAdminDashboardData(
  headers: Record<string, string>
): Promise<AdminDashboardData> {
  const [overview, activeUsers, signups, queues, recentUsers] = await Promise.all([
    settlePanel(adminApiClient<AdminOverviewMetrics>('/api/admin/metrics/overview', { headers })),
    settlePanel(adminApiClient<AdminActiveUsers>('/api/admin/metrics/active-users?window=7d', { headers })),
    settlePanel(adminApiClient<AdminSignups>('/api/admin/metrics/signups?days=30', { headers })),
    settlePanel(adminApiClient<AdminQueueMetrics>('/api/admin/metrics/queues', { headers })),
    settlePanel(adminApiClient<AdminRecentUser[]>('/api/admin/users/recent?limit=10', { headers })),
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
  return adminApiClient<AdminUsersResponse>(`/api/admin/users${qs ? `?${qs}` : ''}`, {
    headers,
  })
}

export async function getAdminOrgs(
  headers: Record<string, string>,
  query: AdminOrgsQuery = {}
): Promise<AdminOrgsResponse> {
  const qs = buildQueryString(query)
  return adminApiClient<AdminOrgsResponse>(`/api/admin/orgs${qs ? `?${qs}` : ''}`, {
    headers,
  })
}

export async function createAdminOrg(
  headers: Record<string, string>,
  body: CreateAdminOrgBody
): Promise<AdminOrgListRow> {
  return adminApiClient<AdminOrgListRow>('/api/admin/orgs', {
    method: 'POST',
    headers,
    body,
  })
}

export async function archiveAdminOrg(
  headers: Record<string, string>,
  id: string
): Promise<{ success: true }> {
  return adminApiClient<{ success: true }>(`/api/admin/orgs/${id}`, {
    method: 'DELETE',
    headers,
  })
}

export async function getAdminOrg(
  headers: Record<string, string>,
  id: string
): Promise<AdminOrgDetail> {
  return adminApiClient<AdminOrgDetail>(`/api/admin/orgs/${id}`, { headers })
}

export async function patchAdminOrg(
  headers: Record<string, string>,
  id: string,
  body: {
    name?: string
    slug?: string
    type?: AdminOrgType
    ssoEnabled?: boolean
    updatedAt?: string
  }
): Promise<AdminOrgDetail> {
  return adminApiClient<AdminOrgDetail>(`/api/admin/orgs/${id}`, {
    method: 'PATCH',
    headers,
    body,
  })
}

export async function suspendAdminOrg(
  headers: Record<string, string>,
  id: string,
  body: { reason: string }
): Promise<AdminOrgDetail> {
  return adminApiClient<AdminOrgDetail>(`/api/admin/orgs/${id}/suspend`, {
    method: 'POST',
    headers,
    body,
  })
}

export async function reactivateAdminOrg(
  headers: Record<string, string>,
  id: string
): Promise<AdminOrgDetail> {
  return adminApiClient<AdminOrgDetail>(`/api/admin/orgs/${id}/reactivate`, {
    method: 'POST',
    headers,
  })
}

export async function updateAdminOrgPlan(
  headers: Record<string, string>,
  id: string,
  body: { plan: AdminSubscriptionPlan; billingCycle?: AdminBillingCycle }
): Promise<AdminOrgDetail> {
  return adminApiClient<AdminOrgDetail>(`/api/admin/orgs/${id}/plan`, {
    method: 'POST',
    headers,
    body,
  })
}

export async function transferAdminOrgOwnership(
  headers: Record<string, string>,
  id: string,
  newOwnerUserId: string
): Promise<AdminOrgDetail> {
  return adminApiClient<AdminOrgDetail>(`/api/admin/orgs/${id}/transfer-ownership`, {
    method: 'POST',
    headers,
    body: { newOwnerUserId },
  })
}

export async function getAdminOrgMembers(
  headers: Record<string, string>,
  id: string,
  query: { cursor?: string; limit?: number } = {}
): Promise<AdminOrgMembersResponse> {
  const qs = buildQueryString(query)
  return adminApiClient<AdminOrgMembersResponse>(
    `/api/admin/orgs/${id}/members${qs ? `?${qs}` : ''}`,
    { headers }
  )
}

export async function inviteAdminOrgMember(
  headers: Record<string, string>,
  id: string,
  body: { email: string; roleId: string }
): Promise<AdminOrgMember> {
  return adminApiClient<AdminOrgMember>(`/api/admin/orgs/${id}/members/invite`, {
    method: 'POST',
    headers,
    body,
  })
}

export async function removeAdminOrgMember(
  headers: Record<string, string>,
  id: string,
  userId: string
): Promise<{ success: true }> {
  return adminApiClient<{ success: true }>(`/api/admin/orgs/${id}/members/${userId}`, {
    method: 'DELETE',
    headers,
  })
}

export async function updateAdminOrgMemberRole(
  headers: Record<string, string>,
  id: string,
  userId: string,
  roleId: string
): Promise<{ success: true }> {
  return adminApiClient<{ success: true }>(`/api/admin/orgs/${id}/members/${userId}`, {
    method: 'PATCH',
    headers,
    body: { roleId },
  })
}

async function runBulkUserAction(
  headers: Record<string, string>,
  userIds: string[],
  action: (id: string) => Promise<unknown>
): Promise<AdminBulkUsersResponse> {
  const succeeded: string[] = []
  const failed: Array<{ userId: string; reason: string }> = []

  for (const userId of userIds) {
    try {
      await action(userId)
      succeeded.push(userId)
    } catch (error) {
      failed.push({
        userId,
        reason: error instanceof Error ? error.message : 'Request failed',
      })
    }
  }

  return { succeeded, failed }
}

export async function suspendAdminUsers(
  headers: Record<string, string>,
  body: { userIds: string[]; reason?: string }
) {
  const reason = body.reason?.trim() || 'Suspended by admin'
  return runBulkUserAction(headers, body.userIds, (id) =>
    suspendAdminUser(headers, id, { reason })
  )
}

export async function reactivateAdminUsers(
  headers: Record<string, string>,
  body: { userIds: string[] }
) {
  return runBulkUserAction(headers, body.userIds, (id) => reactivateAdminUser(headers, id))
}

export async function deleteAdminUsers(
  headers: Record<string, string>,
  body: { userIds: string[] }
) {
  return runBulkUserAction(headers, body.userIds, (id) => deleteAdminUser(headers, id))
}

// ─── Single-user detail screen ────────────────────────────────────────────

export interface AdminUserRoleAssignment {
  id: string
  roleId: string
  roleName: string
  isSystem: boolean
  description: string | null
  orgId: string
  orgName: string | null
  assignedAt: string
}

export interface AdminUserSubscriptionSummary {
  id: string
  plan: string
  status: string
  billingCycle: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

export interface AdminUserDetail extends AdminUserListRow {
  suspendedBy: string | null
  suspensionReason: string | null
  updatedAt: string
  onboardingCompleted: boolean
  bio: string | null
  roles: AdminUserRoleAssignment[]
  subscription: AdminUserSubscriptionSummary | null
  activityCount: number
  availableRoles: Array<{ id: string; name: string; isSystem: boolean; orgId: string | null }>
}

export interface AdminUserSession {
  tokenId: string
  expiresAt: string
  isExpired: boolean
}

export interface AdminUserActivityEntry {
  id: string
  action: string
  subject: string
  subjectId: string
  metadata: unknown
  createdAt: string
}

export async function getAdminUser(
  headers: Record<string, string>,
  id: string
): Promise<AdminUserDetail> {
  return adminApiClient<AdminUserDetail>(`/api/admin/users/${id}`, { headers })
}

export async function patchAdminUser(
  headers: Record<string, string>,
  id: string,
  body: { name?: string }
): Promise<AdminUserDetail> {
  return adminApiClient<AdminUserDetail>(`/api/admin/users/${id}`, {
    method: 'PATCH',
    headers,
    body,
  })
}

export async function suspendAdminUser(
  headers: Record<string, string>,
  id: string,
  body: { reason: string }
): Promise<AdminUserDetail> {
  return adminApiClient<AdminUserDetail>(`/api/admin/users/${id}/suspend`, {
    method: 'POST',
    headers,
    body,
  })
}

export async function reactivateAdminUser(
  headers: Record<string, string>,
  id: string
): Promise<AdminUserDetail> {
  return adminApiClient<AdminUserDetail>(`/api/admin/users/${id}/reactivate`, {
    method: 'POST',
    headers,
  })
}

export async function resetAdminUserPassword(
  headers: Record<string, string>,
  id: string
): Promise<{ success: true; sent: boolean }> {
  return adminApiClient<{ success: true; sent: boolean }>(
    `/api/admin/users/${id}/password-reset`,
    { method: 'POST', headers }
  )
}

export async function forceLogoutAdminUser(
  headers: Record<string, string>,
  id: string
): Promise<{ success: true }> {
  return adminApiClient<{ success: true }>(`/api/admin/users/${id}/force-logout`, {
    method: 'POST',
    headers,
  })
}

export async function deleteAdminUser(
  headers: Record<string, string>,
  id: string
): Promise<{ success: true }> {
  return adminApiClient<{ success: true }>(`/api/admin/users/${id}`, {
    method: 'DELETE',
    headers,
  })
}

export async function assignAdminUserRole(
  headers: Record<string, string>,
  id: string,
  roleId: string
): Promise<AdminUserDetail> {
  return adminApiClient<AdminUserDetail>(`/api/admin/users/${id}/roles`, {
    method: 'POST',
    headers,
    body: { roleId },
  })
}

export async function revokeAdminUserRole(
  headers: Record<string, string>,
  id: string,
  roleId: string
): Promise<AdminUserDetail> {
  return adminApiClient<AdminUserDetail>(`/api/admin/users/${id}/roles/${roleId}`, {
    method: 'DELETE',
    headers,
  })
}

export async function getAdminUserSessions(
  headers: Record<string, string>,
  id: string
): Promise<AdminUserSession[]> {
  return adminApiClient<AdminUserSession[]>(`/api/admin/users/${id}/sessions`, { headers })
}

export async function revokeAdminUserSession(
  headers: Record<string, string>,
  id: string,
  tokenId: string
): Promise<{ success: true }> {
  return adminApiClient<{ success: true }>(
    `/api/admin/users/${id}/sessions/${tokenId}`,
    { method: 'DELETE', headers }
  )
}

// ─── LLM Consumption (Super Admin) ────────────────────────────────────────

export type ConsumptionRange = '24h' | '7d' | '30d' | '90d' | 'all' | 'custom'
export type ConsumptionGranularity = 'hour' | 'day' | 'week' | 'month'
export type ConsumptionGroupBy = 'agent' | 'model' | 'provider' | 'org' | 'user'

export interface ConsumptionQuery {
  range?: ConsumptionRange
  from?: string
  to?: string
  granularity?: ConsumptionGranularity
  orgId?: string
  agent?: string
  userId?: string
  provider?: string
  model?: string
}

export interface ConsumptionTotals {
  costUsd: number
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  calls: number
  avgCostPerCallUsd: number
  avgLatencyMs: number
  errorRate: number
}

export interface ConsumptionSeriesPoint {
  date: string
  costUsd: number
  inputTokens: number
  outputTokens: number
  calls: number
  byKey: Record<string, number>
}

export interface ConsumptionBreakdownRow {
  key: string
  label: string
  costUsd: number
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  calls: number
  pctOfTotal: number
  avgLatencyMs?: number
  provider?: string
  model?: string
}

export interface ConsumptionReport {
  range: ConsumptionRange
  groupBy: ConsumptionGroupBy
  startDate: string | null
  endDate: string
  granularity: ConsumptionGranularity
  totals: ConsumptionTotals
  series: ConsumptionSeriesPoint[]
  breakdown: ConsumptionBreakdownRow[]
}

export interface ConsumptionSummary {
  totalTokens: number
  totalCostUsd: number
  requestCount: number
  avgLatencyMs: number
  errorRate: number
}

export interface ConsumptionTimeseriesPoint {
  bucket: string
  tokens: number
  costUsd: number
  requests: number
}

export interface ConsumptionByUserRow {
  userId: string
  email: string
  tokens: number
  costUsd: number
  requests: number
  avgLatencyMs: number
}

export interface ConsumptionByModelRow {
  provider: string
  model: string
  tokens: number
  costUsd: number
  requests: number
  avgLatencyMs: number
}

export interface ConsumptionEventRow {
  id: string
  createdAt: string
  orgId: string
  orgName: string
  userId: string | null
  userEmail: string | null
  agent: string
  feature: string
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  promptTokens: number
  completionTokens: number
  cachedTokens: number
  costUsd: number
  latencyMs: number
  success: boolean
  errorCode: string | null
  requestId: string | null
}

export interface ConsumptionEventsPage {
  items: ConsumptionEventRow[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface LlmPricingMeta {
  version: string
  updatedAt: string
  ageDays: number
  isStale: boolean
  staleAfterDays: number
}

export interface OrgConsumptionReport {
  orgId: string
  orgName: string
  range: ConsumptionRange
  totals: ConsumptionTotals
  byAgent: ConsumptionBreakdownRow[]
  byModel: ConsumptionBreakdownRow[]
  series: ConsumptionSeriesPoint[]
}

export type ConsumptionQueryParams = ConsumptionQuery & {
  groupBy?: ConsumptionGroupBy
  limit?: number
  page?: number
  pageSize?: number
  sort?: 'created_desc' | 'created_asc' | 'cost_desc'
}

function buildConsumptionQuery(params: ConsumptionQueryParams = {}) {
  const qs = new URLSearchParams()
  if (params.range) qs.set('range', params.range)
  if (params.from) qs.set('from', params.from)
  if (params.to) qs.set('to', params.to)
  if (params.granularity) qs.set('granularity', params.granularity)
  if (params.orgId) qs.set('orgId', params.orgId)
  if (params.agent) qs.set('agent', params.agent)
  if (params.userId) qs.set('userId', params.userId)
  if (params.provider) qs.set('provider', params.provider)
  if (params.model) qs.set('model', params.model)
  if (params.groupBy) qs.set('groupBy', params.groupBy)
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  if (params.page !== undefined) qs.set('page', String(params.page))
  if (params.pageSize !== undefined) qs.set('pageSize', String(params.pageSize))
  if (params.sort) qs.set('sort', params.sort)
  return qs.toString()
}

export async function getLlmConsumption(
  headers: Record<string, string>,
  query: ConsumptionQuery = { range: '30d' },
  groupBy: ConsumptionGroupBy = 'agent',
): Promise<ConsumptionReport> {
  const qs = buildConsumptionQuery({ ...query, groupBy })
  return adminApiClient<ConsumptionReport>(`/api/admin/ai-usage?${qs}`, { headers })
}

export async function getLlmConsumptionSummary(
  headers: Record<string, string>,
  query: ConsumptionQuery = { range: '30d' },
): Promise<ConsumptionSummary> {
  const qs = buildConsumptionQuery(query)
  return adminApiClient<ConsumptionSummary>(`/api/admin/ai-usage/summary?${qs}`, { headers })
}

export async function getLlmConsumptionTimeseries(
  headers: Record<string, string>,
  query: ConsumptionQuery = { range: '30d' },
  groupBy: ConsumptionGroupBy = 'agent',
): Promise<ConsumptionTimeseriesPoint[]> {
  const qs = buildConsumptionQuery({ ...query, groupBy })
  return adminApiClient<ConsumptionTimeseriesPoint[]>(`/api/admin/ai-usage/timeseries?${qs}`, { headers })
}

export async function getLlmConsumptionByUser(
  headers: Record<string, string>,
  query: ConsumptionQuery = { range: '30d' },
  limit = 50,
): Promise<ConsumptionByUserRow[]> {
  const qs = buildConsumptionQuery({ ...query, limit })
  return adminApiClient<ConsumptionByUserRow[]>(`/api/admin/ai-usage/by-user?${qs}`, { headers })
}

export async function getLlmConsumptionByOrgBreakdown(
  headers: Record<string, string>,
  query: ConsumptionQuery = { range: '30d' },
  limit = 50,
): Promise<ConsumptionBreakdownRow[]> {
  const qs = buildConsumptionQuery({ ...query, limit })
  return adminApiClient<ConsumptionBreakdownRow[]>(`/api/admin/ai-usage/by-org?${qs}`, { headers })
}

export async function getLlmConsumptionByModel(
  headers: Record<string, string>,
  query: ConsumptionQuery = { range: '30d' },
): Promise<ConsumptionByModelRow[]> {
  const qs = buildConsumptionQuery(query)
  return adminApiClient<ConsumptionByModelRow[]>(`/api/admin/ai-usage/by-model?${qs}`, { headers })
}

export async function getLlmConsumptionByFeature(
  headers: Record<string, string>,
  query: ConsumptionQuery = { range: '30d' },
): Promise<ConsumptionBreakdownRow[]> {
  const qs = buildConsumptionQuery(query)
  return adminApiClient<ConsumptionBreakdownRow[]>(`/api/admin/ai-usage/by-feature?${qs}`, { headers })
}

export async function getLlmConsumptionEvents(
  headers: Record<string, string>,
  query: ConsumptionQueryParams = { range: '30d' },
): Promise<ConsumptionEventsPage> {
  const qs = buildConsumptionQuery(query)
  return adminApiClient<ConsumptionEventsPage>(`/api/admin/ai-usage/events?${qs}`, { headers })
}

export async function getLlmConsumptionEvent(
  headers: Record<string, string>,
  id: string,
): Promise<ConsumptionEventRow> {
  return adminApiClient<ConsumptionEventRow>(`/api/admin/ai-usage/events/${id}`, { headers })
}

export async function getLlmPricingMeta(
  headers: Record<string, string>,
): Promise<LlmPricingMeta> {
  return adminApiClient<LlmPricingMeta>(`/api/admin/ai-usage/pricing`, { headers })
}

export async function getLlmConsumptionByOrg(
  headers: Record<string, string>,
  orgId: string,
  query: ConsumptionQuery = { range: '30d' },
): Promise<OrgConsumptionReport> {
  const qs = buildConsumptionQuery({ ...query, orgId })
  return adminApiClient<OrgConsumptionReport>(`/api/admin/ai-usage/by-org/${orgId}?${qs}`, { headers })
}

export function buildLlmConsumptionCsvUrl(params: ConsumptionQuery & { orgId?: string; agent?: string }): string {
  return `/api/admin/ai-usage/export.csv?${buildConsumptionQuery(params)}`
}

export function buildLlmConsumptionJsonUrl(params: ConsumptionQuery & { orgId?: string; agent?: string }): string {
  return `/api/admin/ai-usage/export.json?${buildConsumptionQuery(params)}`
}

export interface LlmRateLimitsReport {
  summary: {
    recentCalls: number
    totalCostUsd: number
    providers: string[]
  }
  queue: {
    available: boolean
    pending: number
    active: number
    failed: number
    message?: string
  }
  providerErrorRates: Array<{
    provider: string
    last15m: number
    last1h: number
    last24h: number
  }>
  recentRetries: Array<{
    requestId: string | null
    provider: string
    model: string
    attempts: number
    finalStatus: 'success' | 'error'
    createdAt: string
  }>
  byProvider: Array<{
    provider: string
    calls: number
    costUsd: number
    avgCostPerCall: number
    topModels: string[]
  }>
  note: string
}

export async function getLlmRateLimits(
  headers: Record<string, string>,
): Promise<LlmRateLimitsReport> {
  return adminApiClient<LlmRateLimitsReport>(`/api/admin/ai-usage/rate-limits`, { headers })
}

export async function getAdminUserActivity(
  headers: Record<string, string>,
  id: string,
  limit?: number
): Promise<AdminUserActivityEntry[]> {
  const qs = limit ? `?limit=${limit}` : ''
  return adminApiClient<AdminUserActivityEntry[]>(
    `/api/admin/users/${id}/activity${qs}`,
    { headers }
  )
}

// ─── Single-user learning screens ─────────────────────────────────────────

export type AdminLearningUserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED'
export type AdminLearningMasteryLevel = 'NEW' | 'LEARNING' | 'REVIEW' | 'MASTERED' | 'WEAK'
export type AdminLearningSessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED'
export type AdminLearningRoadmapStatus = 'GENERATING' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'

export interface AdminLearningUser {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  systemRole: string
  status: AdminLearningUserStatus
  org: {
    id: string
    name: string
    slug: string
    type: string
  }
  deletedAt: string | null
  suspendedAt: string | null
}

export interface AdminLearningActivityRow {
  id: string
  action: string
  subject: string
  subjectId: string
  metadata: unknown
  createdAt: string
}

export interface AdminLearningRoadmapRow {
  id: string
  title: string
  description: string | null
  status: AdminLearningRoadmapStatus | string
  createdAt: string
  updatedAt: string
  totalConcepts: number
  masteredConcepts: number
  progressPercent: number
  generation: {
    model: string | null
    promptVersion: string | null
    durationMs: number | null
    generatedAt: string | null
  }
  isGenerationSlow: boolean
}

export interface AdminLearningOverviewResponse {
  user: AdminLearningUser
  stats: {
    mastered: number
    attempts: number
    lastActiveAt: string | null
  }
  streak: {
    current: number
    longest: number
  }
  masterySummary: {
    mastered: number
    learning: number
    weak: number
  }
  goals: Array<{
    id: string
    title: string
    status: string
    targetDate: string | null
    icon: string | null
    color: string | null
  }>
  roadmaps: AdminLearningRoadmapRow[]
  recentActivity: AdminLearningActivityRow[]
}

export interface AdminLearningMasteryRow {
  id: string
  title: string
  level: AdminLearningMasteryLevel
  reviewEase: number | null
  attempts: number
  correctPercent: number | null
  lastReviewedAt: string | null
  nextReviewAt: string | null
  source: { id: string; title: string } | null
}

export interface AdminLearningMasteryResponse {
  items: AdminLearningMasteryRow[]
  summary: Record<AdminLearningMasteryLevel, number>
  sources: Array<{ id: string; title: string }>
  nextCursor: string | null
}

export interface AdminLearningConceptAttemptsResponse {
  items: Array<{
    id: string
    questionId: string
    questionText: string
    correctAnswer: string | null
    userAnswer: string
    isCorrect: boolean
    score: number | null
    feedback: string | null
    timeSpentSeconds: number
    createdAt: string
    sessionId: string
    sessionScore: number | null
  }>
  nextCursor: string | null
}

export interface AdminLearningSessionRow {
  id: string
  status: AdminLearningSessionStatus | string
  score: number | null
  totalQuestions: number
  correctCount: number
  durationSeconds: number | null
  startedAt: string | null
  completedAt: string | null
  attempts: number
  conceptCount: number
  concepts: string[]
  source: { id: string; title: string } | null
}

export interface AdminLearningSessionsResponse {
  items: AdminLearningSessionRow[]
  sources: Array<{ id: string; title: string }>
  nextCursor: string | null
}

export interface AdminLearningSessionDetailResponse {
  session: AdminLearningSessionRow
  attempts: Array<{
    id: string
    questionId: string | null
    questionText: string
    correctAnswer: string | null
    userAnswer: string
    isCorrect: boolean
    score: number | null
    feedback: string | null
    timeSpentSeconds: number
    createdAt: string
    concept: { id: string; title: string } | null
  }>
}

export interface AdminLearningRoadmapsResponse {
  items: AdminLearningRoadmapRow[]
  nextCursor: string | null
}

export interface AdminLearningRoadmapDetail extends AdminLearningRoadmapRow {
  goal: { id: string; title: string } | null
  subject: { id: string; name: string; slug: string } | null
  phases: Array<{
    id: string
    title: string
    description: string | null
    sortOrder: number
    items: Array<{
      id: string
      title: string
      status: string
      sourceType: string
      extraction: { id: string; title: string; status: string } | null
    }>
  }>
  concepts: Array<{
    id: string
    conceptId: string
    title: string
    description: string | null
    masteryState: string
    phase: { id: string; title: string } | null
    addedAt: string
    updatedAt: string
  }>
}

function queryString(query: object) {
  const params = new URLSearchParams()
  const entries = Object.entries(query) as Array<[string, QueryStringValue]>
  entries.forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    params.set(key, String(value))
  })
  return params.toString()
}

export async function getAdminLearningOverview(
  headers: Record<string, string>,
  id: string
): Promise<AdminLearningOverviewResponse> {
  return adminApiClient<AdminLearningOverviewResponse>(`/api/admin/users/${id}/learning/overview`, { headers })
}

export async function getAdminLearningMastery(
  headers: Record<string, string>,
  id: string,
  query: Record<string, string | number | undefined | null> = {}
): Promise<AdminLearningMasteryResponse> {
  const qs = queryString(query)
  return adminApiClient<AdminLearningMasteryResponse>(`/api/admin/users/${id}/learning/mastery${qs ? `?${qs}` : ''}`, { headers })
}

export async function getAdminLearningConceptAttempts(
  headers: Record<string, string>,
  id: string,
  conceptId: string,
  query: Record<string, string | number | undefined | null> = {}
): Promise<AdminLearningConceptAttemptsResponse> {
  const qs = queryString(query)
  return adminApiClient<AdminLearningConceptAttemptsResponse>(
    `/api/admin/users/${id}/learning/concepts/${conceptId}/attempts${qs ? `?${qs}` : ''}`,
    { headers }
  )
}

export async function getAdminLearningSessions(
  headers: Record<string, string>,
  id: string,
  query: Record<string, string | number | undefined | null> = {}
): Promise<AdminLearningSessionsResponse> {
  const qs = queryString(query)
  return adminApiClient<AdminLearningSessionsResponse>(`/api/admin/users/${id}/learning/sessions${qs ? `?${qs}` : ''}`, { headers })
}

export async function getAdminLearningSessionDetail(
  headers: Record<string, string>,
  id: string,
  sessionId: string
): Promise<AdminLearningSessionDetailResponse> {
  return adminApiClient<AdminLearningSessionDetailResponse>(
    `/api/admin/users/${id}/learning/sessions/${sessionId}`,
    { headers }
  )
}

export async function getAdminLearningRoadmaps(
  headers: Record<string, string>,
  id: string,
  query: Record<string, string | number | undefined | null> = {}
): Promise<AdminLearningRoadmapsResponse> {
  const qs = queryString(query)
  return adminApiClient<AdminLearningRoadmapsResponse>(`/api/admin/users/${id}/learning/roadmaps${qs ? `?${qs}` : ''}`, { headers })
}

export async function getAdminLearningRoadmapDetail(
  headers: Record<string, string>,
  id: string,
  roadmapId: string
): Promise<AdminLearningRoadmapDetail> {
  return adminApiClient<AdminLearningRoadmapDetail>(
    `/api/admin/users/${id}/learning/roadmaps/${roadmapId}`,
    { headers }
  )
}

// ─── Roles & Permissions ─────────────────────────────────────────────────────

export interface AdminPermission {
  id: string
  action: string
  subject: string
  description: string | null
}

export interface AdminPermissionsGrouped {
  groups: Array<{
    subject: string
    permissions: AdminPermission[]
  }>
}

export interface AdminRoleListItem {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  orgId: string | null
  orgName: string | null
  assigneeCount: number
  permissionIds: string[]
  updatedAt: string
}

export interface AdminRoleDetail extends AdminRoleListItem {
  permissions: AdminPermission[]
}

export interface AdminRolesResponse {
  items: AdminRoleListItem[]
}

export interface AdminRolesQuery {
  search?: string
  orgId?: string
}

export interface CreateAdminRoleBody {
  name: string
  description?: string
  orgId: string
  permissionIds: string[]
}

export interface UpdateAdminRoleBody {
  name?: string
  description?: string
  permissionIds?: string[]
  updatedAt?: string
}

export async function getAdminRoles(
  headers: Record<string, string>,
  query: AdminRolesQuery = {}
): Promise<AdminRolesResponse> {
  const qs = queryString(query)
  return adminApiClient<AdminRolesResponse>(`/api/admin/roles${qs ? `?${qs}` : ''}`, { headers })
}

export async function getAdminRole(
  headers: Record<string, string>,
  id: string
): Promise<AdminRoleDetail> {
  return adminApiClient<AdminRoleDetail>(`/api/admin/roles/${id}`, { headers })
}

export async function getAdminPermissions(
  headers: Record<string, string>
): Promise<AdminPermissionsGrouped> {
  return adminApiClient<AdminPermissionsGrouped>('/api/admin/permissions', { headers })
}

export async function createAdminRole(
  headers: Record<string, string>,
  body: CreateAdminRoleBody
): Promise<AdminRoleDetail> {
  return adminApiClient<AdminRoleDetail>('/api/admin/roles', {
    method: 'POST',
    headers,
    body,
  })
}

export async function updateAdminRole(
  headers: Record<string, string>,
  id: string,
  body: UpdateAdminRoleBody
): Promise<AdminRoleDetail> {
  return adminApiClient<AdminRoleDetail>(`/api/admin/roles/${id}`, {
    method: 'PATCH',
    headers,
    body,
  })
}

export async function deleteAdminRole(
  headers: Record<string, string>,
  id: string
): Promise<{ deleted: true }> {
  return adminApiClient<{ deleted: true }>(`/api/admin/roles/${id}`, {
    method: 'DELETE',
    headers,
  })
}

// ─── Content moderation (extractions, library, pods) ─────────────────────────

export type AdminExtractionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED_PASS1'
  | 'COMPLETED'
  | 'FAILED'

export type AdminExtractionSort = 'created_desc' | 'created_asc' | 'duration_desc' | 'duration_asc'
export type AdminLibrarySort = 'created_desc' | 'created_asc' | 'title_asc' | 'title_desc'
export type AdminPodSort = 'created_desc' | 'created_asc' | 'members_desc' | 'members_asc'
export type AdminPodVisibility = 'PUBLIC' | 'INVITE_ONLY'
export type AdminQuestionType = 'MULTIPLE_CHOICE' | 'FREE_TEXT' | 'TRUE_FALSE' | 'CLOZE'

export interface AdminContentOrgRef {
  id: string
  name: string
  slug?: string
}

export interface AdminContentUserRef {
  id: string
  email: string
  name?: string
  avatarUrl?: string | null
}

export interface AdminContentSourceRef {
  id: string
  title: string | null
  url?: string
}

export interface AdminPaginated<T> {
  items: T[]
  nextCursor: string | null
  total: number
}

export interface AdminExtractionsQuery {
  search?: string
  status?: AdminExtractionStatus
  orgId?: string
  from?: string
  to?: string
  sort?: AdminExtractionSort
  cursor?: string
  limit?: number
}

export interface AdminExtractionListRow {
  id: string
  sourceUrl: string
  title: string | null
  status: AdminExtractionStatus
  sourceType: string
  owner: AdminContentUserRef
  org: AdminContentOrgRef
  processingTimeMs: number | null
  conceptCount: number
  questionCount: number
  isStuck: boolean
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export interface AdminExtractionDetail {
  id: string
  org: AdminContentOrgRef
  owner: AdminContentUserRef
  sourceUrl: string
  title: string | null
  description: string | null
  summary: string | null
  status: AdminExtractionStatus
  sourceType: string
  transcriptText: string | null
  transcriptHash: string | null
  processedModel: string | null
  processingTimeMs: number | null
  conceptCount: number
  questionCount: number
  createdAt: string
  updatedAt: string
  completedAt: string | null
  metadata: unknown
  errorMessage: string | null
  concepts: Array<{
    id: string
    title: string
    description: string | null
    order: number
    questions: AdminQuestionDetail[]
  }>
  questions: AdminQuestionDetail[]
  logs: {
    id: string
    name: string
    attemptsMade: number
    failedReason: string | null
    processedOn: string | null
    finishedOn: string | null
    logs: string[]
  } | null
}

export interface AdminLibraryQuery {
  search?: string
  sourceId?: string
  orgId?: string
  flagged?: 'true' | 'false'
  sort?: AdminLibrarySort
  cursor?: string
  limit?: number
}

export interface AdminConceptListRow {
  id: string
  title: string
  description: string | null
  org: AdminContentOrgRef
  source: AdminContentSourceRef
  isFlagged: boolean
  flaggedReason: string | null
  usageCount: number
  createdAt: string
}

export interface AdminConceptDetail {
  id: string
  title: string
  description: string | null
  org: AdminContentOrgRef
  source: AdminContentSourceRef | null
  isFlagged: boolean
  flaggedReason: string | null
  createdAt: string
  questions: AdminQuestionDetail[]
}

export interface AdminQuestionListRow {
  id: string
  text: string
  type: AdminQuestionType
  concept: { id: string; title: string }
  org: AdminContentOrgRef
  source: AdminContentSourceRef
  isFlagged: boolean
  flaggedReason: string | null
  usageCount: number
  createdAt: string
}

export interface AdminQuestionDetail {
  id: string
  text: string
  type: AdminQuestionType
  options: unknown
  correctIndex: number | null
  explanation: string | null
  concept: { id: string; title: string } | null
  source: AdminContentSourceRef | null
  isFlagged: boolean
  flaggedReason: string | null
  createdAt: string
}

export interface AdminDuplicateCandidate {
  id: string
  title?: string
  text?: string
  description?: string | null
  type?: AdminQuestionType
  conceptId?: string
  extractionId?: string
  similarity: number
}

export interface AdminPodsQuery {
  search?: string
  visibility?: AdminPodVisibility
  orgId?: string
  sort?: AdminPodSort
  cursor?: string
  limit?: number
}

export interface AdminPodListRow {
  id: string
  name: string
  visibility: AdminPodVisibility
  owner: AdminContentUserRef
  org: AdminContentOrgRef
  memberCount: number
  captureCount: number
  createdAt: string
}

export interface AdminPodDetail {
  id: string
  name: string
  description: string | null
  visibility: AdminPodVisibility
  org: AdminContentOrgRef
  ownerId: string
  createdAt: string
  members: Array<{
    id: string
    role: string
    joinedAt: string
    user: AdminContentUserRef
  }>
  captures: Array<{
    id: string
    note: string | null
    sharedBy: string
    createdAt: string
    extraction: {
      id: string
      title: string | null
      videoUrl: string
      status: string
      createdAt: string
    }
  }>
}

function buildAdminContentQuery(
  params: AdminExtractionsQuery | AdminLibraryQuery | AdminPodsQuery = {},
) {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value))
  }
  const str = qs.toString()
  return str ? `?${str}` : ''
}

export async function getAdminExtractions(
  headers: Record<string, string>,
  query: AdminExtractionsQuery = {},
): Promise<AdminPaginated<AdminExtractionListRow>> {
  return adminApiClient(`/api/admin/extractions${buildAdminContentQuery(query)}`, { headers })
}

export async function getAdminExtraction(
  headers: Record<string, string>,
  id: string,
): Promise<AdminExtractionDetail> {
  return adminApiClient(`/api/admin/extractions/${id}`, { headers })
}

export async function reprocessAdminExtraction(id: string): Promise<{ jobId: string }> {
  return adminApiClient(`/api/admin/extractions/${id}/reprocess`, { method: 'POST' })
}

export async function deleteAdminExtraction(id: string): Promise<{ success: true }> {
  return adminApiClient(`/api/admin/extractions/${id}`, { method: 'DELETE' })
}

export async function getAdminConcepts(
  headers: Record<string, string>,
  query: AdminLibraryQuery = {},
): Promise<AdminPaginated<AdminConceptListRow>> {
  return adminApiClient(`/api/admin/concepts${buildAdminContentQuery(query)}`, { headers })
}

export async function getAdminConcept(
  headers: Record<string, string>,
  id: string,
): Promise<AdminConceptDetail> {
  return adminApiClient(`/api/admin/concepts/${id}`, { headers })
}

export async function updateAdminConcept(
  id: string,
  body: { title?: string; description?: string },
): Promise<unknown> {
  return adminApiClient(`/api/admin/concepts/${id}`, { method: 'PATCH', body })
}

export async function flagAdminConcept(id: string, reason: string): Promise<unknown> {
  return adminApiClient(`/api/admin/concepts/${id}/flag`, { method: 'POST', body: { reason } })
}

export async function unflagAdminConcept(id: string): Promise<unknown> {
  return adminApiClient(`/api/admin/concepts/${id}/unflag`, { method: 'POST' })
}

export async function deleteAdminConcept(id: string): Promise<{
  success: true
  affectedReviewSchedules: number
  affectedQuestions: number
}> {
  return adminApiClient(`/api/admin/concepts/${id}`, { method: 'DELETE' })
}

export async function getAdminConceptDuplicates(
  headers: Record<string, string>,
  id: string,
  threshold = 0.85,
): Promise<{ items: AdminDuplicateCandidate[] }> {
  return adminApiClient(`/api/admin/concepts/${id}/duplicates?threshold=${threshold}`, { headers })
}

export async function mergeAdminConcept(
  id: string,
  targetConceptId: string,
): Promise<{ success: true; targetConceptId: string }> {
  return adminApiClient(`/api/admin/concepts/${id}/merge`, {
    method: 'POST',
    body: { targetConceptId },
  })
}

export async function getAdminQuestions(
  headers: Record<string, string>,
  query: AdminLibraryQuery = {},
): Promise<AdminPaginated<AdminQuestionListRow>> {
  return adminApiClient(`/api/admin/questions${buildAdminContentQuery(query)}`, { headers })
}

export async function getAdminQuestion(
  headers: Record<string, string>,
  id: string,
): Promise<AdminQuestionDetail> {
  return adminApiClient(`/api/admin/questions/${id}`, { headers })
}

export async function updateAdminQuestion(
  id: string,
  body: {
    text?: string
    type?: AdminQuestionType
    options?: unknown
    correctIndex?: number
    explanation?: string
  },
): Promise<unknown> {
  return adminApiClient(`/api/admin/questions/${id}`, { method: 'PATCH', body })
}

export async function flagAdminQuestion(id: string, reason: string): Promise<unknown> {
  return adminApiClient(`/api/admin/questions/${id}/flag`, { method: 'POST', body: { reason } })
}

export async function unflagAdminQuestion(id: string): Promise<unknown> {
  return adminApiClient(`/api/admin/questions/${id}/unflag`, { method: 'POST' })
}

export async function deleteAdminQuestion(id: string): Promise<{
  success: true
  affectedReviewSchedules: number
}> {
  return adminApiClient(`/api/admin/questions/${id}`, { method: 'DELETE' })
}

export async function getAdminPods(
  headers: Record<string, string>,
  query: AdminPodsQuery = {},
): Promise<AdminPaginated<AdminPodListRow>> {
  return adminApiClient(`/api/admin/pods${buildAdminContentQuery(query)}`, { headers })
}

export async function getAdminPod(
  headers: Record<string, string>,
  id: string,
): Promise<AdminPodDetail> {
  return adminApiClient(`/api/admin/pods/${id}`, { headers })
}

export async function updateAdminPod(
  id: string,
  body: { name?: string; visibility?: AdminPodVisibility },
): Promise<unknown> {
  return adminApiClient(`/api/admin/pods/${id}`, { method: 'PATCH', body })
}

export async function deleteAdminPod(id: string): Promise<{ success: true }> {
  return adminApiClient(`/api/admin/pods/${id}`, { method: 'DELETE' })
}

export async function removeAdminPodMember(
  podId: string,
  userId: string,
): Promise<{ success: true }> {
  return adminApiClient(`/api/admin/pods/${podId}/members/${userId}`, { method: 'DELETE' })
}
