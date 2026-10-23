'use client'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { Button } from '@/components/design-system'
import { decisionLabel, type ApprovalIntent, type ApprovalRequest } from '@/lib/api/family-approvals'
import { consequence, formatDate } from './approval-format'
import { approvalsKey, useDecision, type DecisionOutcome } from './use-approvals'

const confirmCopy: Record<ApprovalIntent, { title: (r: ApprovalRequest) => string; button: string }> = {
  APPROVE: { title: r => `Approve “${r.plan.title}” for ${r.child.nickname}?`, button: 'Yes, approve' },
  DECLINE: { title: r => `Decline “${r.plan.title}” for ${r.child.nickname}?`, button: 'Yes, decline' },
  REVOKE: { title: r => `Remove ${r.child.nickname}’s access to “${r.plan.title}”?`, button: 'Yes, remove access now' },
}
const triggerLabel: Record<ApprovalIntent, string> = { APPROVE: 'Approve', DECLINE: 'Decline', REVOKE: 'Remove access' }

export function outcomeNotice(outcome: DecisionOutcome) {
  const { request } = outcome
  const decided = request.decision
  if (outcome.alreadyDecided) return `This request was already decided${decided ? `: ${decisionLabel[decided.decision].toLowerCase()} by ${decided.by} on ${formatDate(decided.at)}` : ''}. Nothing was changed by your press.`
  const base = outcome.intent === 'APPROVE' ? `Approved. ${request.child.nickname} can now open “${request.plan.title}”.`
    : outcome.intent === 'DECLINE' ? `Declined. ${request.child.nickname} will not get “${request.plan.title}”.`
      : `Access removed. ${request.child.nickname} can no longer open “${request.plan.title}”.`
  return outcome.replayed ? `${base} (This had already been recorded; nothing changed again.)` : base
}

/**
 * Approve / Decline for a pending request, Revoke for an active one, each behind a confirmation. Buttons come only from
 * the server's `actions`; when none is allowed the server's reason is shown. A failed send keeps the dialog open and
 * "Try again" reuses the same Idempotency-Key.
 */
export function ApprovalActions({ request, onOutcome }: { request: ApprovalRequest; onOutcome: (outcome: DecisionOutcome) => void }) {
  const [intent, setIntent] = useState<ApprovalIntent | null>(null)
  const decision = useDecision()
  const client = useQueryClient()
  const allowed: ApprovalIntent[] = [request.actions.canApprove && 'APPROVE', request.actions.canDecline && 'DECLINE', request.actions.canRevoke && 'REVOKE'].filter(Boolean) as ApprovalIntent[]
  const close = () => { if (decision.isPending) return; const refused = decision.isError; setIntent(null); decision.reset(); if (refused) void client.invalidateQueries({ queryKey: approvalsKey }) }
  const confirm = () => {
    if (!intent || decision.isPending) return
    decision.mutate({ id: request.id, intent }, { onSuccess: outcome => { setIntent(null); onOutcome(outcome); decision.reset() } })
  }
  if (allowed.length === 0) return request.actions.reason && request.state !== 'SUPERSEDED' ? <p className="text-sm text-muted-foreground" data-testid="approval-reason">{request.actions.reason}</p> : null
  const error = decision.error
  return <>
    <div className="flex flex-wrap gap-3">
      {allowed.map(item => <Button key={item} variant={item === 'APPROVE' ? 'primary' : 'secondary'} onClick={() => setIntent(item)} aria-label={`${triggerLabel[item]} ${request.plan.title} for ${request.child.nickname}`}>{triggerLabel[item]}</Button>)}
    </div>
    <Dialog.Root open={intent !== null} onOpenChange={open => { if (!open) close() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/40" />
        <Dialog.Popup data-age-band="tweens" data-testid="approval-confirm" initialFocus={true} finalFocus={true} className="fixed start-1/2 top-1/2 z-50 w-[min(30rem,92vw)] -translate-x-1/2 -translate-y-1/2 space-y-5 overflow-y-auto rounded-[var(--radius,18px)] border border-border bg-card p-6 shadow-xl outline-none rtl:translate-x-1/2" style={{ maxHeight: '90dvh' }}>
          {intent && <>
            <div className="flex items-start justify-between gap-3">
              <Dialog.Title className="break-words text-xl font-extrabold">{confirmCopy[intent].title(request)}</Dialog.Title>
              <Dialog.Close aria-label="Close" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"><X aria-hidden="true" className="size-5" /></Dialog.Close>
            </div>
            <Dialog.Description className="break-words leading-relaxed">{consequence[intent](request)}</Dialog.Description>
            <div aria-live="polite">
              {error && <p role="alert" className="break-words rounded-2xl border border-destructive/30 bg-destructive/5 p-4" data-testid="approval-error">{error.message}{error.status >= 500 || error.status === 0 ? ' Your choice was not recorded. Trying again is safe: it will not decide twice.' : ''}</p>}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant={intent === 'APPROVE' ? 'primary' : 'secondary'} loading={decision.isPending} onClick={confirm}>{error ? 'Try again' : confirmCopy[intent].button}</Button>
              <Button variant="ghost" disabled={decision.isPending} onClick={close}>Cancel</Button>
            </div>
          </>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </>
}
