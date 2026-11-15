import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LearnHomeScreen } from '@/components/learn/learn-home'
import { tutorLoopReady } from '@/components/tutor-loop/shell/eligibility'

export const metadata: Metadata = { title: 'Home | CoLearner' }
/** Eligible learners go to Today (TL04); everyone else keeps the existing home. */
export default async function LearnHomePage() {
  if (await tutorLoopReady()) redirect('/learn/today')
  return <LearnHomeScreen />
}
