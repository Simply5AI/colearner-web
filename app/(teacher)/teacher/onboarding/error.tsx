'use client'

import { TeachingFailurePanel } from '@/components/teacher/dashboard/failure-panel'

export default function TeacherOnboardingError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <TeachingFailurePanel
      kind="retry"
      message="Onboarding could not be shown. Anything you saved is kept."
      onRetry={reset}
      testId="t8-route-error"
    />
  )
}
