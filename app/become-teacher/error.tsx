'use client'

import { ErrorFallback } from '@/components/shared/ErrorFallback'

export default function BecomeTeacherError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorFallback
      title="Could not load teacher signup"
      message={error.message}
      onRetry={reset}
    />
  )
}