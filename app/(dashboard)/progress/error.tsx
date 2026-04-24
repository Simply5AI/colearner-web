'use client'

import { ErrorFallback } from '@/components/shared/ErrorFallback'

export default function MasteryError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorFallback
      title="Failed to load Progress"
      message="We couldn't load your progress. Please try again."
      onRetry={reset}
    />
  )
}
