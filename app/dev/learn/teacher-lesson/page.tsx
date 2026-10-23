import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { TeacherLessonHarness } from './harness'

export default function TeacherLessonDevPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <Suspense><TeacherLessonHarness /></Suspense>
}
