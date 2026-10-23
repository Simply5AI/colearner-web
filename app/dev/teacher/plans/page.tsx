import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { PlansHarness } from './harness'

export default function TeacherPlansDevPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <Suspense><PlansHarness /></Suspense>
}
