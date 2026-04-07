'use client'

import { ErrorFallback } from '@/components/shared/ErrorFallback'

export default function CaptureError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorFallback
      title="Failed to load Library"
      message="We couldn't load the library page. Please try again."
      onRetry={reset}
    />
  )
}
