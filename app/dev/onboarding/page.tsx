import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { MeetCoHarness } from '@/components/onboarding/meet-co/harness'

/** Local visual qualification only; fixtures are served by Playwright/dev HTTP mocks. */
export default function OnboardingDevPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <Suspense><MeetCoHarness /></Suspense>
}
