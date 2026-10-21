import type { Metadata } from 'next'
import { LearnHomeScreen } from '@/components/learn/learn-home'

export const metadata: Metadata = { title: 'Home | CoLearner' }
export default function LearnHomePage() { return <LearnHomeScreen /> }
