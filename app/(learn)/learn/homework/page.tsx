import type { Metadata } from 'next'
import { HomeworkEntryScreen } from '@/components/homework/homework-entry'

export const metadata: Metadata = { title: 'Homework help | CoLearner' }

/** L18: type a problem, see earlier sessions. The server owns every access, policy and consent check. */
export default function HomeworkHelpPage() {
  return <HomeworkEntryScreen />
}
