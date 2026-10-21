import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { HomeworkBrowserHarness } from '@/components/homework/dev/homework-harness'

/** Local visual qualification only; synthetic fixtures, no real API, and unavailable outside development. */
export default function HomeworkDevPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <Suspense><HomeworkBrowserHarness /></Suspense>
}
