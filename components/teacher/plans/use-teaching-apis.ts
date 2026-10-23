'use client'

import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTeaching } from '@/components/teacher/teaching-context'
import { assignmentsApi } from '@/lib/api/teaching/assignments'
import { lessonsApi } from '@/lib/api/teaching/lessons'
import { materialsApi } from '@/lib/api/teaching/materials'
import { plansApi, type TeachingRequest, type TeachingPlanDetail } from '@/lib/api/teaching/plans'
import { topicsApi } from '@/lib/api/teaching/topics'

/** The typed, Zod-parsing B12 clients bound to the signed-in teacher's school. */
export function useTeachingApis() {
  const { request, schoolId, schoolName } = useTeaching()
  return useMemo(() => {
    const send = request as TeachingRequest
    return {
      schoolId, schoolName,
      plans: plansApi(send), topics: topicsApi(send), lessons: lessonsApi(send), materials: materialsApi(send), assignments: assignmentsApi(send),
    }
  }, [request, schoolId, schoolName])
}

export const teachingKeys = {
  all: (schoolId: string) => ['teaching', schoolId] as const,
  context: (schoolId: string) => ['teaching', schoolId, 'context'] as const,
  plans: (schoolId: string) => ['teaching', schoolId, 'plans'] as const,
  plan: (schoolId: string, planId: string) => ['teaching', schoolId, 'plan', planId] as const,
  topic: (schoolId: string, planId: string, topicId: string) => ['teaching', schoolId, 'topic', planId, topicId] as const,
  assignments: (schoolId: string, planId: string) => ['teaching', schoolId, 'assignments', planId] as const,
}

const fresh = { retry: false, staleTime: 0, refetchOnWindowFocus: false } as const

export function useTeachingContextData() {
  const apis = useTeachingApis()
  return useQuery({ queryKey: teachingKeys.context(apis.schoolId), queryFn: () => apis.plans.context(), ...fresh })
}
export function usePlanQuery(planId: string) {
  const apis = useTeachingApis()
  return useQuery({ queryKey: teachingKeys.plan(apis.schoolId, planId), queryFn: () => apis.plans.get(planId), ...fresh })
}
/** Writes a fresh server plan into the cache (and marks the plan list stale) so every pane shows one revision. */
export function useSetPlan() {
  const client = useQueryClient()
  const { schoolId } = useTeaching()
  return (plan: TeachingPlanDetail) => {
    client.setQueryData(teachingKeys.plan(schoolId, plan.id), plan)
    void client.invalidateQueries({ queryKey: teachingKeys.plans(schoolId) })
  }
}
