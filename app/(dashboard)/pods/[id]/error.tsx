'use client'

import { ErrorFallback } from '@/components/shared/ErrorFallback'

export default function PodDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorFallback
      title="Failed to load Study Group"
      message="We couldn't load this study group. Please try again."
      onRetry={reset}
    />
  )
}
