'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLearnIdentity } from '@/components/learn/learn-common'
import { notesApi, notesKeys, type NewStudyNote, type NoteFilters } from '@/lib/api/notes'

/** The learner's pages (optionally for one material or kind). Always fresh: another tab or the reader may have changed them. */
export function useNotes(filters: NoteFilters, enabled = true) {
  const { actor } = useLearnIdentity()
  return useQuery({ queryKey: notesKeys.list(actor, filters), queryFn: () => notesApi.list(filters), enabled: !!actor && enabled, retry: false, staleTime: 0, gcTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: false })
}

export function useNoteMutations() {
  const cache = useQueryClient()
  const refresh = () => { void cache.invalidateQueries({ queryKey: notesKeys.root }) }
  return {
    create: useMutation({ mutationFn: (input: NewStudyNote) => notesApi.create(input), retry: false, onSuccess: refresh }),
    update: useMutation({ mutationFn: ({ id, ...changes }: { id: string; title?: string; body?: string }) => notesApi.update(id, changes), retry: false, onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id: string) => notesApi.remove(id), retry: false, onSuccess: refresh }),
  }
}
