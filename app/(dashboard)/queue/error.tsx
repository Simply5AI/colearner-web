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
      title="Failed to load Practice"
      message="We couldn't load the practice page. Please try again."
      onRetry={reset}
    />
  )
}
