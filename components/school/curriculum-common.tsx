'use client'
import { useSession } from 'next-auth/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { schoolPath } from '@/lib/api/school'
import { curriculumRequest, parseCurriculum } from '@/lib/api/curriculum'

/** Reads one curriculum resource, validating the response shape at the boundary. */
export function useCurriculumData<T>(schoolId: string, suffix: string, schema: z.ZodType<T>, enabled = true) {
  const { data: session } = useSession()
  return useQuery({
    queryKey: ['school', schoolId, 'curriculum', suffix, session?.user?.id],
    queryFn: async () => parseCurriculum(schema, await curriculumRequest<unknown>(schoolPath(schoolId, suffix))),
    enabled: !!session?.accessToken && enabled,
    retry: false,
  })
}

/** Writes never auto-retry; the screen offers an explicit retry that reuses the unchanged draft. */
export function useCurriculumAction(schoolId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ suffix, method, body }: { suffix: string; method: 'POST' | 'PUT' | 'DELETE'; body?: unknown }) =>
      curriculumRequest<unknown>(schoolPath(schoolId, suffix), method, body),
    retry: false,
    onSuccess: () => client.invalidateQueries({ queryKey: ['school', schoolId, 'curriculum'] }),
  })
}
