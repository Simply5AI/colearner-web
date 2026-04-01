'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { getProfile, updateProfile, uploadAvatar } from '@/lib/api/user'
import { queryKeys } from '@/lib/api/query-keys'
import type { UserProfile } from '@/lib/types'

export function useProfile() {
  const { data: session } = useSession()

  return useQuery({
    queryKey: queryKeys.user.profile(),
    queryFn: () => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return getProfile(session.accessToken)
    },
    enabled: !!session?.accessToken,
  })
}

export function useUpdateProfileMutation() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      data: Partial<
        Pick<
          UserProfile,
          'name' | 'bio' | 'avatarUrl' | 'learningGoal' | 'dailyTimeMinutes'
        >
      > & { topicSlugs?: string[] }
    ) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return updateProfile(session.accessToken, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.profile() })
    },
  })
}

export function useUploadAvatar() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return uploadAvatar(session.accessToken, file)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.profile() })
    },
  })
}
