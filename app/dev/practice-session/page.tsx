import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { PracticeSessionHarness } from '@/components/practice/session/dev/practice-session-harness'

/** Local visual qualification only; synthetic fixtures, no real API, and unavailable outside development. */
export default function PracticeSessionDevPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <Suspense><PracticeSessionHarness /></Suspense>
}
