'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import {
  updateOnboardingProfile,
  updateOnboardingGoal,
  updateOnboardingSkills,
  completeOnboarding,
  updateProfile,
} from '@/lib/api/user'
import { queryKeys } from '@/lib/api/query-keys'
import type { LearningGoal } from '@/lib/types'

export function useUpdateProfile() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      name?: string
      bio?: string
      profileImageUrl?: string
      goals?: LearningGoal[]
      dailyGoalMinutes?: number
      skillsInterests?: string[]
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
      dailyGoalMinutes: number
      skillsInterests: string[]
    }) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      const token = session.accessToken

      // Step 1: Profile
      await updateOnboardingProfile(token, {
        displayName: data.name,
        bio: data.bio,
      })

      // Step 2: Goal
      await updateOnboardingGoal(token, {
        learningGoal: (data.goals[0] || 'BUILD_KNOWLEDGE').toUpperCase(),
        dailyTimeMinutes: data.dailyGoalMinutes,
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
