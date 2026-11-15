import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { MyPages } from '@/components/notes/my-pages'
import { tutorLoopReady } from '@/components/tutor-loop/shell/eligibility'

export const metadata: Metadata = { title: 'My pages | CoLearner' }

/** DEMO-B. The learner's own notes, saved Co answers and analogies across all of their materials. */
export default async function MyPagesRoute() {
  if (await tutorLoopReady()) redirect('/learn?tab=notes')
  return <MyPages />
}
