import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { WorksheetsHarness } from './harness'

export default function TeacherWorksheetsDevPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <Suspense><WorksheetsHarness /></Suspense>
}
