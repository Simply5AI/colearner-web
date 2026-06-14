import { apiClient } from '@/lib/api/client'
import type {
  PlanAggregateAnalytics,
  PlanRosterEntry,
  StudentPlanAnalytics,
} from '@/lib/types/teacher'

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

export async function fetchStudentDetail(
  headers: Record<string, string>,
  studentUserId: string,
  planId: string,
): Promise<StudentPlanAnalytics | null> {
  return apiClient<StudentPlanAnalytics | null>(
    `/api/teacher/analytics/student/${studentUserId}?planId=${planId}`,
    { headers },
  )
}