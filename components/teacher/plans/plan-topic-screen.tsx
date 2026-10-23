'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isDenied, teachingErrorText } from '@/lib/api/teaching/plans'
import { InlineAlert, LoadingBlock } from './fields'
import { PlanStatusChip } from './plan-status-chip'
import { TopicWorkspacePane } from './topic-workspace'
import { usePlanQuery } from './use-teaching-apis'

/** `/teacher/plans/:planId/topics/:topicId`: the topic workspace on its own page (materials, lesson, student preview). */
export function PlanTopicScreen({ planId, topicId }: { planId: string; topicId: string }) {
  const plan = usePlanQuery(planId)
  if (plan.isPending) return <LoadingBlock label="Loading the topic" />
  if (plan.error) {
    return <div className="space-y-3" data-testid="topic-page-error">
      <InlineAlert>{isDenied(plan.error) ? 'This plan was not found, or you no longer have access to it.' : teachingErrorText(plan.error)}</InlineAlert>
      {!isDenied(plan.error) && <Button variant="outline" onClick={() => void plan.refetch()}>Retry</Button>}
    </div>
  }
  return <div className="space-y-5" data-testid="topic-page">
    <div className="flex flex-wrap items-center gap-3">
      <Button asChild variant="ghost" size="lg" className="-ms-2"><Link href={`/teacher/plans/${encodeURIComponent(planId)}?topic=${encodeURIComponent(topicId)}`}><ArrowLeft aria-hidden="true" className="rtl:rotate-180" />Back to {plan.data.title}</Link></Button>
      <PlanStatusChip status={plan.data.status} />
    </div>
    <div className="rounded-xl border border-border bg-card p-4"><TopicWorkspacePane key={topicId} planId={planId} topicId={topicId} targetBand={plan.data.scope.targetBand} /></div>
  </div>
}
