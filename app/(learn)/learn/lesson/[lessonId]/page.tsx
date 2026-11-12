import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LessonWorkspace } from '@/components/lesson/lesson-workspace'

export const metadata: Metadata = { title: 'Lesson | CoLearner' }
export default async function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(lessonId)) notFound()
  return <LessonWorkspace lessonId={lessonId} />
}
