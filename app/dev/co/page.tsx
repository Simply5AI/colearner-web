import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { CoBrowserHarness } from '@/components/co/dev/co-harness'

/** Local visual qualification only; synthetic fixtures, no real API, and unavailable outside development. */
export default function CoDevPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <Suspense><CoBrowserHarness /></Suspense>
}
