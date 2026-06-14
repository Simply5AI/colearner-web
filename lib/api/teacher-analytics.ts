import { apiClient } from '@/lib/api/client'
import type { PlanAggregateAnalytics, PlanRosterEntry } from '@/lib/types/teacher'

export async function fetchPlanAggregate(
  headers: Record<string, string>,
  planId: string,
): Promise<PlanAggregateAnalytics> {
  return apiClient<PlanAggregateAnalytics>(`/api/teacher/analytics/plan/${planId}/aggregate`, {
    headers,
  })
}

export async function fetchPlanRoster(
  headers: Record<string, string>,
  planId: string,
): Promise<PlanRosterEntry[]> {
  return apiClient<PlanRosterEntry[]>(`/api/teacher/analytics/plan/${planId}/roster`, { headers })
}