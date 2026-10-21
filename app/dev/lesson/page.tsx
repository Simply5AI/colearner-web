import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { LessonBrowserHarness } from '@/components/lesson/dev/lesson-harness'

/** Local visual qualification only; synthetic fixtures, no real API, and unavailable outside development. */
export default function LessonDevPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <Suspense><LessonBrowserHarness /></Suspense>
}
