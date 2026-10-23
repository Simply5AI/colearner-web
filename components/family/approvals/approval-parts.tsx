import Link from 'next/link'
import { stateLabel, type ApprovalRequest } from '@/lib/api/family-approvals'
import { cn } from '@/lib/utils'

export function StatePill({ state }: { state: ApprovalRequest['state'] }) {
  return <span data-testid="approval-state" data-state={state} className={cn('ds-pill', state === 'PENDING' && 'font-bold')}>{stateLabel[state]}</span>
}

export function Disclosure({ request }: { request: ApprovalRequest }) {
  const { teacherSees, teacherDoesNotSee } = request.disclosure
  return <div className="grid gap-4 sm:grid-cols-2" data-testid="approval-disclosure">
    <section aria-label="What the teacher will see"><h3 className="font-bold">What the teacher will see</h3><ul className="mt-1 list-disc space-y-1 ps-5 text-sm">{teacherSees.map(line => <li key={line} className="break-words">{line}</li>)}</ul></section>
    <section aria-label="What the teacher will not see"><h3 className="font-bold">What the teacher will not see</h3><ul className="mt-1 list-disc space-y-1 ps-5 text-sm">{teacherDoesNotSee.map(line => <li key={line} className="break-words">{line}</li>)}</ul></section>
  </div>
}

export function DetailLink({ request }: { request: ApprovalRequest }) {
  return <Link href={`/family/approvals/${encodeURIComponent(request.id)}`} className="ds-button ds-button-ghost" aria-label={`See details for ${request.plan.title}, ${request.child.nickname}`}>See details</Link>
}
