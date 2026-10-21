import type { Metadata } from 'next'
import { LearnOverviewScreen } from '@/components/learn/learn-overview'

export const metadata: Metadata = { title: 'Learn | CoLearner' }
export default function LearnPage() { return <LearnOverviewScreen /> }
