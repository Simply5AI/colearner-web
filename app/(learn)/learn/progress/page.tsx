import type { Metadata } from 'next'
import { ProgressScreen } from '@/components/learn-progress/progress-view'

export const metadata: Metadata = { title: 'Progress | CoLearner' }

/** L13. Readiness numbers come from the server. Kids responses are not allowed to carry percentages. */
export default function LearnProgressPage() {
  return <ProgressScreen />
}
