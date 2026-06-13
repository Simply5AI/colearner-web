'use client'

import { ErrorFallback } from '@/components/shared/ErrorFallback'

export default function TeacherOnboardingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorFallback
      title="Onboarding unavailable"
      message={error.message}
      onRetry={reset}
    />
  )
}