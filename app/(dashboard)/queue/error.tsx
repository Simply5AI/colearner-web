'use client'

import { ErrorFallback } from '@/components/shared/ErrorFallback'

export default function QueueError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorFallback
      title="Failed to load Queue"
      message="We couldn't load the review queue. Please try again."
      onRetry={reset}
    />
  )
}
