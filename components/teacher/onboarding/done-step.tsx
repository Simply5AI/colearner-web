'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button, CoCharacter } from '@/components/design-system'
import { useTeaching } from '@/components/teacher/teaching-context'
import { classifyTeachingError } from '@/lib/api/teaching/core'
import { completeOnboarding, doneCopy, type TeacherOnboardingState } from '@/lib/api/teaching/onboarding'

export function DoneStep({
  state,
  onCompleted,
}: {
  state: TeacherOnboardingState
  onCompleted: (state: TeacherOnboardingState, nextRoute: string) => void
}) {
  const { request } = useTeaching()
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [nextRoute, setNextRoute] = useState<string | null>(null)
  // Copy follows the server's studentVisibility, never what we hoped happened.
  const copy = doneCopy(state)
  const finish = async () => {
    setBusy(true)
    setFailure(null)
    try {
      const result = await completeOnboarding(request, state)
      setNextRoute(result.nextRoute)
      onCompleted(result.state, result.nextRoute)
    } catch (error) {
      setFailure(classifyTeachingError(error).message)
    } finally {
      setBusy(false)
    }
  }
  const target = nextRoute ?? (state.completed ? (state.firstPlan ? `/teacher/plans/${encodeURIComponent(state.firstPlan.planId)}` : '/teacher/dashboard') : null)
  return (
    <div className="space-y-4 text-center" data-testid="t8-done" data-visibility={state.firstPlan?.studentVisibility ?? 'NONE'}>
      <div className="flex justify-center"><CoCharacter band="adults" state={state.firstPlan?.studentVisibility === 'ASSIGNED' ? 'celebrating' : 'encouraging'} size={72} decorative /></div>
      <h3 data-testid="t8-done-title" className="text-xl font-extrabold">{copy.title}</h3>
      <p data-testid="t8-done-body" className="mx-auto max-w-prose text-sm text-muted-foreground">{copy.body}</p>
      {failure && <p role="alert" className="text-sm font-semibold text-destructive">{failure} Nothing was lost; try again.</p>}
      {state.completed || nextRoute ? (
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/teacher/dashboard" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground">Go to dashboard</Link>
          {target && target !== '/teacher/dashboard' && <Link href={target} className="inline-flex min-h-11 items-center rounded-xl border border-border px-5 font-semibold">Open your plan</Link>}
        </div>
      ) : (
        <Button onClick={() => void finish()} loading={busy}>Finish setup</Button>
      )}
    </div>
  )
}
