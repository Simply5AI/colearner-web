'use client'

import Link from 'next/link'
import { useEffect, useRef, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Circle, CircleDot } from 'lucide-react'
import { Button, Card, CoCharacter, type CoState } from '@/components/design-system'
import { cn } from '@/lib/utils'
import type { LearnBand } from '@/lib/api/learn'
import { learnLinkApi, type LearnerLinkStatus, type LinkStage, type LinkWaitingOn } from '@/lib/api/learn-link'
import { LearnFrame, LearnLoadError, LearnSkeleton, useLearnIdentity } from './learn-common'

/* ---------- data ---------- */

export const learnLinkKey = (actor: string) => ['learn', actor, 'link-status'] as const
/** Always read fresh: the school or a grown-up may have just finished their part. */
export function useLearnLinkStatus() {
  const { actor } = useLearnIdentity()
  return useQuery({ queryKey: learnLinkKey(actor), queryFn: learnLinkApi.status, enabled: !!actor, retry: false, staleTime: 0, gcTime: 0, refetchOnMount: 'always' })
}

/* ---------- wording (one voice per band, no jargon, no guardian details) ---------- */

type ByBand = Record<LearnBand, string>
/** The grown-up word each band understands. Never an email, a name or any other detail. */
const grownUp: ByBand = { kids: 'grown-up', tweens: 'parent', teens: 'parent or guardian' }
const capitalised = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

interface StageCopy { co: CoState; title: ByBand; body: ByBand; next: ByBand; nobody?: string }
const stageCopy: Record<LinkStage, StageCopy> = {
  READY: {
    co: 'celebrating',
    title: { kids: 'You are all set!', tweens: 'You are all set', teens: 'Your account is ready' },
    body: {
      kids: 'Your school and your grown-up both said yes. Co is ready to learn with you!',
      tweens: 'Your school and your parent have both said yes. You can start learning with Co now.',
      teens: 'Your school and your parent or guardian have finished setting up your account. You can start learning now.',
    },
    next: { kids: 'Press the button to start.', tweens: 'Press the button to go to your Home page.', teens: 'Head to Home to pick up where you want to start.' },
    nobody: 'Nobody. You are all set.',
  },
  NEEDS_ROSTER_LINK: {
    co: 'encouraging',
    title: { kids: 'Your school needs to find you', tweens: 'Your school needs to find you', teens: 'Your school has not matched your account yet' },
    body: {
      kids: 'Your school has not matched this sign-in to your name on the class list yet. Learning stays locked until it does.',
      tweens: 'Your school has not matched this sign-in to your name on the class list yet. Learning stays locked until it does.',
      teens: 'Your school has not linked this account to your place on its student list yet. Learning stays locked until it does.',
    },
    next: {
      kids: 'Tell your teacher or the school office. They will do the rest.',
      tweens: 'Tell your teacher or the school office that you are waiting. They take care of this step.',
      teens: 'Ask your teacher or the school office to link your account. You cannot do this step yourself, and there is nothing to enter here.',
    },
  },
  NEEDS_GUARDIAN: {
    co: 'encouraging',
    title: { kids: 'Your school will ask your grown-up', tweens: 'Your school will ask your parent', teens: 'Your school still needs to invite your parent or guardian' },
    body: {
      kids: 'A grown-up has to say yes before you can learn here. Your school has not asked yours yet.',
      tweens: 'A parent has to say yes before you can learn here. Your school has not sent them an invitation yet.',
      teens: 'A parent or guardian has to give consent before you can learn here. Your school has not sent them an invitation yet.',
    },
    next: {
      kids: 'Tell your teacher that you are waiting. The school will ask your grown-up.',
      tweens: 'Tell your teacher or the school office that you are waiting. The school sends the invitation.',
      teens: 'Ask your school to send the invitation. The school does this securely, so there is nothing to enter here.',
    },
  },
  NEEDS_GUARDIAN_CONSENT: {
    co: 'curious',
    title: { kids: 'Your grown-up needs to say yes', tweens: 'Your parent needs to say yes', teens: 'Your parent or guardian needs to give consent' },
    body: {
      kids: 'Your school has asked your grown-up. Learning opens as soon as they say yes.',
      tweens: 'Your school has invited your parent. Learning opens as soon as they say yes.',
      teens: 'Your school has invited your parent or guardian. Learning opens as soon as they give consent.',
    },
    next: {
      kids: 'Ask your grown-up to open the CoLearner message from your school and say yes.',
      tweens: 'Ask your parent to open the CoLearner invitation from your school and say yes.',
      teens: 'Ask your parent or guardian to open the CoLearner invitation from your school and complete it. This page updates when they have.',
    },
  },
  PROFILE_NOT_BOUND: {
    co: 'encouraging',
    title: { kids: 'One more step for your school', tweens: 'One more step for your school', teens: 'Your school needs to connect your account' },
    body: {
      kids: 'Your grown-up said yes! Now your school has to connect this sign-in to you.',
      tweens: 'Your parent said yes! Now your school has to connect this sign-in to your learning profile.',
      teens: 'Consent is in place. The last step is for your school to connect this sign-in to your learning profile.',
    },
    next: {
      kids: 'Tell your teacher that you are ready. The school will connect you.',
      tweens: 'Tell your teacher or the school office that your parent has said yes. They connect your account.',
      teens: 'Ask your school to finish connecting your account. You cannot connect it yourself.',
    },
  },
  CONSENT_WITHDRAWN: {
    co: 'encouraging',
    title: { kids: 'Learning is paused', tweens: 'Learning is paused for now', teens: 'Learning is paused: consent is not current' },
    body: {
      kids: 'Your grown-up said no for now, or their yes needs to be renewed. So learning is paused.',
      tweens: 'Your parent turned their yes off, or it needs to be renewed. So learning is paused.',
      teens: 'Your parent or guardian withdrew consent, or it needs to be renewed. Until it is current, learning is paused.',
    },
    next: {
      kids: 'Talk with your grown-up about it.',
      tweens: 'Talk with your parent about it. They can change this from their own CoLearner account.',
      teens: 'Talk with your parent or guardian. They can review this from their own CoLearner account, and your school can help.',
    },
  },
  AGE_OUT_OF_SCOPE: {
    co: 'curious',
    title: { kids: 'Learning here is not ready for you yet', tweens: 'Learning here is not available for your age yet', teens: 'Learning here is not available for this age yet' },
    body: {
      kids: 'This part of CoLearner is not ready for your age yet.',
      tweens: 'This part of CoLearner is not available for your age yet.',
      teens: 'The school learning space does not support this age yet.',
    },
    next: { kids: 'Ask a grown-up or your teacher if you have questions.', tweens: 'Ask your teacher or school if you have questions.', teens: 'Ask your school if you have questions.' },
    nobody: 'Nothing you can do from here.',
  },
  SCHOOL_INACTIVE: {
    co: 'curious',
    title: { kids: 'Your school space is closed for now', tweens: 'Your school space is not open right now', teens: 'Your school workspace is not active' },
    body: {
      kids: 'Your school has not opened its CoLearner space right now, so learning is paused.',
      tweens: 'Your school has not opened its CoLearner space right now, so learning is paused.',
      teens: 'Your school workspace is not active right now, so learning is paused.',
    },
    next: { kids: 'Ask your teacher to find out more.', tweens: 'Ask your teacher or the school office.', teens: 'Ask your school for help.' },
  },
}

