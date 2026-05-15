'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import {
  getGoals,
  getGoal,
  createGoal,
  updateGoal,
  deleteGoal,
  linkExtraction,
  unlinkExtraction,
  getGoalMemoryInsights,
  acceptGoalMemorySuggestion,
  dismissGoalMemorySuggestion,
} from '@/lib/api/goals'
import { queryKeys } from '@/lib/api/query-keys'
import type { CreateGoalInput, UpdateGoalInput, GoalWithProgress } from '@/lib/types'

export function useGoals(initialData?: GoalWithProgress[]) {
  const { data: session } = useSession()
  return useQuery({
    queryKey: queryKeys.goals.list(),
    queryFn: () => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return getGoals({ Authorization: `Bearer ${session.accessToken}` })
    },
    enabled: !!session?.accessToken,
    initialData,
  })
}

export function useGoalDetail(id: string | null) {
  const { data: session } = useSession()
  return useQuery({
    queryKey: id ? queryKeys.goals.detail(id) : [...queryKeys.goals.all(), 'detail', '__none__'],
    queryFn: () => {
      if (!session?.accessToken || !id) throw new Error('Not authenticated')
      return getGoal({ Authorization: `Bearer ${session.accessToken}` }, id)
    },
    enabled: !!session?.accessToken && !!id,
  })
}

export function useGoalMemoryInsights(id: string | null) {
  const { data: session } = useSession()
  return useQuery({
    queryKey: id
      ? [...queryKeys.goals.detail(id), 'memory-insights']
      : [...queryKeys.goals.all(), 'detail', '__none__', 'memory-insights'],
    queryFn: () => {
      if (!session?.accessToken || !id) throw new Error('Not authenticated')
      return getGoalMemoryInsights({ Authorization: `Bearer ${session.accessToken}` }, id)
    },
    enabled: !!session?.accessToken && !!id,
  })
}

export function useCreateGoal() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateGoalInput) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return createGoal({ Authorization: `Bearer ${session.accessToken}` }, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.list() })
    },
  })
}

export function useUpdateGoal() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateGoalInput }) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return updateGoal({ Authorization: `Bearer ${session.accessToken}` }, id, data)
    },
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.detail(id) })
    },
  })
}

export function useDeleteGoal() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return deleteGoal({ Authorization: `Bearer ${session.accessToken}` }, id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.list() })
    },
  })
}

export function useLinkExtraction() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ goalId, extractionId }: { goalId: string; extractionId: string }) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return linkExtraction(
        { Authorization: `Bearer ${session.accessToken}` },
        goalId,
        extractionId
      )
    },
    onSuccess: (_result, { goalId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.detail(goalId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.list() })
    },
  })
}

export function useUnlinkExtraction() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ goalId, extractionId }: { goalId: string; extractionId: string }) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return unlinkExtraction(
        { Authorization: `Bearer ${session.accessToken}` },
        goalId,
        extractionId
      )
    },
    onSuccess: (_result, { goalId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.detail(goalId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.list() })
    },
  })
}

export function useAcceptGoalMemorySuggestion() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ goalId, suggestionId }: { goalId: string; suggestionId: string }) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return acceptGoalMemorySuggestion(
        { Authorization: `Bearer ${session.accessToken}` },
        goalId,
        suggestionId
      )
    },
    onSuccess: (_result, { goalId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.detail(goalId) })
      queryClient.invalidateQueries({ queryKey: [...queryKeys.goals.detail(goalId), 'memory-insights'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.list() })
    },
  })
}

export function useDismissGoalMemorySuggestion() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ goalId, suggestionId }: { goalId: string; suggestionId: string }) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return dismissGoalMemorySuggestion(
        { Authorization: `Bearer ${session.accessToken}` },
        goalId,
        suggestionId
      )
    },
    onSuccess: (_result, { goalId }) => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.goals.detail(goalId), 'memory-insights'] })
    },
  })
}
