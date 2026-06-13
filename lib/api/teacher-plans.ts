import { apiClient } from '@/lib/api/client'
import { listTeacherPlans, getTeacherPlan } from '@/lib/teacher/plans-dev-store'
import type { PlanStatus, TeacherStudyPlan, TeacherStudyPlanSummary } from '@/lib/types/teacher'

const USE_PLATFORM_API = process.env.TEACHER_PLANS_USE_PLATFORM === 'true'

export interface ListTeacherPlansQuery {
  status?: PlanStatus
  search?: string
}

export async function fetchTeacherPlans(
  headers: Record<string, string>,
  query: ListTeacherPlansQuery = {},
): Promise<TeacherStudyPlanSummary[]> {
  if (!USE_PLATFORM_API) {
    return listTeacherPlans(query)
  }

  const params = new URLSearchParams()
  if (query.status) params.set('status', query.status)
  if (query.search) params.set('search', query.search)
  const qs = params.toString()

  return apiClient<TeacherStudyPlanSummary[]>(
    `/api/teacher/study-plans${qs ? `?${qs}` : ''}`,
    { headers },
  )
}

export async function fetchTeacherPlan(
  headers: Record<string, string>,
  planId: string,
): Promise<TeacherStudyPlan | null> {
  if (!USE_PLATFORM_API) {
    return getTeacherPlan(planId)
  }

  try {
    return await apiClient<TeacherStudyPlan>(`/api/teacher/study-plans/${planId}`, { headers })
  } catch {
    return null
  }
}