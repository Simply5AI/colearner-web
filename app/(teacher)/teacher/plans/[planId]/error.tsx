'use client'

import { ErrorFallback } from '@/components/shared/ErrorFallback'

export default function TeacherPlanEditorError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorFallback
      title="Plan editor unavailable"
      message={error.message}
      onRetry={reset}
    />
  )
}