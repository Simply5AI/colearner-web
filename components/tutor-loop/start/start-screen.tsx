'use client'

import { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { grantConsent } from '@/app/(tutor-start)/learn/start/actions'
import type { TutorEntry, TutorWorkspace } from '@/lib/api/tutor-loop/entry'
import { setTutorWorkspaceScope } from '@/lib/api/tutor-loop/client'
import { GoalSetup } from './goal-setup'
import { primaryButton as primary, TutorArt, TutorStartFrame } from './start-frame'

export { TutorStartFrame }

export function TutorStartScreen({ entry, name, requestId, startGoal }: {
  entry: TutorEntry; name: string | null; requestId: string; startGoal: boolean
}) {
  const adult = entry.scope === 'PERSONAL'
  const workspace: TutorWorkspace = adult ? 'personal' : 'school'
  const entryUrl = adult ? '/learn/start?scope=personal' : '/learn/start'
  const goalUrl = entryUrl + (adult ? '&' : '?') + 'step=goal'
  const icon = entry.tutorIdentity?.icon ?? (adult ? 'BUDDY' : 'SPROUT')
  const close = adult ? '/workspaces' : '/learner'
  const [consent, consentAction, consenting] = useActionState(grantConsent, {})
  useEffect(() => { setTutorWorkspaceScope(workspace) }, [workspace])
  if (entry.needsConsent) {
    return (
      <TutorStartFrame adult close={close}>
        <main className="grid flex-1 place-items-center px-5 pb-24 pt-10">
          <form action={consentAction} className="flex w-full max-w-[440px] flex-col items-center gap-[18px] text-center">
            <TutorArt icon={icon} size={128} />
            <h1>Start your learning space</h1>
            <p className="text-muted-foreground">CoLearner saves your goals and progress in your personal learning space.</p>
            <input type="hidden" name="requestId" value={requestId} />
            <label className="flex items-start gap-3 text-start">
              <input type="checkbox" name="accept" value="yes" required className="mt-1 size-4 accent-primary" />
              <span>I agree to save my goals and progress in this workspace.</span>
            </label>
            {consent.error && <p role="alert" className="text-destructive">{consent.error}</p>}
            <button type="submit" disabled={consenting} className={primary}>{consenting ? 'Saving…' : 'Continue'}</button>
          </form>
        </main>
      </TutorStartFrame>
    )
  }

  if (startGoal) {
    return <GoalSetup adult={adult} icon={icon} requestId={requestId} workspace={workspace} entryUrl={entryUrl} />
  }

  const continueUrl = adult || entry.needsOnboarding ? goalUrl : '/learn/home'
  return (
    <TutorStartFrame adult={adult}>
      <main className="grid flex-1 place-items-center px-5 pb-[120px] pt-10">
        <div className="flex w-full max-w-[440px] flex-col items-center gap-[18px] text-center">
          <TutorArt icon={icon} size={128} />
          <h1 className="font-extrabold leading-[1.1]">{name ? `Welcome back, ${name}` : 'Welcome to CoLearner'}</h1>
          <p className="text-lg text-muted-foreground">
            {entry.needsOnboarding ? 'Set a goal for what you want to learn.' : 'Pick up where you left off.'}
          </p>
          <Link href={continueUrl} className={primary}>Continue</Link>
          {continueUrl !== goalUrl && <Link href={goalUrl} className="ds-button ds-button-ghost text-primary">I’m new · set my goal</Link>}
        </div>
      </main>
    </TutorStartFrame>
  )
}
