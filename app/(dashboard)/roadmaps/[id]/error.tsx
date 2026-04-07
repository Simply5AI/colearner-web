'use client'

import { ErrorFallback } from '@/components/shared/ErrorFallback'

export default function RoadmapDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorFallback
      title="Failed to load Study Plan"
      message="We couldn't load this study plan. Please try again."
      onRetry={reset}
    />
  )
}
