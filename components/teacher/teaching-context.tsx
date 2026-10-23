'use client'

import { createContext, useCallback, useContext, useMemo, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  classifyTeachingError,
  teachingBrowserRequest,
  type TeachingFailure,
  type TeachingMethod,
} from '@/lib/api/teaching/core'

type TeachingRequest = <T>(
  suffix: string,
  method?: TeachingMethod,
  body?: unknown,
  headers?: Record<string, string>,
) => Promise<T>

interface TeachingContextValue {
  schoolId: string
  schoolName: string
  request: TeachingRequest
}

const TeachingContext = createContext<TeachingContextValue | null>(null)

export function TeachingProvider({
  schoolId,
  schoolName,
  children,
  requestImpl,
}: {
  schoolId: string
  schoolName: string
  children: React.ReactNode
  /** Dev harness and tests only: replaces the network transport. Production pages never pass it. */
  requestImpl?: TeachingRequest
}) {
  const value = useMemo<TeachingContextValue>(
    () => ({
      schoolId,
      schoolName,
      request:
        requestImpl ??
        (<T,>(
          suffix: string,
          method: TeachingMethod = 'GET',
          body?: unknown,
          headers?: Record<string, string>,
        ) => teachingBrowserRequest<T>(schoolId, suffix, method, body, headers)),
    }),
    [schoolId, schoolName, requestImpl],
  )
  return <TeachingContext.Provider value={value}>{children}</TeachingContext.Provider>
}

export function useTeaching(): TeachingContextValue {
  const value = useContext(TeachingContext)
  if (!value) throw new Error('useTeaching must be used inside TeachingProvider')
  return value
}

export type TeachingResource<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; kind: TeachingFailure; message: string }

/** GET + Zod parse with loading / ready / denied / unavailable / retry. A parse failure is an error, never a render. */
export function useTeachingResource<T>(
  suffix: string,
  parse: (value: unknown) => T,
): { resource: TeachingResource<T>; reload: () => void; setData: (data: T) => void } {
  const { request, schoolId } = useTeaching()
  const client = useQueryClient()
  const parseRef = useRef(parse)
  parseRef.current = parse
  const key = useMemo(() => ['teaching', schoolId, 'w1', suffix] as const, [schoolId, suffix])
  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const raw = await request<unknown>(suffix)
      try {
        return parseRef.current(raw)
      } catch {
        throw new Error('The server sent a response this page does not recognise. Try again.')
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 0,
  })
  const reload = useCallback(() => {
    void client.invalidateQueries({ queryKey: key })
  }, [client, key])
  const setData = useCallback((data: T) => client.setQueryData(key, data), [client, key])
  const resource: TeachingResource<T> = query.isError
    ? { status: 'error', ...classifyTeachingError(query.error) }
    : query.data !== undefined
      ? { status: 'ready', data: query.data }
      : { status: 'loading' }
  return { resource, reload, setData }
}
