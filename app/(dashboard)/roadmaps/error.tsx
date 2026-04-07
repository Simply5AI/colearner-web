'use client'

import { ErrorFallback } from '@/components/shared/ErrorFallback'

export default function RoadmapsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorFallback
      title="Failed to load Study Plans"
      message="We couldn't load the study plans page. Please try again."
      onRetry={reset}
    />
  )
}