const studentNext: ByBand = {
  kids: 'You have a student login waiting. Press the button below to accept it.',
  tweens: 'You have a student login waiting. Press the button below to accept it.',
  teens: 'Your parent or guardian set up a student login for you. Accept it below to continue.',
}

/** Who has to act, in the band's own words. Derived from the server's `waitingOn`. */
export function waitingOnLabel(waitingOn: LinkWaitingOn, stage: LinkStage, band: LearnBand): string {
  switch (waitingOn) {
    case 'SCHOOL': return 'Your school'
    case 'GUARDIAN': return capitalised(`your ${grownUp[band]}`)
    case 'STUDENT': return 'You'
    default: return stageCopy[stage].nobody ?? 'Nobody needs to act right now.'
  }
}

/** The ordinary road to READY. The other stages are not steps on it, so they show no road. */
const journeyStages = ['NEEDS_ROSTER_LINK', 'NEEDS_GUARDIAN', 'NEEDS_GUARDIAN_CONSENT', 'PROFILE_NOT_BOUND', 'READY'] as const
function journeySteps(band: LearnBand): { stage: (typeof journeyStages)[number]; label: string; actor: string | null }[] {
  return [
    { stage: 'NEEDS_ROSTER_LINK', label: 'School finds your student record', actor: 'School' },
    { stage: 'NEEDS_GUARDIAN', label: `School invites your ${grownUp[band]}`, actor: 'School' },
    { stage: 'NEEDS_GUARDIAN_CONSENT', label: `Your ${grownUp[band]} says yes`, actor: capitalised(grownUp[band]) },
    { stage: 'PROFILE_NOT_BOUND', label: 'School connects your account', actor: 'School' },
    { stage: 'READY', label: 'Ready to learn', actor: null },
  ]
}

const timeFormat = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
const dateFormat = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/* ---------- view ---------- */

function Journey({ stage, band }: { stage: LinkStage; band: LearnBand }) {
  const current = journeyStages.indexOf(stage as (typeof journeyStages)[number])
  if (current < 0) return null
  const ready = stage === 'READY'
  return <section aria-labelledby="link-journey-title" data-testid="link-journey" className="space-y-3">
    <h2 id="link-journey-title" className="text-xl font-bold">Where things are</h2>
    <ol className="grid gap-3">
      {journeySteps(band).map((step, index) => {
        const status = ready || index < current ? 'done' : index === current ? 'current' : 'todo'
        const Icon = status === 'done' ? Check : status === 'current' ? CircleDot : Circle
        return <li key={step.stage} data-status={status} aria-current={status === 'current' ? 'step' : undefined}
          className={cn('flex min-w-0 items-center gap-3 rounded-[var(--radius)] border border-border bg-card p-3', status === 'current' && 'border-2 border-primary font-bold', status === 'todo' && 'text-muted-foreground')}>
          <Icon size={22} aria-hidden="true" className={cn('shrink-0', status !== 'todo' && 'text-primary')} />
          <span className="min-w-0 flex-1 break-words">{step.label}</span>
          {step.actor && <span className="ds-pill shrink-0">{step.actor}</span>}
          <span className="sr-only">{status === 'done' ? ' (done)' : status === 'current' ? ' (you are here)' : ' (next)'}</span>
        </li>
      })}
    </ol>
  </section>
}

