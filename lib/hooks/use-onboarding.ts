'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import {
  updateOnboardingProfile,
  updateOnboardingGoal,
  completeOnboarding,
  updateProfile,
  getTopics,
  getSubjects,
  updateOnboardingSubjects,
  createCustomSubject,
  uploadAvatar,
} from '@/lib/api/user'
import { queryKeys } from '@/lib/api/query-keys'
import { useOnboardingStore } from '@/lib/stores/onboarding-store'
import type { LearningGoal } from '@/lib/types'

export function useTopics() {
  const { data: session } = useSession()

  return useQuery({
    queryKey: queryKeys.onboarding.topics(),
    queryFn: () => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return getTopics(session.accessToken)
    },
    enabled: !!session?.accessToken,
    staleTime: 1000 * 60 * 10, // 10 minutes
  })
}

export function useSubjects() {
  const { data: session } = useSession()

  return useQuery({
    queryKey: queryKeys.onboarding.subjects(),
    queryFn: () => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return getSubjects(session.accessToken)
    },
    enabled: !!session?.accessToken,
    staleTime: 1000 * 60 * 10,
  })
}

export function useUpdateOnboardingSubjects() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (subjectIds: string[]) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return updateOnboardingSubjects(session.accessToken, { subjectIds })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.profile() })
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.subjects() })
    },
  })
}

export function useCreateCustomSubject() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { name: string }) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return createCustomSubject(session.accessToken, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.profile() })
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.subjects() })
    },
  })
}

export function useUpdateProfile() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      name?: string
      bio?: string
      avatarUrl?: string
      learningGoal?: string
      dailyTimeMinutes?: number
      topicSlugs?: string[]
    }) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return updateProfile(session.accessToken, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.profile() })
    },
  })
}

export function useCompleteOnboarding() {
  const { data: session, update } = useSession()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      name: string
      bio?: string
      goals: LearningGoal[]
      goalTitle?: string
    }) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      const token = session.accessToken

      const avatarFile = useOnboardingStore.getState().avatarFile
      let avatarUrl: string | undefined
      if (avatarFile) {
        const result = await uploadAvatar(token, avatarFile)
        avatarUrl = result.avatarUrl
      }

      const storeState = useOnboardingStore.getState()
      await updateOnboardingProfile(token, {
        displayName: data.name,
        bio: data.bio,
        ...(avatarUrl ? { avatarUrl } : {}),
        ...(storeState.dateOfBirth ? { dateOfBirth: storeState.dateOfBirth } : {}),
        ...(storeState.gradeLevel ? { gradeLevel: storeState.gradeLevel } : {}),
        ...(storeState.gender ? { gender: storeState.gender } : {}),
        ...(storeState.learnerType ? { learnerType: storeState.learnerType } : {}),
      })

      await updateOnboardingGoal(token, {
        learningGoal: (data.goals[0] || 'BUILD_KNOWLEDGE').toUpperCase(),
        ...(data.goalTitle ? { goalTitle: data.goalTitle } : {}),
      })

      await completeOnboarding(token)

      await update({ onboardingCompleted: true })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.profile() })
    },
  })
}
