'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button, CoCharacter, LoadingState } from '@/components/design-system'
import { TeacherPage } from '@/components/teacher/teacher-page'
import { useTeaching, useTeachingResource } from '@/components/teacher/teaching-context'
import { TeachingFailurePanel } from '@/components/teacher/dashboard/failure-panel'
import { classifyTeachingError } from '@/lib/api/teaching/core'
import {
  ONBOARDING_STEPS,
  parseOnboardingState,
  resolveViewedStep,
  saveOnboarding,
  skipOnboardingStep,
  stepIndex,
  type TeacherOnboardingState,
  type TeacherOnboardingStep,
} from '@/lib/api/teaching/onboarding'
import { DoneStep } from './done-step'
import { FirstPlanStep } from './first-plan-step'
import { InviteStep } from './invite-step'
import { MaterialStep } from './material-step'
import { ProfileStep } from './profile-step'
import { cn } from '@/lib/utils'

const STEP_COPY: Record<TeacherOnboardingStep, { label: string; title: string; tip: string }> = {
  PROFILE: { label: 'Profile', title: 'Tell us about you', tip: 'Tip: your name is what your students see on their plans.' },
  FIRST_PLAN: { label: 'First plan', title: 'Create your first plan', tip: 'Tip: start small. You can add topics and lessons any time.' },
  MATERIAL: { label: 'Material', title: 'Add material', tip: 'Tip: one good page or link is enough to begin.' },
  INVITE: { label: 'Students', title: 'Bring in your students', tip: 'Tip: students under 18 appear once a guardian approves.' },
  DONE: { label: 'Done', title: 'All set', tip: 'Tip: you can change everything later from your plans.' },
}

export function TeacherOnboardingView() {
  const { resource, reload, setData } = useTeachingResource('/onboarding', parseOnboardingState)
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const { request } = useTeaching()
  // The URL only seeds and mirrors the step; local state drives the view so a refresh resumes where the server says.
  const [requested, setRequested] = useState<string | null>(params.get('step'))
  const [skipBusy, setSkipBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  if (resource.status === 'loading') {
    return <TeacherPage title="Set up your classroom"><div data-testid="t8-loading"><LoadingState label="Loading your setup…" /></div></TeacherPage>
  }
  if (resource.status === 'error') {
    return <TeacherPage title="Set up your classroom"><TeachingFailurePanel kind={resource.kind} message={resource.message} onRetry={reload} testId="t8-failure" /></TeacherPage>
  }

  const state: TeacherOnboardingState = resource.data
  const viewed = resolveViewedStep(state.step, requested)
  const go = (step: TeacherOnboardingStep) => {
    setActionError(null)
    setRequested(step.toLowerCase())
    router.replace(`${pathname}?step=${step.toLowerCase()}`, { scroll: false })
  }
  const accept = (next: TeacherOnboardingState) => {
    setData(next)
    setRequested(next.step.toLowerCase())
    router.replace(`${pathname}?step=${next.step.toLowerCase()}`, { scroll: false })
  }
  const skip = async (step: 'MATERIAL' | 'INVITE') => {
    setSkipBusy(true)
    setActionError(null)
    try {
      accept(await skipOnboardingStep(request, state, step))
    } catch (error) {
      setActionError(classifyTeachingError(error).message)
    } finally {
      setSkipBusy(false)
    }
  }
  const advanceToDone = async () => {
    setSkipBusy(true)
    setActionError(null)
    try {
      accept(await saveOnboarding(request, state, { step: 'DONE' }))
    } catch (error) {
      setActionError(classifyTeachingError(error).message)
    } finally {
      setSkipBusy(false)
    }
  }
  const copy = STEP_COPY[viewed]
  const canSkip = (viewed === 'MATERIAL' || viewed === 'INVITE') && state.skippable[viewed] && stepIndex(state.step) <= stepIndex(viewed)

  return (
    <TeacherPage title="Set up your classroom" subtitle="Five short steps. You can stop and pick up where you left off.">
      <div data-testid="t8-root" data-step={viewed} className="mx-auto max-w-3xl space-y-5">
        <ol aria-label="Setup progress" data-testid="t8-progress" className="flex flex-wrap gap-2">
          {ONBOARDING_STEPS.map((step, index) => {
            const reached = index <= stepIndex(state.step)
            const done = index < stepIndex(state.step) || state.completed
            const current = step === viewed
            return (
              <li key={step} className="min-w-0 flex-1 basis-24">
                <button
                  type="button"
                  disabled={!reached}
                  aria-current={current ? 'step' : undefined}
                  onClick={() => go(step)}
                  className={cn('flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 py-2 text-start text-sm font-semibold', current ? 'border-primary bg-primary/10' : 'border-border', !reached && 'cursor-not-allowed text-muted-foreground')}
                >
                  <span aria-hidden="true" className={cn('flex size-6 shrink-0 items-center justify-center rounded-full border text-xs', done && 'border-primary bg-primary text-primary-foreground')}>
                    {done ? <Check className="size-3.5" /> : index + 1}
                  </span>
                  <span className="min-w-0 break-words">{STEP_COPY[step].label}</span>
                  <span className="sr-only">{done ? ', done' : current ? ', current step' : !reached ? ', locked' : ''}</span>
                </button>
              </li>
            )
          })}
        </ol>

        {state.skipped.length > 0 && (
          <p data-testid="t8-skipped" className="text-xs text-muted-foreground">Skipped for later: {state.skipped.map((s) => STEP_COPY[s].label.toLowerCase()).join(', ')}. You can do these from your plans.</p>
        )}
        {state.activation.note && state.activation.classesAssigned === 0 && viewed !== 'FIRST_PLAN' && (
          <p data-testid="t8-activation-note" className="rounded-xl border border-dashed border-border p-3 text-sm">{state.activation.note}</p>
        )}

        <section aria-labelledby="t8-step-title" className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <CoCharacter band="adults" state="idle" size={36} decorative />
            <div className="min-w-0">
              <h2 id="t8-step-title" className="text-xl font-extrabold">{copy.title}</h2>
              <p data-testid="t8-tip" className="text-sm text-muted-foreground">{copy.tip}</p>
            </div>
          </div>
          <div className="mt-5">
            {viewed === 'PROFILE' && <ProfileStep state={state} onSaved={accept} onRefresh={reload} />}
            {viewed === 'FIRST_PLAN' && <FirstPlanStep state={state} onCreated={reload} onAdvanced={accept} />}
            {viewed === 'MATERIAL' && <MaterialStep state={state} onAdvanced={accept} onRefresh={reload} />}
            {viewed === 'INVITE' && <InviteStep state={state} onAssigned={reload} />}
            {viewed === 'DONE' && <DoneStep state={state} onCompleted={(next) => setData(next)} />}
          </div>
          {actionError && <p role="alert" data-testid="t8-action-error" className="mt-4 text-sm font-semibold text-destructive">{actionError}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {canSkip && <Button variant="ghost" onClick={() => void skip(viewed as 'MATERIAL' | 'INVITE')} loading={skipBusy} data-testid="t8-skip">Skip for later</Button>}
            {viewed === 'INVITE' && stepIndex(state.step) <= stepIndex('INVITE') && state.firstPlan && (
              <Button variant="secondary" onClick={() => void advanceToDone()} loading={skipBusy} data-testid="t8-to-done">Continue to finish</Button>
            )}
          </div>
        </section>
      </div>
    </TeacherPage>
  )
}
