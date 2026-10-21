import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { PracticeBrowserHarness } from '@/components/practice/dev/practice-harness'

/** Local visual qualification only; synthetic fixtures, no real API, and unavailable outside development. */
export default function PracticeDevPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <Suspense><PracticeBrowserHarness /></Suspense>
}
