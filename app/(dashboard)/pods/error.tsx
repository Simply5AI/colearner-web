'use client'

import { ErrorFallback } from '@/components/shared/ErrorFallback'

export default function PodsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorFallback
      title="Failed to load Study Groups"
      message="We couldn't load the study groups page. Please try again."
      onRetry={reset}
    />
  )
}
