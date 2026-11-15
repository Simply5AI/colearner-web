'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ChevronDown, Flame, Gauge } from 'lucide-react'
import {
  AVAILABLE_MINUTES_OPTIONS,
  dismissTutorNudge,
  formatBriefingReason,
  formatReadinessBadgeText,
  formatStudyDuration,
  getTodayScreenNudges,
  getTutorToday,
  resolveTutorActionHref,
  type TutorBriefingAction,
  type TutorScheduleItem,
  type TutorTodayResponse,
} from '@/lib/api/tutor-loop/today'
import { isTutorNotEnabled, isTutorResting } from '@/lib/api/tutor-loop/client'
import { formatCountdown, formatTutorDate } from '@/lib/tutor-loop/date'
import { coArt, itemKindLabel, useLearnerFirstName, useTutorIdentity } from './tutor-identity'

export const todayKey = (workspace: string, availableMinutes: number | null) =>
  ['tutor-today', workspace, availableMinutes] as const

function Pill({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className="inline-flex">{icon}</span>
      {children}
    </span>
  )
}

function weeklyPercent(minutes: number, target: number): number {
  return target > 0 ? Math.max(0, Math.min(100, Math.round((minutes / target) * 100))) : 0
}

function Header({ data, name, onProgress }: { data: TutorTodayResponse; name: string | null; onProgress: () => void }) {
  const { countdown, goal, readiness } = data
  const examLabel = goal?.title ?? 'your exam'
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-[length:var(--ds-h1,2rem)] font-black leading-tight tracking-tight">{name ? `Hi ${name}` : 'Welcome back'}</h1>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {countdown && countdown.state !== 'PASSED' && (
          <Pill icon={<CalendarDays size={14} />}>
            {countdown.state === 'TODAY' ? `Today is ${examLabel}` : `${formatCountdown(countdown).replace(' left', '')} to ${examLabel}`}
          </Pill>
        )}
        {readiness && (
          <button type="button" onClick={onProgress} className="inline-flex items-center gap-1.5 font-bold text-primary underline-offset-2 hover:underline">
            <Gauge size={14} aria-hidden="true" />
            {readiness.evidence === 'ENOUGH' && readiness.percent !== null
              ? `${readiness.percent}% ready`
              : `Ready on ${readiness.topicsCovered} of ${readiness.topicsTotal} topics`}
            <span className="sr-only">. {formatReadinessBadgeText(readiness)}. Open progress.</span>
          </button>
        )}
        <Pill icon={<Flame size={14} />}>{data.streakDays === 1 ? '1 day streak' : `${data.streakDays} day streak`}</Pill>
        <Pill
          icon={
            <span
              role="img"
              aria-label="Weekly goal"
              className="inline-block h-4 w-4 rounded-full"
              style={{ background: `conic-gradient(var(--color-accent, var(--primary)) ${weeklyPercent(data.weeklyMinutes, data.weeklyTargetMinutes)}%, var(--color-neutral-300, #d4d4d8) 0)` }}
            />
          }
        >
          {formatStudyDuration(data.weeklyMinutes)} of {formatStudyDuration(data.weeklyTargetMinutes)} this week
        </Pill>
      </div>
    </div>
  )
}

function ActionLink({ action, goalId, label }: { action: TutorBriefingAction; goalId: string | null; label: string }) {
  return (
    <Link href={resolveTutorActionHref(action, goalId)} className="ds-button ds-button-primary">
      {label}
    </Link>
  )
}

function startLabel(action: TutorBriefingAction) {
  if (action.kind === 'ADD_MATERIAL') return 'Add material'
  if (action.kind === 'TEACHER_DUE') return 'Open'
  return 'Start'
}

