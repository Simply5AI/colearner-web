'use client'

import { TeachingFailurePanel } from '@/components/teacher/dashboard/failure-panel'

export default function TeacherDashboardError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <TeachingFailurePanel
      kind="retry"
      message="The dashboard could not be shown."
      onRetry={reset}
      testId="t1-route-error"
    />
  )
}
