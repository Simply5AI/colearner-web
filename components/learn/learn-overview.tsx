'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { BookOpen, Plus } from 'lucide-react'
import { Button, Card, CoCharacter, EmptyState, Input, ProgressBar, Select, SpeechBubble } from '@/components/design-system'
import { bandFromApi, learnApi, linkHref, type JoinResult, type LearnBand, type LearnOverview, type OverviewFilters, type PlanCard } from '@/lib/api/learn'
import { cn } from '@/lib/utils'
import { LearnFrame, LearnLoadError, LearnSkeleton, LockedTag, StepDots, learnKeys, useLearnIdentity, useLearnOverview } from './learn-common'
import { dateLabel, dueLabel } from './learn-format'
import { JoinWithCodeDialog, approvalCopy } from './learn-join-dialog'

const modeLabel = { TOPIC: 'Topic', SYLLABUS: 'Syllabus', EXAM_PREP: 'Exam prep' } as const

export function PlanCardView({ plan, band }: { plan: PlanCard; band: LearnBand }) {
  const kids = band === 'kids'
  const href = linkHref({ route: 'PLAN', id: plan.id })
  const due = dueLabel(plan.dueAt, band)
  const exam = dateLabel(plan.examDate)
  const source = plan.kind === 'ASSIGNED'
    ? [plan.assignedBy ? `From ${plan.assignedBy.name}` : 'From your teacher', plan.className].filter(Boolean).join(' · ')
    : 'My plan'
  return <Card data-testid="plan-card" data-kind={plan.kind} className={cn('flex min-w-0 flex-col gap-3', kids && 'p-6')} aria-labelledby={`plan-${plan.id}`}>
    <div className="flex flex-wrap items-center gap-2">
      <span className="ds-pill" data-kind="plan-source">{source}</span>
      {plan.locked && <LockedTag>Set by your teacher</LockedTag>}
      {plan.status === 'COMPLETED' && <span className="ds-pill">Completed</span>}
    </div>
    <h3 id={`plan-${plan.id}`} className="break-words font-extrabold">{href ? <Link href={href} className="hover:underline focus-visible:outline-2">{plan.title}</Link> : plan.title}</h3>
    <p className="text-[length:var(--ds-small)] text-muted-foreground">{[plan.subject?.name, modeLabel[plan.mode]].filter(Boolean).join(' · ')}</p>
    {kids ? <StepDots progress={plan.progress} label="steps" /> : plan.progress.total > 0 ? <ProgressBar label="Items done" value={plan.progress.done} max={plan.progress.total} /> : <p className="text-[length:var(--ds-small)] text-muted-foreground">Nothing planned yet</p>}
    {plan.nextItemTitle && <p className="break-words"><span className="text-muted-foreground">Next: </span><span className="font-bold">{plan.nextItemTitle}</span></p>}
    {(due || exam) && <p className={cn('text-[length:var(--ds-small)]', due?.overdue && !kids && 'font-bold text-destructive')}>{[due?.text, exam ? `Exam ${exam}` : null].filter(Boolean).join(' · ')}</p>}
    {href && <Link href={href} className="ds-button ds-button-secondary mt-auto" aria-label={`Open ${plan.title}`}>{kids ? 'Go!' : 'Open plan'}</Link>}
  </Card>
}

function PendingApprovals({ items, band }: { items: LearnOverview['pendingEnrollments']; band: LearnBand }) {
  if (items.length === 0) return null
  return <section aria-labelledby="pending-approvals" data-state="approval-pending" className="space-y-3">
    <h2 id="pending-approvals">{approvalCopy(band)}</h2>
    <ul className="grid gap-3 md:grid-cols-2">{items.map(item => <li key={item.id} className="ds-card flex items-center gap-4" data-testid="pending-enrollment">
      <CoCharacter band={band} state="idle" decorative />
      <div className="min-w-0"><p className="break-words font-bold">{item.planTitle}</p><p className="text-[length:var(--ds-small)] text-muted-foreground">{item.teacherName ? `From ${item.teacherName} · ` : ''}Asked {dateLabel(item.requestedAt) ?? 'recently'}</p><p className="text-[length:var(--ds-small)]">You can start after your parent or guardian says yes.</p></div>
    </li>)}</ul>
  </section>
}

