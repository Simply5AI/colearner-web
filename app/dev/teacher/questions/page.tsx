import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { QuestionsHarness } from './harness'

export default function TeacherQuestionsDevPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <Suspense><QuestionsHarness /></Suspense>
}
