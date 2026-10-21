import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { LearnLinkHarness } from '@/components/learn/dev/learn-link-harness'

/** Local visual qualification only; synthetic fixtures served by Playwright HTTP mocks, and unavailable outside development. */
export default function LearnLinkDevPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <Suspense><LearnLinkHarness /></Suspense>
}
