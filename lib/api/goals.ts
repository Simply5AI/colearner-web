import { apiClient } from '@/lib/api/client'
import type {
  GoalWithProgress,
  GoalDetail,
  GoalProgress,
  Goal,
  GoalMemoryInsights,
  GoalMemorySuggestion,
  GoalExtractionLink,
  CreateGoalInput,
  UpdateGoalInput,
} from '@/lib/types'

export async function getGoals(
  headers: Record<string, string>
): Promise<GoalWithProgress[]> {
  return apiClient<GoalWithProgress[]>('/api/goals', { headers })
}

export async function getGoal(
  headers: Record<string, string>,
  id: string
): Promise<GoalDetail> {
  return apiClient<GoalDetail>(`/api/goals/${id}`, { headers })
}

export async function createGoal(
  headers: Record<string, string>,
  data: CreateGoalInput
): Promise<Goal> {
  return apiClient<Goal>('/api/goals', {
    method: 'POST',
    headers,
    body: data,
  })
}

export async function updateGoal(
  headers: Record<string, string>,
  id: string,
  data: UpdateGoalInput
): Promise<Goal> {
  return apiClient<Goal>(`/api/goals/${id}`, {
    method: 'PATCH',
    headers,
    body: data,
  })
}

export async function deleteGoal(
  headers: Record<string, string>,
  id: string
): Promise<void> {
  await apiClient(`/api/goals/${id}`, {
    method: 'DELETE',
    headers,
  })
}

export async function linkExtraction(
  headers: Record<string, string>,
  goalId: string,
  extractionId: string
): Promise<void> {
  await apiClient(`/api/goals/${goalId}/extractions`, {
    method: 'POST',
    headers,
    body: { extractionId },
  })
}

export async function unlinkExtraction(
  headers: Record<string, string>,
  goalId: string,
  extractionId: string
): Promise<void> {
  await apiClient(`/api/goals/${goalId}/extractions/${extractionId}`, {
    method: 'DELETE',
    headers,
  })
}

export async function getGoalProgress(
  headers: Record<string, string>,
  id: string
): Promise<GoalProgress> {
  return apiClient<GoalProgress>(`/api/goals/${id}/progress`, { headers })
}

export async function getGoalMemoryInsights(
  headers: Record<string, string>,
  id: string
): Promise<GoalMemoryInsights> {
  return apiClient<GoalMemoryInsights>(`/api/goals/${id}/memory-insights`, { headers })
}

export async function acceptGoalMemorySuggestion(
  headers: Record<string, string>,
  goalId: string,
  suggestionId: string
): Promise<{ suggestion: GoalMemorySuggestion; link: GoalExtractionLink }> {
  return apiClient<{ suggestion: GoalMemorySuggestion; link: GoalExtractionLink }>(
    `/api/goals/${goalId}/memory-suggestions/${suggestionId}/accept`,
    {
      method: 'POST',
      headers,
    }
  )
}

export async function dismissGoalMemorySuggestion(
  headers: Record<string, string>,
  goalId: string,
  suggestionId: string
): Promise<GoalMemorySuggestion> {
  return apiClient<GoalMemorySuggestion>(
    `/api/goals/${goalId}/memory-suggestions/${suggestionId}/dismiss`,
    {
      method: 'POST',
      headers,
    }
  )
}

export async function unsuppressGoalSuggestionType(
  headers: Record<string, string>,
  goalId: string,
  type: 'EXTRACTION_LINK' | 'WEAK_AREA' | 'NEXT_ACTION'
): Promise<unknown> {
  return apiClient(`/api/goals/${goalId}/memory-suggestions/unsuppress`, {
    method: 'POST',
    headers,
    body: { type },
  })
}
