'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { getProfile, updateProfile, uploadAvatar } from '@/lib/api/user'
import {
  getProfileSummary,
  addEducation,
  updateEducation,
  deleteEducation,
  addCertification,
  updateCertification,
  deleteCertification,
  regenerateSuggestions,
} from '@/lib/api/profile'
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
          'name' | 'bio' | 'avatarUrl' | 'learningGoal' | 'dailyTimeMinutes' | 'dateOfBirth' | 'gradeLevel' | 'gender'
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

// ─── Education & Certification Profile Hooks ────────────────────────────

export function useProfileSummary() {
  const { data: session } = useSession()

  return useQuery({
    queryKey: queryKeys.profile.summary(),
    queryFn: () => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return getProfileSummary(session.accessToken)
    },
    enabled: !!session?.accessToken,
  })
}

export function useAddEducation() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Parameters<typeof addEducation>[1]) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return addEducation(session.accessToken, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.summary() })
    },
  })
}

export function useUpdateEducation() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Parameters<typeof updateEducation>[2] }) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return updateEducation(session.accessToken, id, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.summary() })
    },
  })
}

export function useDeleteEducation() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return deleteEducation(session.accessToken, id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.summary() })
    },
  })
}

export function useAddCertification() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Parameters<typeof addCertification>[1]) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return addCertification(session.accessToken, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.summary() })
    },
  })
}

export function useUpdateCertification() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Parameters<typeof updateCertification>[2] }) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return updateCertification(session.accessToken, id, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.summary() })
    },
  })
}

export function useDeleteCertification() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return deleteCertification(session.accessToken, id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.summary() })
    },
  })
}

export function useRegenerateSuggestions() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return regenerateSuggestions(session.accessToken)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.summary() })
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.list() })
    },
  })
}
