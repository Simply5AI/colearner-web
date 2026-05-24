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
  return apiClient<AdminUserDetail>(`/api/admin/users/${id}`, { headers })
}

export async function patchAdminUser(
  headers: Record<string, string>,
  id: string,
  body: { name?: string }
): Promise<AdminUserDetail> {
  return apiClient<AdminUserDetail>(`/api/admin/users/${id}`, {
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
  return apiClient<AdminUserDetail>(`/api/admin/users/${id}/suspend`, {
    method: 'POST',
    headers,
    body,
  })
}

export async function reactivateAdminUser(
  headers: Record<string, string>,
  id: string
): Promise<AdminUserDetail> {
  return apiClient<AdminUserDetail>(`/api/admin/users/${id}/reactivate`, {
    method: 'POST',
    headers,
  })
}

export async function resetAdminUserPassword(
  headers: Record<string, string>,
  id: string
): Promise<{ success: true; sent: boolean }> {
  return apiClient<{ success: true; sent: boolean }>(
    `/api/admin/users/${id}/reset-password`,
    { method: 'POST', headers }
  )
}

export async function deleteAdminUser(
  headers: Record<string, string>,
  id: string
): Promise<{ success: true }> {
  return apiClient<{ success: true }>(`/api/admin/users/${id}`, {
    method: 'DELETE',
    headers,
  })
}

export async function assignAdminUserRole(
  headers: Record<string, string>,
  id: string,
  roleId: string
): Promise<AdminUserDetail> {
  return apiClient<AdminUserDetail>(`/api/admin/users/${id}/roles`, {
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
  return apiClient<AdminUserDetail>(`/api/admin/users/${id}/roles/${roleId}`, {
    method: 'DELETE',
    headers,
  })
}

export async function getAdminUserSessions(
  headers: Record<string, string>,
  id: string
): Promise<AdminUserSession[]> {
  return apiClient<AdminUserSession[]>(`/api/admin/users/${id}/sessions`, { headers })
}

export async function revokeAdminUserSession(
  headers: Record<string, string>,
  id: string,
  tokenId: string
): Promise<{ success: true }> {
  return apiClient<{ success: true }>(
    `/api/admin/users/${id}/sessions/${tokenId}`,
    { method: 'DELETE', headers }
  )
}

// ─── LLM Consumption (Super Admin) ────────────────────────────────────────

export type ConsumptionRange = '7d' | '30d' | '90d' | 'all'
export type ConsumptionGroupBy = 'agent' | 'model' | 'provider' | 'org'

export interface ConsumptionTotals {
  costUsd: number
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  calls: number
  avgCostPerCallUsd: number
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
}

export interface ConsumptionReport {
  range: ConsumptionRange
  groupBy: ConsumptionGroupBy
  startDate: string | null
  endDate: string
  totals: ConsumptionTotals
  series: ConsumptionSeriesPoint[]
  breakdown: ConsumptionBreakdownRow[]
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

export async function getLlmConsumption(
  headers: Record<string, string>,
  range: ConsumptionRange = '30d',
  groupBy: ConsumptionGroupBy = 'agent',
): Promise<ConsumptionReport> {
  return apiClient<ConsumptionReport>(
    `/api/admin/metrics/llm-consumption?range=${range}&groupBy=${groupBy}`,
    { headers },
  )
}

export async function getLlmConsumptionByOrg(
  headers: Record<string, string>,
  orgId: string,
  range: ConsumptionRange = '30d',
): Promise<OrgConsumptionReport> {
  return apiClient<OrgConsumptionReport>(
    `/api/admin/metrics/llm-consumption/by-org/${orgId}?range=${range}`,
    { headers },
  )
}

export function buildLlmConsumptionCsvUrl(params: {
  range: ConsumptionRange
  orgId?: string
  agent?: string
}): string {
  const qs = new URLSearchParams({ range: params.range })
  if (params.orgId) qs.set('orgId', params.orgId)
  if (params.agent) qs.set('agent', params.agent)
  return `/api/admin/metrics/llm-consumption/export.csv?${qs.toString()}`
}

export async function getAdminUserActivity(
  headers: Record<string, string>,
  id: string,
  limit?: number
): Promise<AdminUserActivityEntry[]> {
  const qs = limit ? `?limit=${limit}` : ''
  return apiClient<AdminUserActivityEntry[]>(
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
  nextCursor: string | null
}

export interface AdminLearningSessionDetailResponse {
  session: AdminLearningSessionRow
  attempts: Array<{
    id: string
    questionId: string | null
    questionText: string
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

function queryString(query: Record<string, string | number | undefined | null>) {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    params.set(key, String(value))
  })
  return params.toString()
}

export async function getAdminLearningOverview(
  headers: Record<string, string>,
  id: string
): Promise<AdminLearningOverviewResponse> {
  return apiClient<AdminLearningOverviewResponse>(`/api/admin/users/${id}/learning/overview`, { headers })
}

export async function getAdminLearningMastery(
  headers: Record<string, string>,
  id: string,
  query: Record<string, string | number | undefined | null> = {}
): Promise<AdminLearningMasteryResponse> {
  const qs = queryString(query)
  return apiClient<AdminLearningMasteryResponse>(`/api/admin/users/${id}/learning/mastery${qs ? `?${qs}` : ''}`, { headers })
}

export async function getAdminLearningConceptAttempts(
  headers: Record<string, string>,
  id: string,
  conceptId: string
): Promise<AdminLearningConceptAttemptsResponse> {
  return apiClient<AdminLearningConceptAttemptsResponse>(
    `/api/admin/users/${id}/learning/concepts/${conceptId}/attempts`,
    { headers }
  )
}

export async function getAdminLearningSessions(
  headers: Record<string, string>,
  id: string,
  query: Record<string, string | number | undefined | null> = {}
): Promise<AdminLearningSessionsResponse> {
  const qs = queryString(query)
  return apiClient<AdminLearningSessionsResponse>(`/api/admin/users/${id}/learning/sessions${qs ? `?${qs}` : ''}`, { headers })
}

export async function getAdminLearningSessionDetail(
  headers: Record<string, string>,
  id: string,
  sessionId: string
): Promise<AdminLearningSessionDetailResponse> {
  return apiClient<AdminLearningSessionDetailResponse>(
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
  return apiClient<AdminLearningRoadmapsResponse>(`/api/admin/users/${id}/learning/roadmaps${qs ? `?${qs}` : ''}`, { headers })
}

export async function getAdminLearningRoadmapDetail(
  headers: Record<string, string>,
  id: string,
  roadmapId: string
): Promise<AdminLearningRoadmapDetail> {
  return apiClient<AdminLearningRoadmapDetail>(
    `/api/admin/users/${id}/learning/roadmaps/${roadmapId}`,
    { headers }
  )
}
