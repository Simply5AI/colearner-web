'use client'

import { ErrorFallback } from '@/components/shared/ErrorFallback'

export default function TeacherOrgSetupError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorFallback
      title="Organization setup failed"
      message={error.message}
      onRetry={reset}
    />
  )
}