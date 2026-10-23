import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { TeacherOnboardingHarness } from '@/components/teacher/onboarding/dev/onboarding-harness'

export default function TeacherOnboardingDevPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return (
    <Suspense>
      <TeacherOnboardingHarness />
    </Suspense>
  )
}
