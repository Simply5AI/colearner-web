import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LearnPlanScreen } from '@/components/learn/learn-plan'
import { TutorPlanScreen } from '@/components/tutor-loop/learn/tutor-plan-screen'
import { tutorLoopReady } from '@/components/tutor-loop/shell/eligibility'

export const metadata: Metadata = { title: 'Plan | CoLearner' }
export default async function LearnPlanPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(planId)) notFound()
  return (await tutorLoopReady()) ? <TutorPlanScreen planId={planId} /> : <LearnPlanScreen planId={planId} />
}
