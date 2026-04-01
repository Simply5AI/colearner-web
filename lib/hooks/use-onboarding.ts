'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import {
  updateOnboardingProfile,
  updateOnboardingGoal,
  updateOnboardingSkills,
  completeOnboarding,
  updateProfile,
  getTopics,
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
      dailyGoalMinutes: number
      skillsInterests: string[]
    }) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      const token = session.accessToken

      // Step 0: Upload avatar if one was selected
      const avatarFile = useOnboardingStore.getState().avatarFile
      let avatarUrl: string | undefined
      if (avatarFile) {
        const result = await uploadAvatar(token, avatarFile)
        avatarUrl = result.avatarUrl
      }

      // Step 1: Profile
      await updateOnboardingProfile(token, {
        displayName: data.name,
        bio: data.bio,
        ...(avatarUrl ? { avatarUrl } : {}),
      })

      // Step 2: Goal
      await updateOnboardingGoal(token, {
        learningGoal: (data.goals[0] || 'BUILD_KNOWLEDGE').toUpperCase(),
        dailyTimeMinutes: data.dailyGoalMinutes,
        ...(data.goalTitle ? { goalTitle: data.goalTitle } : {}),
      })

      // Step 3: Skills
      await updateOnboardingSkills(token, {
        topicIds: data.skillsInterests,
      })

      // Step 4: Mark complete
      await completeOnboarding(token)

      // Step 5: Refresh session so middleware sees onboardingCompleted: true
      await update({ onboardingCompleted: true })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.profile() })
    },
  })
}
