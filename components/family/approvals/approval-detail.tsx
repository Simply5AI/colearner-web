'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Card, LoadingState } from '@/components/design-system'
import { decisionLabel, kindLabel, type ApprovalRequest } from '@/lib/api/family-approvals'
import { FamilyFrame } from '../family-common'
import { ApprovalActions, outcomeNotice } from './approval-actions'
import { classText, consequence, formatDate, requesterText } from './approval-format'
import { Disclosure, StatePill } from './approval-parts'
import { ApprovalsFailure } from './approvals-states'
import { useApprovalDetail, type DecisionOutcome } from './use-approvals'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card className="space-y-2"><h2 className="text-lg font-extrabold">{title}</h2>{children}</Card>
}

function Body({ request, onOutcome }: { request: ApprovalRequest; onOutcome: (outcome: DecisionOutcome) => void }) {
  return <div className="space-y-5" data-testid="approval-detail" data-state={request.state}>
    <div className="flex flex-wrap items-center gap-3"><StatePill state={request.state} /><span className="text-sm text-muted-foreground">Asked on {formatDate(request.requestedAt)}</span></div>
    <Section title="Who"><p>For <strong>{request.child.nickname}</strong>{request.school ? ` at ${request.school.name}` : ''}. Asked by {requesterText(request)}.</p></Section>
    <Section title="What">
      <p className="break-words font-bold">{request.plan.title}</p>
      <p className="text-sm text-muted-foreground">{[classText(request), `${request.plan.topicCount} ${request.plan.topicCount === 1 ? 'topic' : 'topics'}`, request.plan.dueAt ? `due ${formatDate(request.plan.dueAt)}` : null].filter(Boolean).join(' · ')}</p>
    </Section>
    <Section title="Why you are being asked"><p>{kindLabel[request.kind]}. Because {request.child.nickname} is under 18, the plan stays closed until a verified guardian says yes.</p></Section>
    <Section title="Your child’s privacy"><Disclosure request={request} /></Section>
    <Section title="What changes">
      {request.state === 'PENDING' ? <ul className="list-disc space-y-1 ps-5"><li><strong>If you approve:</strong> {consequence.APPROVE(request)}</li><li><strong>If you decline:</strong> {consequence.DECLINE(request)}</li></ul>
        : request.state === 'APPROVED' ? <p>{consequence.REVOKE(request)}</p>
          : request.state === 'SUPERSEDED' ? <p>The teacher or school took this request back before it was decided. Nothing is needed from you and nothing changed for {request.child.nickname}.</p>
            : <p>{request.child.nickname} does not have access to this plan. To change that, the teacher or school must send a new request.</p>}
    </Section>
    <Section title="Decision history">
      {request.history.length === 0 ? <p className="text-sm text-muted-foreground">No decision has been recorded yet.</p>
        : <ol className="space-y-1" data-testid="approval-history">{request.history.map((entry, index) => <li key={`${entry.at}-${index}`}>{decisionLabel[entry.decision]} by {entry.by} on {formatDate(entry.at)}</li>)}</ol>}
    </Section>
    <div className="space-y-3"><ApprovalActions request={request} onOutcome={onOutcome} /></div>
  </div>
}

export function ApprovalDetail({ requestId }: { requestId: string }) {
  const detail = useApprovalDetail(requestId)
  const [notice, setNotice] = useState<string | null>(null)
  return <FamilyFrame title={detail.data?.plan.title ?? 'Request details'} description="Who is asking, what for, why, and what changes if you approve or decline.">
    <nav aria-label="Approvals"><Link href="/family/approvals" className="ds-button ds-button-ghost">Back to approvals</Link></nav>
    <div aria-live="polite">{notice && <p role="status" className="break-words rounded-2xl bg-accent/40 p-4" data-testid="approval-notice">{notice}</p>}</div>
    {detail.isPending ? <LoadingState label="Loading request…" />
      : detail.error ? <ApprovalsFailure error={detail.error} retry={() => void detail.refetch()} />
        : <Body request={detail.data} onOutcome={outcome => setNotice(outcomeNotice(outcome))} />}
  </FamilyFrame>
}
