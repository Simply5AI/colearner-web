'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Flag, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tutorLoopClient, getTutorWorkspaceScope, type TutorPlan } from '@/lib/api/tutor-loop/client'
import { formatTutorDate } from '@/lib/tutor-loop/date'
import { buildHrefWithGoal } from '@/lib/tutor-loop/goal-filter'
import { buildTutorHref } from '@/lib/tutor-loop/open-tutor'
import { useTutorShell } from '@/components/tutor-loop/shell/tutor-shell-context'
import { groupPlanTopics, stateLabel, topicMeta } from './plan-state'

const pill = 'inline-flex min-h-9 items-center rounded-full border border-border bg-background px-3 text-[13px] font-bold hover:bg-muted'

export function MyPlan({ goalId, planId }: { goalId: string | null; planId?: string }) {
  const shell = useTutorShell()
  const workspace = getTutorWorkspaceScope()
  const [owner, setOwner] = useState<'OWN' | 'ASSIGNED'>('OWN')
  const [mode, setMode] = useState<'SUBJECT' | 'STATUS'>('SUBJECT')
  const [find, setFind] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const query = useQuery({
    queryKey: ['tutor-plans', workspace, goalId],
    queryFn: () => tutorLoopClient.plans({ goalId, limit: 50 }, { workspace }),
    retry: false,
  })
  const plans = (query.data?.items ?? []).filter((p) => !planId || p.id === planId)
  const own = plans.filter((p) => p.ownership === 'OWN')
  const assigned = plans.filter((p) => p.ownership === 'ASSIGNED')
  const shown: TutorPlan[] = owner === 'ASSIGNED' ? assigned : own
  const groups = useMemo(() => groupPlanTopics(shown, mode, find), [shown, mode, find])
  const goal = shell.goals.find((g) => g.id === goalId) ?? shell.goals[0]
  const name = shell.tutorName
  const findState = shell.entry?.capabilities.findMaterial ?? 'HIDDEN'

  if (query.isPending) return <div role="status" aria-label="Loading your plan" className="space-y-3"><div className="h-28 animate-pulse rounded-2xl bg-muted" /><div className="h-48 animate-pulse rounded-2xl bg-muted" /></div>
  if (query.isError) return <div role="alert" className="space-y-3 rounded-2xl border border-border bg-card p-6">
    <h2>Your plan could not load</h2><p className="text-muted-foreground">Your work is safe. Try again in a moment.</p>
    <button type="button" onClick={() => void query.refetch()} className="min-h-11 rounded-full bg-primary px-5 font-bold text-primary-foreground">Try again</button></div>
  if (plans.length === 0) return <div className="space-y-3 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
    <h2>No plan here yet</h2><p className="text-muted-foreground">{goalId ? 'Try another goal, or make a plan for this one.' : `Tell ${name} what you are working towards and get a plan.`}</p>
    <Link href="/learn/start?step=goal" className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 font-bold text-primary-foreground">Make a plan</Link></div>

  const plan = shown[0]
  return <div className="space-y-4">
    {assigned.length > 0 && <div role="tablist" aria-label="Plan owner" className="inline-flex gap-0.5 rounded-full bg-muted p-1">
      {([['OWN', 'Made by me'], ['ASSIGNED', 'From my teacher']] as const).map(([v, l]) => <button key={v} role="tab" type="button" aria-selected={owner === v} onClick={() => setOwner(v)}
        className={cn('min-h-9 rounded-full px-4 text-sm font-bold', owner === v ? 'bg-background shadow-sm' : 'text-muted-foreground')}>{l}</button>)}</div>}
    {plan && <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5" aria-label="Plan summary">
      <div className="min-w-0 flex-1 basis-72 space-y-1">
        {plan.ownership === 'ASSIGNED' && <span className="inline-flex rounded-full bg-secondary px-2.5 py-0.5 text-xs font-extrabold text-primary">From {plan.teacherName || 'your teacher'}</span>}
        <h2 className="break-words">{plan.title}</h2>
        <p className="text-sm text-muted-foreground">{[goal?.exam?.date ? `${goal.title} · ${formatTutorDate(goal.exam.date)}` : null, plan.dueDate ? `Due by ${formatTutorDate(plan.dueDate)}` : null].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/learn/today" className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 font-bold text-primary-foreground">Start next</Link>
        {plan.ownership === 'OWN' && <Link href="/learn/me?section=goal" className="inline-flex min-h-11 items-center rounded-full border border-border px-5 font-bold">Edit plan</Link>}
      </div></section>}
    {plan?.ownership === 'ASSIGNED' && plan.teacherNote && <p className="rounded-xl bg-secondary p-4 text-sm"><b>{plan.teacherName || 'Your teacher'}:</b> “{plan.teacherNote}”</p>}

    <div className="flex flex-wrap items-center gap-2">
      <label className="flex min-h-11 max-w-sm flex-1 basis-56 items-center gap-2 rounded-full border border-border bg-background px-3">
        <Search aria-hidden="true" className="size-4 text-muted-foreground" />
        <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a topic" aria-label="Find a topic" className="min-w-0 flex-1 bg-transparent outline-none" /></label>
      <div role="radiogroup" aria-label="Group topics" className="inline-flex gap-0.5 rounded-full bg-muted p-1">
        {([['SUBJECT', 'By subject'], ['STATUS', 'By status']] as const).map(([v, l]) => <button key={v} role="radio" type="button" aria-checked={mode === v} onClick={() => setMode(v)}
          className={cn('min-h-9 rounded-full px-3.5 text-sm font-bold', mode === v ? 'bg-background shadow-sm' : 'text-muted-foreground')}>{l}</button>)}</div>
    </div>
    {groups.length === 0 && <p className="rounded-2xl bg-card p-6 text-center text-muted-foreground">No topics here. Try another goal or search.</p>}
    {groups.map((g) => <section key={g.key} className="space-y-2" aria-label={g.title}>
      <div className="flex flex-wrap items-baseline gap-3"><h3>{g.title}</h3><span className="text-sm text-muted-foreground">{g.note}</span></div>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {g.topics.map(({ topic, planId }) => {
          const isOpen = open === topic.id
          const ctx = buildTutorHref({ kind: 'PLAN_TOPIC', planId, topicId: topic.id })
          return <li key={topic.id}>
            <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : topic.id)} className="flex min-h-14 w-full flex-wrap items-center gap-3 px-4 py-3 text-start">
              <span className={cn('inline-flex min-w-max rounded-full px-2.5 py-0.5 text-xs font-extrabold', topic.state === 'NEEDS_REVIEW' ? 'bg-accent text-accent-foreground' : 'bg-secondary text-primary')}>{stateLabel[topic.state]}</span>
              <span className="min-w-0 flex-1 basis-48"><b className="block break-words">{topic.title}</b><span className="text-sm text-muted-foreground">{topicMeta(topic)}{topic.dueDate ? ` · due ${formatTutorDate(topic.dueDate)}` : ''}</span></span>
              <ChevronDown aria-hidden="true" className={cn('size-4 transition-transform', isOpen && 'rotate-180')} />
            </button>
            {isOpen && <div className="space-y-2 px-4 pb-4">
              {topic.materialIds.length === 0 && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border p-3">
                <span className="min-w-40 flex-1 font-bold">No material yet</span>
                <Link href={`/learn/import?topicId=${encodeURIComponent(topic.id)}&planId=${encodeURIComponent(planId)}`} className={pill}>Add material</Link>
                {plan?.ownership === 'ASSIGNED' ? <span className="text-sm text-muted-foreground">Ask your teacher for material.</span>
                  : findState === 'AVAILABLE' ? <Link href={buildTutorHref({ kind: 'PLAN_TOPIC', planId, topicId: topic.id })} className={cn(pill, 'border-transparent bg-primary text-primary-foreground')}>Ask {name} to find some</Link>
                  : findState === 'LOCKED' ? <Link href="/settings" className={pill}>Ask {name} to find some <span className="ms-1.5 rounded-full bg-secondary px-2 text-[11px] text-primary">Plus</span></Link> : null}
              </div>}
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/60 p-3">
                <span className="min-w-40 flex-1 font-semibold">{topic.title}</span>
                <Link href={`${ctx}&mode=EXPLAIN`} className={pill}>Learn</Link>
                <Link href={buildHrefWithGoal(`/learn/practice?topicId=${encodeURIComponent(topic.id)}`, goalId)} className={pill}>Practise</Link>
                <Link href={ctx} className={cn(pill, 'border-transparent bg-secondary text-primary')}>Ask {name}</Link>
              </div>
            </div>}
          </li>
        })}
      </ul></section>)}
    {shell.entry?.capabilities.canUseMock && <Link href={buildHrefWithGoal('/learn/practice?tab=exam', goalId)} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 hover:bg-muted/50">
      <span className="grid size-11 place-items-center rounded-full bg-secondary text-primary"><Flag aria-hidden="true" className="size-5" /></span>
      <span className="flex-1"><b className="block">Take a mock exam on this plan</b><span className="text-sm text-muted-foreground">15 min, half or full length</span></span></Link>}
  </div>
}
