'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AssignClassPanel } from '@/components/teacher/plans/assign-class-panel'
import type { TeacherOnboardingState } from '@/lib/api/teaching/onboarding'

type AssignedHandler = React.ComponentProps<typeof AssignClassPanel>['onAssigned']

export function InviteStep({
  state,
  onAssigned,
}: {
  state: TeacherOnboardingState
  /** Called only after the server accepted the assignment; the screen reloads the truthful state. */
  onAssigned: () => void
}) {
  const plan = state.firstPlan
  const [summary, setSummary] = useState<string | null>(null)
  const handle: AssignedHandler = (assignment) => {
    setSummary(`Assigned to ${assignment.classLabel}: ${assignment.roster.enrolledActive} active, ${assignment.roster.pendingGuardian} waiting for guardian approval.`)
    onAssigned()
  }
  return (
    <div className="space-y-4" data-testid="t8-invite">
      {!plan ? (
        <p data-testid="t8-invite-needs-plan" className="text-sm text-muted-foreground">Create your first plan first.</p>
      ) : plan.status !== 'PUBLISHED' ? (
        <div data-testid="t8-invite-needs-publish" className="rounded-xl border border-dashed border-border p-4 text-sm">
          <p className="font-semibold">Publish your plan before assigning it.</p>
          <p className="mt-1 text-muted-foreground">Students can only be given a published plan. Publishing happens in the plan editor; come back here afterwards.</p>
          <Link href={`/teacher/plans/${encodeURIComponent(plan.planId)}`} className="mt-2 inline-block font-semibold text-primary underline">Open the plan editor</Link>
        </div>
      ) : !state.assign.available ? (
        <p data-testid="t8-invite-unavailable" className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          {state.assign.reason ?? 'Assigning to a class is not available right now.'}
        </p>
      ) : (
        <>
          {state.assign.rosterCount !== null && (
            <p data-testid="t8-roster-count" className="text-sm text-muted-foreground">Your class roster has {state.assign.rosterCount} students.</p>
          )}
          <AssignClassPanel planId={plan.planId} onAssigned={handle} />
          {summary && <p role="status" data-testid="t8-assign-summary" className="rounded-xl border border-border bg-muted/40 p-3 text-sm font-semibold">{summary}</p>}
        </>
      )}
      <p data-testid="t8-invite-later" className="text-sm text-muted-foreground">
        Invite codes, links and QR codes arrive in a later release. {state.invite.reason}
      </p>
    </div>
  )
}
