import type { Metadata } from 'next'
import { HubScreen } from '@/components/practice/hub-screen'
import { TutorPracticeArea } from '@/components/tutor-loop/practice/practice-area'
import { tutorLoopReady } from '@/components/tutor-loop/shell/eligibility'

export const metadata: Metadata = { title: 'Practice | CoLearner' }
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null

/** L9 hub. Eligible TUTOR learners get the goal-based Practice (query: goalId, topicId, tab=exam); everyone else keeps the legacy hub unchanged. */
export default async function PracticeHubPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams
  if (await tutorLoopReady()) return <TutorPracticeArea />
  return <HubScreen initialTab={one(query.tab) === 'past' ? 'past' : 'today'} planId={one(query.planId)} />
}
