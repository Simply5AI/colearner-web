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
      title="Failed to load Capture"
      message="We couldn't load the capture page. Please try again."
      onRetry={reset}
    />
  )
}
