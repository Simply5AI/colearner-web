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
      title="Failed to load Mastery"
      message="We couldn't load mastery analytics. Please try again."
      onRetry={reset}
    />
  )
}
