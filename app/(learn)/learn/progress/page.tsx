import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ProgressScreen } from '@/components/learn-progress/progress-view'
import { tutorLoopReady } from '@/components/tutor-loop/shell/eligibility'

export const metadata: Metadata = { title: 'Progress | CoLearner' }

/** L13. Readiness numbers come from the server. Kids responses are not allowed to carry percentages. */
export default async function LearnProgressPage() {
  if (await tutorLoopReady()) redirect('/learn/today?tab=progress')
  return <ProgressScreen />
}
