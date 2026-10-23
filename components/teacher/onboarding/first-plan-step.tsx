'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/design-system'
import { NewPlanOptions } from '@/components/teacher/plans/new-plan-options'
import { useTeaching } from '@/components/teacher/teaching-context'
import { classifyTeachingError } from '@/lib/api/teaching/core'
import { saveOnboarding, type TeacherOnboardingState } from '@/lib/api/teaching/onboarding'

const STATUS_LABEL = { DRAFT: 'Draft', PUBLISHED: 'Published', ARCHIVED: 'Archived' } as const

export function FirstPlanStep({
  state,
  onCreated,
  onAdvanced,
}: {
  state: TeacherOnboardingState
  /** The plan exists on the server now; reload the onboarding state to learn its id and status. */
  onCreated: () => void
  onAdvanced: (state: TeacherOnboardingState) => void
}) {
  const { request } = useTeaching()
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const plan = state.firstPlan

  if (!plan) {
    if (state.activation.classesAssigned === 0) {
      return (
        <div data-testid="t8-no-class" className="rounded-xl border border-dashed border-border p-4 text-sm">
          <p className="font-semibold">No class is assigned to you yet.</p>
          <p className="mt-1 text-muted-foreground">{state.activation.note ?? 'Ask your school administrator to assign you to a class and subject. Your profile is saved.'}</p>
        </div>
      )
    }
    return (
      <div data-testid="t8-first-plan-create">
        <NewPlanOptions onCreated={() => onCreated()} />
      </div>
    )
  }

  const next = async () => {
    setBusy(true)
    setFailure(null)
    try {
      onAdvanced(await saveOnboarding(request, state, { step: 'MATERIAL' }))
    } catch (error) {
      setFailure(classifyTeachingError(error).message)
      onCreated()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4" data-testid="t8-first-plan-saved">
      <div className="rounded-xl border border-border bg-background p-4">
        <p className="text-xs font-bold text-muted-foreground">Your first plan · Written by you</p>
        <p className="mt-1 text-lg font-extrabold break-words">{plan.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {STATUS_LABEL[plan.status]}.{' '}
          {plan.status === 'DRAFT' ? 'Students cannot see it until you publish and assign it.' : 'Published plans keep their structure; you can still add material and lessons.'}
        </p>
        <Link href={`/teacher/plans/${encodeURIComponent(plan.planId)}`} className="mt-2 inline-block text-sm font-semibold text-primary underline">
          Open the plan editor
        </Link>
      </div>
      {failure && <p role="alert" className="text-sm font-semibold text-destructive">{failure}</p>}
      <Button onClick={() => void next()} loading={busy}>Continue</Button>
    </div>
  )
}
