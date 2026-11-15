'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { AgeBandScope } from '@/components/design-system'
import { LearnPlanScreen } from '@/components/learn/learn-plan'
import { getTutorWorkspaceScope, tutorLoopClient } from '@/lib/api/tutor-loop/client'
import { useTutorShell } from '@/components/tutor-loop/shell/tutor-shell-context'
import { MyPlan } from './my-plan'

/**
 * /learn/plans/:planId for eligible learners. A plan the learner made opens here with its topic actions; a teacher's plan
 * (and any id the tutor API does not know) keeps the existing plan page with its teacher controls and links.
 */
export function TutorPlanScreen({ planId }: { planId: string }) {
  const shell = useTutorShell()
  const workspace = getTutorWorkspaceScope()
  const query = useQuery({ queryKey: ['tutor-plan', workspace, planId], queryFn: () => tutorLoopClient.plan(planId, null, { workspace }), retry: false })
  if (query.isPending) return <div role="status" aria-label="Loading your plan" className="mx-auto max-w-[1000px] space-y-3 p-6"><div className="h-28 animate-pulse rounded-2xl bg-muted" /><div className="h-48 animate-pulse rounded-2xl bg-muted" /></div>
  if (query.isError || query.data.ownership !== 'OWN') return <LearnPlanScreen planId={planId} />
  return <AgeBandScope band={shell.band} className="mx-auto w-full max-w-[1000px] space-y-4 px-4 pb-24 pt-6 sm:px-6">
    <Link href="/learn?tab=plan" className="inline-flex min-h-11 items-center gap-2 font-bold"><ArrowLeft aria-hidden="true" className="size-4 rtl:rotate-180" />Back to Learn</Link>
    <MyPlan goalId={null} planId={planId} />
  </AgeBandScope>
}