export function LearnLinkView({ data, band, onRefresh, refreshing = false, refreshFailed = false }: { data: LearnerLinkStatus; band: LearnBand; onRefresh?: () => void; refreshing?: boolean; refreshFailed?: boolean }): ReactNode {
  const copy = stageCopy[data.stage]
  const heading = useRef<HTMLHeadingElement>(null)
  const actions = useRef<HTMLDivElement>(null)
  const restoreFocus = useRef(false)
  const invitation = data.studentLoginInvitation?.pending ? data.studentLoginInvitation : null
  const ready = data.stage === 'READY' && data.canLearn
  // Informational only: an account that never finished the age check can start it, but only while no student login is waiting.
  const showAgeCheck = !invitation && (data.stage === 'NEEDS_ROSTER_LINK' || data.stage === 'NEEDS_GUARDIAN' || data.stage === 'NEEDS_GUARDIAN_CONSENT')
  const checked = timeFormat(data.checkedAt)
  const expires = invitation?.expiresAt ? dateFormat(invitation.expiresAt) : null
  // Move focus to the heading once so keyboard and screen-reader users start at the explanation.
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])
  // The button is disabled while rechecking, which drops focus; give it back when the answer arrives.
  useEffect(() => { if (!refreshing && restoreFocus.current) { restoreFocus.current = false; actions.current?.querySelector<HTMLButtonElement>('[data-recheck]')?.focus() } }, [refreshing])
  const nextText = data.waitingOn === 'STUDENT' ? studentNext[band] : copy.next[band]
  return <LearnFrame band={band} label="Your school link" className="max-w-3xl">
    <header className="flex flex-wrap items-start gap-4" data-stage={data.stage}>
      <CoCharacter band={band} state={copy.co} decorative />
      <div className="min-w-0 flex-1 basis-64 space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">{data.school ? data.school.name : 'Your school link'}</p>
        <h1 ref={heading} tabIndex={-1} className="text-3xl break-words outline-none sm:text-4xl">{copy.title[band]}</h1>
        <p className="max-w-2xl text-[length:var(--ds-body,1rem)]">{copy.body[band]}</p>
      </div>
    </header>

    <Card className="space-y-2 p-5" data-testid="waiting-on" data-waiting-on={data.waitingOn}>
      <h2 className="text-xl font-bold">Who needs to act</h2>
      <p className="text-lg font-bold">{waitingOnLabel(data.waitingOn, data.stage, band)}</p>
      <p>{nextText}</p>
    </Card>

    {invitation && <Card className="space-y-3 p-5" data-testid="student-invitation">
      <h2 className="text-xl font-bold">Your student login is waiting</h2>
      <p>{expires ? `Accept it before ${expires}.` : 'Accept it to finish setting up your account.'}</p>
      <Link href="/student-invite" className="ds-button ds-button-primary">Accept your student login</Link>
    </Card>}

    {showAgeCheck && <p data-testid="age-check-note" className="text-sm text-muted-foreground">Never done the age check? <Link href="/age" className="font-bold underline underline-offset-2">Start the age check</Link>. It is a separate step and does not replace what is above.</p>}

    <Journey stage={data.stage} band={band} />

    <div ref={actions} className="flex flex-wrap items-center gap-3">
      {ready && <Link href="/learn/home" className="ds-button ds-button-primary">Go to Home</Link>}
      {onRefresh && <Button variant="secondary" data-recheck="" loading={refreshing} onClick={() => { restoreFocus.current = true; onRefresh() }}>Check again</Button>}
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{checked ? `Checked at ${checked}` : 'Just checked'}</p>
    </div>
    {refreshFailed && <p role="alert" className="text-sm font-bold text-destructive">We could not check again just now. What you see may be out of date. Try again in a moment.</p>}
  </LearnFrame>
}

export function LearnLinkScreen(): ReactNode {
  const { band } = useLearnIdentity()
  const query = useLearnLinkStatus()
  const tone: LearnBand = band ?? 'teens'
  if (query.isPending) return <LearnSkeleton band={tone} label="Checking what is needed" rows={2} />
  // 401 is LearnSessionError (never an ApiError), so a child or expired session cannot sign an adult out.
  if (!query.data) return <LearnLoadError error={query.error ?? new Error('unavailable')} retry={() => void query.refetch()} band={tone} backHref="/" backLabel="Go back" linkHelp={false} />
  return <LearnLinkView data={query.data} band={tone} onRefresh={() => void query.refetch()} refreshing={query.isFetching} refreshFailed={query.isError} />
}
