'use client'
import { Card } from '@/components/design-system'
import { decisionLabel, type ApprovalRequest } from '@/lib/api/family-approvals'
import { ApprovalActions } from './approval-actions'
import { classText, formatDate, requesterText } from './approval-format'
import { DetailLink, Disclosure, StatePill } from './approval-parts'
import type { DecisionOutcome } from './use-approvals'

export function ApprovalCard({ request, onOutcome }: { request: ApprovalRequest; onOutcome: (outcome: DecisionOutcome) => void }) {
  const decided = request.decision
  const pending = request.state === 'PENDING'
  return <Card className="space-y-4" data-testid="approval-card" data-request-id={request.id} data-state={request.state}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h2 className="break-words text-xl font-extrabold">{request.plan.title}</h2>
        <p className="text-sm text-muted-foreground">For <strong className="text-foreground">{request.child.nickname}</strong>{request.school ? ` · ${request.school.name}` : ''}</p>
      </div>
      <StatePill state={request.state} />
    </div>
    <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
      {classText(request) && <div><dt className="inline text-muted-foreground">Class: </dt><dd className="inline">{classText(request)}</dd></div>}
      <div><dt className="inline text-muted-foreground">Asked by: </dt><dd className="inline">{requesterText(request)}</dd></div>
      <div><dt className="inline text-muted-foreground">Asked on: </dt><dd className="inline">{formatDate(request.requestedAt)}</dd></div>
      <div><dt className="inline text-muted-foreground">Topics: </dt><dd className="inline">{request.plan.topicCount}</dd></div>
      {request.plan.dueAt && <div><dt className="inline text-muted-foreground">Due: </dt><dd className="inline">{formatDate(request.plan.dueAt)}</dd></div>}
    </dl>
    {pending && <Disclosure request={request} />}
    {decided && <p className="text-sm" data-testid="approval-decision">{decisionLabel[decided.decision]} by {decided.by} on {formatDate(decided.at)}.</p>}
    {request.state === 'SUPERSEDED' && <p className="text-sm" role="note">The teacher or school took this request back before anyone decided. Nothing is needed from you.</p>}
    <div className="flex flex-wrap items-center gap-3"><ApprovalActions request={request} onOutcome={onOutcome} /><DetailLink request={request} /></div>
  </Card>
}
