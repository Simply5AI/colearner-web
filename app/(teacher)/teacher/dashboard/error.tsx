'use client'

import { ErrorFallback } from '@/components/shared/ErrorFallback'

export default function TeacherDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorFallback
      title="Dashboard unavailable"
      message={error.message}
      onRetry={reset}
    />
  )
}