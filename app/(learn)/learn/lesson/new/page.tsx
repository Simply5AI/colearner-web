import type { Metadata } from 'next'
import { LessonStartScreen } from '@/components/lesson/lesson-screen'

export const metadata: Metadata = { title: 'Start a lesson | CoLearner' }
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null

/** The ids are validated by the client screen and again by the server, which owns the material, learner and school checks. */
export default async function NewLessonPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams
  return <LessonStartScreen materialId={one(query.materialId)} planItemId={one(query.planItemId)} />
}
