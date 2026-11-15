import type { Metadata } from 'next'
import { LessonStartScreen } from '@/components/lesson/lesson-screen'
import { ShortLessonStarter } from '@/components/tutor-loop/lesson/lesson-entry'
import { tutorLoopReady } from '@/components/tutor-loop/shell/eligibility'

export const metadata: Metadata = { title: 'Start a lesson | CoLearner' }
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null
const safe = (v: string | null) => (v && /^[A-Za-z0-9-]{8,64}$/.test(v) ? v : null)

/** The ids are validated by the client screen and again by the server, which owns the material, learner and school checks. */
export default async function NewLessonPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams
  const materialId = safe(one(query.materialId)), topicId = safe(one(query.topicId))
  if (one(query.format) === 'short' && materialId && topicId && (await tutorLoopReady())) return <ShortLessonStarter materialId={materialId} topicId={topicId} />
  return <LessonStartScreen materialId={one(query.materialId)} planItemId={one(query.planItemId)} conceptId={one(query.conceptId)} />
}
