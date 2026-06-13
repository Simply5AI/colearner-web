import { seedTeacherPlans } from '@/lib/fixtures/teacher-plans'
import { countTopics } from '@/lib/teacher/plan-tree-utils'
import type { PlanStatus, TeacherStudyPlan, TeacherStudyPlanSummary, TreeNode } from '@/lib/types/teacher'

type PlansGlobal = typeof globalThis & {
  __teacherPlansStore?: TeacherStudyPlan[]
}

const storeKey = '__teacherPlansStore'

function getStore(): TeacherStudyPlan[] {
  const globalStore = globalThis as PlansGlobal
  if (!globalStore[storeKey]) {
    globalStore[storeKey] = structuredClone(seedTeacherPlans)
  }
  return globalStore[storeKey]!
}

function toSummary(plan: TeacherStudyPlan): TeacherStudyPlanSummary {
  const { tree: _tree, ...summary } = plan
  return {
    ...summary,
    topicCount: countTopics(plan.tree),
  }
}

export function listTeacherPlans(filters?: {
  status?: PlanStatus
  search?: string
}): TeacherStudyPlanSummary[] {
  const search = filters?.search?.trim().toLowerCase()
  return getStore()
    .filter((plan) => (filters?.status ? plan.status === filters.status : true))
    .filter((plan) =>
      search
        ? plan.title.toLowerCase().includes(search) ||
          plan.description.toLowerCase().includes(search) ||
          plan.subjectTags.some((tag) => tag.toLowerCase().includes(search))
        : true,
    )
    .map(toSummary)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getTeacherPlan(planId: string): TeacherStudyPlan | null {
  const plan = getStore().find((entry) => entry.id === planId)
  return plan ? structuredClone(plan) : null
}

export function createTeacherPlan(input: {
  title: string
  description: string
  subjectTags: string[]
}): TeacherStudyPlan {
  const now = new Date().toISOString()
  const plan: TeacherStudyPlan = {
    id: `plan-${crypto.randomUUID().slice(0, 8)}`,
    title: input.title.trim(),
    description: input.description.trim(),
    subjectTags: input.subjectTags,
    status: 'DRAFT',
    enrollmentCount: 0,
    topicCount: 0,
    questionCount: 0,
    updatedAt: now,
    publishedAt: null,
    tree: [],
  }
  getStore().unshift(plan)
  return structuredClone(plan)
}

export function updateTeacherPlan(
  planId: string,
  patch: Partial<Pick<TeacherStudyPlan, 'title' | 'description' | 'subjectTags' | 'tree' | 'questionCount'>>,
): TeacherStudyPlan | null {
  const index = getStore().findIndex((entry) => entry.id === planId)
  if (index < 0) return null

  const current = getStore()[index]!
  const updated: TeacherStudyPlan = {
    ...current,
    ...patch,
    tree: patch.tree ?? current.tree,
    updatedAt: new Date().toISOString(),
    topicCount: patch.tree ? countTopics(patch.tree) : current.topicCount,
  }
  getStore()[index] = updated
  return structuredClone(updated)
}

export function publishTeacherPlan(planId: string): TeacherStudyPlan | null {
  const plan = getStore().find((entry) => entry.id === planId)
  if (!plan || plan.status === 'ARCHIVED') return null
  plan.status = 'PUBLISHED'
  plan.publishedAt = new Date().toISOString()
  plan.updatedAt = plan.publishedAt
  return structuredClone(plan)
}

export function archiveTeacherPlan(planId: string): TeacherStudyPlan | null {
  const plan = getStore().find((entry) => entry.id === planId)
  if (!plan) return null
  plan.status = 'ARCHIVED'
  plan.updatedAt = new Date().toISOString()
  return structuredClone(plan)
}

export function updateTeacherPlanTree(planId: string, tree: TreeNode[]): TeacherStudyPlan | null {
  return updateTeacherPlan(planId, { tree })
}