function Briefing({ data, tutorName, tutorIcon, onShortOnTime, availableMinutes }: {
  data: TutorTodayResponse
  tutorName: string
  tutorIcon: Parameters<typeof coArt>[0]
  availableMinutes: number | null
  onShortOnTime: (minutes: number | null) => void
}) {
  const [showAlternative, setShowAlternative] = useState(false)
  const { briefing } = data
  const alternative = briefing.alternative
  const current = showAlternative && alternative ? alternative : briefing.action
  const first = !showAlternative
  const done = current.kind === 'DONE_FOR_TODAY'
  const reason = formatBriefingReason(current.reasonCodes)
  const goalId = data.goal?.id ?? null

  return (
    <section aria-label="Your next step" data-testid="today-briefing" data-kind={current.kind} className="ds-card flex flex-col gap-3 sm:flex-row sm:items-start">
      <img src={coArt(tutorIcon, done ? 'celebrating' : 'speaking')} alt="" width={88} height={88} className="shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="text-xl font-extrabold leading-snug [overflow-wrap:anywhere]">{done ? 'All done for today' : current.label}</p>
        {!done && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {current.minutes > 0 && <span>About {formatStudyDuration(current.minutes)}</span>}
            <span>{reason}</span>
          </p>
        )}
        {first && briefing.wording && (
          <p className="text-sm" data-testid="co-wording">
            <span className="mr-2 rounded-full bg-[var(--co-surface,transparent)] px-2 py-0.5 text-xs font-bold text-primary ring-1 ring-primary">{tutorName}’s suggestion</span>
            {briefing.wording}
          </p>
        )}
        {done && (
          <p className="text-sm text-muted-foreground">
            {data.weeklyMinutes > 0
              ? `You have studied ${formatStudyDuration(data.weeklyMinutes)} this week. See you next time.`
              : 'Nothing else is planned today. Rest well.'}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {!done && current.kind !== 'BREAK' && <ActionLink action={current} goalId={goalId} label={startLabel(current)} />}
          {!done && alternative && first && (
            <button type="button" className="ds-button ds-button-secondary" onClick={() => setShowAlternative(true)}>Something else</button>
          )}
          {!first && (
            <button type="button" className="ds-button ds-button-secondary" onClick={() => setShowAlternative(false)}>Back to my first suggestion</button>
          )}
        </div>
        <div role="group" aria-label="Time you have today" className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Short on time?</span>
          {AVAILABLE_MINUTES_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={availableMinutes === m}
              onClick={() => onShortOnTime(availableMinutes === m ? null : m)}
              className={`min-h-9 rounded-full border-2 px-3 font-bold ${availableMinutes === m ? 'border-primary bg-[var(--co-surface,transparent)]' : 'border-border'}`}
            >
              {m} min
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function ItemRow({ item, goalId }: { item: TutorScheduleItem; goalId: string | null }) {
  const done = item.status === 'DONE'
  return (
    <li className="flex items-center gap-3 border-t border-border py-2.5 first:border-t-0">
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="[overflow-wrap:anywhere]">{item.title}</b>
        <span className="text-sm text-muted-foreground">{itemKindLabel(item.kind)} · {formatStudyDuration(item.estimatedMinutes)}</span>
      </span>
      {done ? (
        <span className="text-sm font-bold text-muted-foreground">Done</span>
      ) : (
        <Link
          href={resolveTutorActionHref({ kind: item.kind, targetId: item.topicId }, goalId)}
          className="ds-button ds-button-secondary"
          aria-label={`Start ${item.title}`}
        >
          Start
        </Link>
      )}
    </li>
  )
}

function Later({ items, goalId }: { items: TutorScheduleItem[]; goalId: string | null }) {
  const [open, setOpen] = useState(false)
  const todo = items.filter((i) => i.status === 'PLANNED')
  const done = items.filter((i) => i.status === 'DONE')
  if (!items.length) return null
  const minutes = todo.reduce((sum, i) => sum + i.estimatedMinutes, 0)
  const meta = [todo.length ? `${todo.length} more · ${formatStudyDuration(minutes)}` : '', done.length ? `${done.length} done` : ''].filter(Boolean).join(' · ')
  return (
    <section className="ds-card flex flex-col" data-testid="today-later">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 text-left">
        <b>{todo.length ? 'Later today' : 'Done today'}</b>
        <span className="flex-1 text-sm text-muted-foreground">{meta}</span>
        <ChevronDown aria-hidden="true" size={18} className={open ? 'rotate-180' : undefined} />
      </button>
      {open && <ul className="mt-2">{[...todo, ...done].map((item) => <ItemRow key={item.id} item={item} goalId={goalId} />)}</ul>}
    </section>
  )
}

function Teacher({ items, goalId }: { items: TutorScheduleItem[]; goalId: string | null }) {
  if (!items.length) return null
  return (
    <section className="ds-card flex flex-col" aria-label="From your teacher" data-testid="today-teacher">
      <b>From your teacher</b>
      <ul className="mt-1">{items.map((item) => <ItemRow key={item.id} item={item} goalId={goalId} />)}</ul>
    </section>
  )
}

function Weak({ data, adult }: { data: TutorTodayResponse; adult: boolean }) {
  if (!data.weakConcepts.length) return null
  const goalId = data.goal?.id ?? null
  return (
    <section className="ds-card flex flex-col gap-2" data-testid="today-weak">
      <b>{adult ? 'Needs practice' : 'Worth another look'}</b>
      <div className="flex flex-wrap gap-2">
        {data.weakConcepts.slice(0, 3).map((w) => (
          <Link key={w.conceptId} href={resolveTutorActionHref({ kind: 'PRACTICE', targetId: w.topicId }, goalId)} className="ds-button ds-button-secondary">
            {w.label}
          </Link>
        ))}
      </div>
    </section>
  )
}

function Nudge({ workspace }: { workspace: string }) {
  const client = useQueryClient()
  const nudges = useQuery({ queryKey: ['tutor-today-nudges', workspace], queryFn: getTodayScreenNudges, retry: false })
  const dismiss = useMutation({
    mutationFn: (id: string) => dismissTutorNudge(id),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['tutor-today-nudges', workspace] }),
  })
  const nudge = nudges.data?.items[0]
  if (!nudge) return null
  return (
    <aside className="ds-card flex flex-wrap items-center gap-3" aria-label="A note from your tutor" data-testid="today-nudge">
      <p className="min-w-0 flex-1 text-sm">{nudge.text}</p>
      <Link href={resolveTutorActionHref(nudge.action)} className="ds-button ds-button-secondary">{nudge.action.label}</Link>
      <button type="button" className="text-sm underline" onClick={() => dismiss.mutate(nudge.id)}>Not now</button>
    </aside>
  )
}

export function TodayTab({ onOpenProgress }: { onOpenProgress: () => void }) {
  const { workspace, tutorName, tutorIcon, adult } = useTutorIdentity()
  const name = useLearnerFirstName()
  const [availableMinutes, setAvailableMinutes] = useState<number | null>(null)
  const today = useQuery({
    queryKey: todayKey(workspace, availableMinutes),
    queryFn: () => getTutorToday({ availableMinutes }, { workspace }),
    retry: false,
    placeholderData: (previous) => previous,
  })

  if (today.isPending) {
    return (
      <div role="status" aria-live="polite" className="flex flex-col gap-4" data-state="loading">
        <span className="sr-only">Loading today</span>
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-[var(--ds-radius,1rem)] bg-muted" />
      </div>
    )
  }
  if (today.isError) {
    const resting = isTutorResting(today.error)
    const disabled = isTutorNotEnabled(today.error)
    return (
      <div role="alert" className="ds-card flex flex-col items-start gap-3" data-state={resting ? 'resting' : 'error'}>
        <img src={coArt(tutorIcon, 'resting')} alt="" width={72} height={72} />
        <b>{resting ? `${tutorName} is resting` : disabled ? 'Today is not available here yet' : 'Today could not be loaded'}</b>
        <p className="text-sm text-muted-foreground">
          {resting ? 'Your plan still works. You can practise or open your plan now.' : disabled ? 'Your usual learning home is still there.' : 'Check your connection and try again.'}
        </p>
        <div className="flex flex-wrap gap-2">
          {!disabled && <button type="button" className="ds-button ds-button-primary" onClick={() => void today.refetch()}>Try again</button>}
          {resting && <Link href="/learn/practice" className="ds-button ds-button-secondary">Go to Practice</Link>}
          {disabled && <Link href="/learn/home" className="ds-button ds-button-secondary">Go to learning home</Link>}
        </div>
      </div>
    )
  }

  const data = today.data
  const goalId = data.goal?.id ?? null
  const empty = data.briefing.action.kind === 'ADD_MATERIAL' && !data.later.length && !data.fixedWork.length
  return (
    <div className="flex flex-col gap-4" data-state={empty ? 'empty' : 'ready'} aria-busy={today.isFetching}>
      <Header data={data} name={name} onProgress={onOpenProgress} />
      <Briefing data={data} tutorName={tutorName} tutorIcon={tutorIcon} availableMinutes={availableMinutes} onShortOnTime={setAvailableMinutes} />
      <p className="sr-only" role="status" aria-live="polite">{today.isFetching ? 'Updating your suggestion' : ''}</p>
      <Teacher items={data.fixedWork} goalId={goalId} />
      <Later items={data.later} goalId={goalId} />
      <Weak data={data} adult={adult} />
      <Nudge workspace={workspace} />
      <p className="text-xs text-muted-foreground">As of {formatTutorDate(data.date)}</p>
    </div>
  )
}
