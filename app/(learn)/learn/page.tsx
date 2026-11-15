import type { Metadata } from 'next'
import { LearnOverviewScreen } from '@/components/learn/learn-overview'
import { TutorLearnScreen } from '@/components/tutor-loop/learn/tutor-learn-screen'
import { tutorLoopReady } from '@/components/tutor-loop/shell/eligibility'

export const metadata: Metadata = { title: 'Learn | CoLearner' }
export default async function LearnPage() {
  return (await tutorLoopReady()) ? <TutorLearnScreen /> : <LearnOverviewScreen />
}
