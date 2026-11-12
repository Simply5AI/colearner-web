'use client'

import { ErrorFallback } from '@/components/shared/ErrorFallback'

export default function TeacherQuestionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorFallback
      title="Question bank unavailable"
      message={error.message}
      onRetry={reset}
    />
  )
}
