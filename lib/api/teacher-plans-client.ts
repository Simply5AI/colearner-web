'use client'

import { ApiError } from '@/lib/api/client'
import type { PlanStatus, TeacherStudyPlan, TeacherStudyPlanSummary, TreeNode } from '@/lib/types/teacher'

async function teacherPlansFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new ApiError(res.status, error.message ?? res.statusText)
  }

  return res.json() as Promise<T>
}

export function listTeacherPlansClient(query?: {
  status?: PlanStatus
  search?: string
}): Promise<TeacherStudyPlanSummary[]> {
  const params = new URLSearchParams()
  if (query?.status) params.set('status', query.status)
  if (query?.search) params.set('search', query.search)
  const qs = params.toString()
  return teacherPlansFetch(`/api/teacher/study-plans${qs ? `?${qs}` : ''}`)
}

export function createTeacherPlanClient(body: {
  title: string
  description: string
  subjectTags: string[]
}): Promise<TeacherStudyPlan> {
  return teacherPlansFetch('/api/teacher/study-plans', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateTeacherPlanClient(
  planId: string,
  body: Partial<Pick<TeacherStudyPlan, 'title' | 'description' | 'subjectTags' | 'tree'>>,
): Promise<TeacherStudyPlan> {
  return teacherPlansFetch(`/api/teacher/study-plans/${planId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function publishTeacherPlanClient(planId: string): Promise<TeacherStudyPlan> {
  return teacherPlansFetch(`/api/teacher/study-plans/${planId}/publish`, { method: 'POST' })
}

export function archiveTeacherPlanClient(planId: string): Promise<TeacherStudyPlan> {
  return teacherPlansFetch(`/api/teacher/study-plans/${planId}/archive`, { method: 'POST' })
}

export function updateTeacherPlanTreeClient(planId: string, tree: TreeNode[]): Promise<TeacherStudyPlan> {
  return updateTeacherPlanClient(planId, { tree })
}