const hasFilters = (filters: OverviewFilters) => Boolean(filters.q?.trim() || filters.subjectId || filters.kind || filters.status)

export interface OverviewViewProps {
  overview: LearnOverview
  filters: OverviewFilters
  onFiltersChange: (filters: OverviewFilters) => void
  onJoin: (code: string) => Promise<JoinResult>
  initialJoinOpen?: boolean
  /** Present while more pages exist. */
  more?: { loading: boolean; onMore: () => void }
  busy?: boolean
  notice?: ReactNode
}

/** Pure presentation of /learn/overview (L2). No fetching and no canned data. */
export function LearnOverviewView({ overview, filters, onFiltersChange, onJoin, initialJoinOpen = false, more, busy, notice }: OverviewViewProps) {
  const band = bandFromApi(overview.band)
  const kids = band === 'kids'
  const [joinOpen, setJoinOpen] = useState(initialJoinOpen)
  const [draft, setDraft] = useState(filters.q ?? '')
  useEffect(() => {
    if (draft === (filters.q ?? '')) return
    const timer = setTimeout(() => onFiltersChange({ ...filters, q: draft }), 350)
    return () => clearTimeout(timer)
  }, [draft, filters, onFiltersChange])
  const filtered = hasFilters(filters)
  const nothing = overview.plans.length === 0 && overview.subjects.length === 0 && overview.pendingEnrollments.length === 0
  const change = (patch: Partial<OverviewFilters>) => onFiltersChange({ ...filters, ...patch })
  return <LearnFrame band={band} label="Learn">
    <header className="flex flex-wrap items-center gap-5">
      <CoCharacter band={band} state={kids ? 'curious' : 'idle'} decorative className={kids ? 'size-32 sm:size-[220px]' : undefined} />
      <div className="min-w-[14rem] flex-1 space-y-2">
        <h1>{kids ? 'My adventures' : 'Learn'}</h1>
        {kids ? <SpeechBubble className="max-w-md">Pick an adventure!</SpeechBubble> : <p className="max-w-2xl text-muted-foreground">Your own plans and plans from your teachers, together.</p>}
      </div>
    </header>
    <div className="flex flex-wrap items-center gap-3">
      {overview.canCreatePersonalPlan && <Link href="/roadmaps" className="ds-button ds-button-primary"><Plus size={18} aria-hidden="true" />New plan</Link>}
      {overview.canJoinWithCode && <Button variant="secondary" onClick={() => setJoinOpen(true)}>Join with a code</Button>}
      <Link href="/learn/import" className="ds-button ds-button-secondary">{kids ? 'Bring something new' : 'Import material'}</Link>
    </div>
    {overview.unavailableReason && <p role="note" data-state="unavailable" className="ds-card text-muted-foreground">{overview.unavailableReason}</p>}
    {notice}
    <PendingApprovals items={overview.pendingEnrollments} band={band} />
    {!kids && <Card className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Find a plan" role="search">
      <Input label="Search plans or classes" type="search" value={draft} onChange={event => setDraft(event.target.value)} />
      <Select label="Subject" value={filters.subjectId ?? ''} onChange={event => change({ subjectId: event.target.value || undefined })}><option value="">All subjects</option>{overview.subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</Select>
      <Select label="Whose plan" value={filters.kind ?? ''} onChange={event => change({ kind: (event.target.value || undefined) as OverviewFilters['kind'] })}><option value="">All plans</option><option value="PERSONAL">My plans</option><option value="ASSIGNED">From my teachers</option></Select>
      <Select label="Status" value={filters.status ?? ''} onChange={event => change({ status: (event.target.value || undefined) as OverviewFilters['status'] })}><option value="">Any status</option><option value="ACTIVE">In progress</option><option value="COMPLETED">Finished</option><option value="PENDING_APPROVAL">Waiting for approval</option></Select>
    </Card>}
    {overview.subjects.length > 0 && <section aria-labelledby="subjects">
      <h2 id="subjects" className="mb-3">{kids ? 'Worlds to explore' : 'Subjects'}</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{overview.subjects.map(subject => {
        const selected = filters.subjectId === subject.id
        return <li key={subject.id}><button type="button" aria-pressed={selected} onClick={() => change({ subjectId: selected ? undefined : subject.id })} data-testid="subject-card"
          className={cn('ds-card flex w-full min-w-0 flex-col items-start gap-3 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring', selected && 'border-2 border-primary', kids && 'min-h-40 p-6')}>
          <BookOpen aria-hidden="true" size={kids ? 40 : 24} className="text-primary" />
          <span className="break-words text-[length:var(--ds-h3)] font-extrabold">{subject.name}</span>
          <span className="text-[length:var(--ds-small)] text-muted-foreground">{subject.planCount} {subject.planCount === 1 ? 'plan' : 'plans'}</span>
          {subject.progress.total > 0 && (kids ? <StepDots progress={subject.progress} label="steps" /> : <ProgressBar label="Items done" value={subject.progress.done} max={subject.progress.total} className="w-full" />)}
        </button></li>
      })}</ul>
    </section>}
    {nothing && !filtered ? <div data-state="empty"><EmptyState band={band} title="Nothing here yet" description="Bring something to learn and Co will help you start." action={<Link href="/learn/import" className="ds-button ds-button-primary">Bring something to learn</Link>} /></div> : <section aria-labelledby="plans" aria-busy={busy || undefined} className="space-y-3">
      <h2 id="plans">{kids ? 'Your adventures' : 'Plans'}</h2>
      {overview.plans.length === 0
        ? <div data-state="no-matches"><EmptyState band={band} title="No plans match" description="Try a different search or filter." action={<Button variant="secondary" onClick={() => { setDraft(''); onFiltersChange({}) }}>Clear filters</Button>} /></div>
        : <ul className={cn('grid gap-4 md:grid-cols-2', !kids && 'xl:grid-cols-3')}>{overview.plans.map(plan => <li key={plan.id} className="min-w-0 [&>*]:h-full"><PlanCardView plan={plan} band={band} /></li>)}</ul>}
      {more && <div className="flex justify-center"><Button variant="secondary" loading={more.loading} onClick={more.onMore}>Show more</Button></div>}
    </section>}
    <JoinWithCodeDialog open={joinOpen} onOpenChange={setJoinOpen} band={band} onJoin={onJoin} />
  </LearnFrame>
}

export function LearnOverviewScreen() {
  const { band } = useLearnIdentity()
  const cache = useQueryClient()
  const [filters, setFilters] = useState<OverviewFilters>({})
  const query = useLearnOverview(filters)
  const pages = query.data?.pages
  if (!pages) {
    if (query.error) return <LearnLoadError error={query.error} retry={() => void query.refetch()} band={band ?? 'teens'} backHref="/learn/home" backLabel="Go home" />
    return <LearnSkeleton band={band ?? 'teens'} label="Loading your plans" />
  }
  const first = pages[0]!
  const overview: LearnOverview = { ...first, plans: pages.flatMap(page => page.plans), nextCursor: pages.at(-1)!.nextCursor }
  const join = async (code: string) => {
    const result = await learnApi.join(code)
    void cache.invalidateQueries({ queryKey: learnKeys.root })
    return result
  }
  return <LearnOverviewView overview={overview} filters={filters} onFiltersChange={setFilters} onJoin={join} busy={query.isFetching && !query.isFetchingNextPage}
    more={query.hasNextPage ? { loading: query.isFetchingNextPage, onMore: () => void query.fetchNextPage() } : undefined}
    notice={query.error ? <div role="alert" className="ds-card flex flex-wrap items-center gap-3"><p>{query.error.message}</p><Button variant="secondary" onClick={() => void query.refetch()}>Try again</Button></div> : undefined} />
}
