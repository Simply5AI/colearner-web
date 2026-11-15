'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getTutorProfile, updateTutorProfile, type TutorProfile, type TutorProfilePatch } from '@/lib/api/tutor-loop/profile'
import { applyTutorAccessibility } from './accessibility-applier'

export type MeWorkspace = 'school' | 'personal'

export const profileKey = (workspace: MeWorkspace) => ['tutor-profile', workspace] as const

export function useTutorProfile(workspace: MeWorkspace) {
  return useQuery({ queryKey: profileKey(workspace), queryFn: () => getTutorProfile({ workspace }), retry: false })
}

/** PATCH with the revision we last saw; the result replaces the cache so the next save uses the new revision. */
export function useProfilePatch(workspace: MeWorkspace) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Omit<TutorProfilePatch, 'revision'>) => {
      const current = client.getQueryData<TutorProfile>(profileKey(workspace)) ?? (await getTutorProfile({ workspace }))
      return updateTutorProfile({ ...patch, revision: current.revision }, { workspace })
    },
    onSuccess: (profile) => {
      client.setQueryData(profileKey(workspace), profile)
      applyTutorAccessibility(profile.accessibility)
    },
  })
}
