import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LessonWorkspace } from '@/components/lesson/lesson-workspace'
import { LessonVersionSwitch } from '@/components/tutor-loop/lesson/lesson-entry'
import { tutorLoopReady } from '@/components/tutor-loop/shell/eligibility'

export const metadata: Metadata = { title: 'Lesson | CoLearner' }
export default async function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(lessonId)) notFound()
  // Flag off or not eligible: the five-card lesson exactly as before.
  if (!(await tutorLoopReady())) return <LessonWorkspace lessonId={lessonId} />
  return <LessonVersionSwitch lessonId={lessonId} />
}
