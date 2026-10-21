'use client'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, ErrorState, LoadingState } from '@/components/design-system'
import { schoolPath } from '@/lib/api/school'
import { schoolBrowserRequest } from '@/lib/api/school-browser'
import { ApiError } from '@/lib/api/client'
import type { ReactNode } from 'react'

export function useSchoolData<T>(
  schoolId: string,
  suffix: string,
  enabled = true,
) {
  const { data: session } = useSession()
  return useQuery({
    queryKey: ['school', schoolId, suffix, session?.user?.id],
    queryFn: () =>
      schoolBrowserRequest<T>(schoolPath(schoolId, suffix)),
    enabled: !!session?.accessToken && enabled,
    retry: false,
  })
}
export function useSchoolAction(schoolId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      suffix,
      method = 'POST',
      body,
    }: {
      suffix: string
      method?: 'POST' | 'PATCH' | 'DELETE'
      body?: unknown
    }) =>
      schoolBrowserRequest<unknown>(schoolPath(schoolId, suffix), method, body),
    retry: false,
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ['school', schoolId] }),
  })
}
export function SchoolHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-primary">School workspace</p>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold sm:text-4xl">
        {title}
      </h1>
      <p className="max-w-3xl text-muted-foreground">{description}</p>
    </div>
  )
}
export function QueryState({
  pending,
  error,
  retry,
  children,
}: {
  pending: boolean
  error: Error | null
  retry: () => void
  children: ReactNode
}) {
  if (pending) return <LoadingState label="Loading school records…" />
  if (error)
    return (
      <ErrorState
        band="adults"
        title={
          error instanceof ApiError && error.status === 403
            ? 'School access denied'
            : 'School records unavailable'
        }
        description={error.message}
        action={<Button onClick={retry}>Try again</Button>}
      />
    )
  return children
}
export function ActionFeedback({
  pending,
  error,
  success,
}: {
  pending: boolean
  error: Error | null
  success?: boolean
}) {
  return (
    <div aria-live="polite">
      {pending && <LoadingState label="Saving. Please wait…" />}
      {error && (
        <p
          role="alert"
          className="break-words rounded-xl border border-destructive/30 p-4 text-destructive"
        >
          {error.message}
        </p>
      )}
      {success && !pending && !error && (
        <p role="status" className="rounded-xl border p-4">
          Saved. School records have been refreshed.
        </p>
      )}
    </div>
  )
}
export function Pagination({
  page,
  total,
  size = 100,
  onChange,
}: {
  page: number
  total: number
  size?: number
  onChange: (page: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="secondary"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous page
      </Button>
      <span className="text-sm">
        Page {page} · {total} records
      </span>
      <Button
        variant="secondary"
        disabled={page * size >= total}
        onClick={() => onChange(page + 1)}
      >
        Next page
      </Button>
    </div>
  )
}
