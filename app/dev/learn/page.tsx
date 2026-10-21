import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { LearnBrowserHarness } from '@/components/learn/dev/learn-browser-harness'

/** Local visual qualification only; synthetic fixtures, no API, and unavailable outside development. */
export default function LearnDevPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <Suspense><LearnBrowserHarness /></Suspense>
}
