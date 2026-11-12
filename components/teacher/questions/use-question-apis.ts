'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTeaching } from '@/components/teacher/teaching-context'
import { plansApi, type PlanTreeNode, type TeachingRequest } from '@/lib/api/teaching/plans'
import { topicsApi } from '@/lib/api/teaching/topics'
import { coDraftsApi } from '@/lib/api/teaching/co-drafts'
import { questionsApi } from '@/lib/api/teaching/questions'

export function useQuestionApis() {
  const { request, schoolId } = useTeaching()
  return useMemo(() => {
    const send = request as TeachingRequest
    return { schoolId, questions: questionsApi(send), co: coDraftsApi(send), plans: plansApi(send), topics: topicsApi(send) }
  }, [request, schoolId])
}

export const questionKeys = {
  root: (schoolId: string) => ['teaching', schoolId, 'questions'] as const,
  list: (schoolId: string, filters: unknown) => ['teaching', schoolId, 'questions', 'list', filters] as const,
  detail: (schoolId: string, id: string) => ['teaching', schoolId, 'questions', 'detail', id] as const,
  batch: (schoolId: string, id: string) => ['teaching', schoolId, 'questions', 'batch', id] as const,
}
const fresh = { retry: false, staleTime: 0, refetchOnWindowFocus: false } as const

export interface TopicOption { id: string; title: string; phase: string | null }
export const flattenTopics = (nodes: PlanTreeNode[], phase: string | null = null): TopicOption[] =>
  nodes.flatMap(node => node.kind === 'module'
    ? flattenTopics(node.children, node.title)
    : [{ id: node.id, title: node.title, phase }, ...flattenTopics(node.children, phase)])

/** The teacher's own plans (id and title) for the plan filter. */
export function usePlanOptions() {
  const apis = useQuestionApis()
  return useQuery({ queryKey: ['teaching', apis.schoolId, 'questions', 'plan-options'], queryFn: async () => (await apis.plans.list({ limit: 50 })).items.map(p => ({ id: p.id, title: p.title, status: p.status })), ...fresh })
}
/** Topics of one plan (flattened from the plan tree). Disabled until a plan is chosen. */
export function usePlanTopics(planId: string | undefined) {
  const apis = useQuestionApis()
  return useQuery({ queryKey: ['teaching', apis.schoolId, 'questions', 'plan-topics', planId], enabled: !!planId, queryFn: async () => flattenTopics((await apis.plans.get(planId!)).tree), ...fresh })
}
/** One topic's materials (for picture choice, references and Co sources). */
export function useTopicMaterials(planId: string | undefined, topicId: string | undefined) {
  const apis = useQuestionApis()
  return useQuery({ queryKey: ['teaching', apis.schoolId, 'questions', 'topic-materials', planId, topicId], enabled: !!planId && !!topicId, queryFn: async () => (await apis.topics.get(planId!, topicId!)).materials, ...fresh })
}
export function useCoState(planId: string | undefined) {
  const apis = useQuestionApis()
  return useQuery({ queryKey: ['teaching', apis.schoolId, 'questions', 'co-state', planId], enabled: !!planId, queryFn: () => apis.co.state(planId!), ...fresh })
}

/** The plan's Co draft batches, newest first. A failure here only hides the list; it never blocks the bank. */
export function useCoBatches(planId: string | undefined) {
  const apis = useQuestionApis()
  return useQuery({ queryKey: ['teaching', apis.schoolId, 'questions', 'co-batches', planId], enabled: !!planId, queryFn: () => apis.co.list(planId!), ...fresh })
}
