'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query'
import { LayoutGrid, Plus, Rows3, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isDenied, isUnavailable, teachingErrorText, type PlanStatus, type TeachingPlanCard, type TeachingPlanDetail } from '@/lib/api/teaching/plans'
import { cn } from '@/lib/utils'
import { InlineAlert, LoadingBlock, MeasuredTag, NativeSelect } from './fields'
import { NewPlanDialog } from './new-plan-dialog'
import { bandText, dateText, plural } from './plan-format'
import { PlanStatusChip } from './plan-status-chip'
import { teachingKeys, useTeachingApis, useTeachingContextData } from './use-teaching-apis'

type View = 'cards' | 'table'
const tabs: { key: PlanStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' }, { key: 'DRAFT', label: 'Draft' }, { key: 'PUBLISHED', label: 'Published' }, { key: 'ARCHIVED', label: 'Archived' },
]

function useDebounced<T>(value: T, ms = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => { const timer = setTimeout(() => setDebounced(value), ms); return () => clearTimeout(timer) }, [value, ms])
  return debounced
}

const students = (plan: TeachingPlanCard) => <span>{plan.students.enrolledActive} of {plural(plan.students.roster, 'student')} enrolled{plan.students.pendingGuardian > 0 ? `, ${plan.students.pendingGuardian} waiting for guardian approval` : ''}</span>
const progress = (plan: TeachingPlanCard) => plan.averageProgress === null
  ? <span className="text-muted-foreground" data-testid="progress-insufficient">Not enough data yet</span>
  : <span data-testid="plan-progress">{Math.round(plan.averageProgress)}% average</span>

function PlanCardView({ plan }: { plan: TeachingPlanCard }) {
  return <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" data-testid="plan-card" data-status={plan.status}>
    <div className="flex items-start justify-between gap-3">
      <Link href={`/teacher/plans/${encodeURIComponent(plan.id)}`} className="min-w-0 break-words text-base font-bold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{plan.title}</Link>
      <PlanStatusChip status={plan.status} />
    </div>
    <p className="text-xs text-muted-foreground">{plan.scope.classLabel} · {plan.scope.subject} · {bandText(plan.scope.targetBand)}</p>
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
      <dt className="text-muted-foreground">Students</dt><dd><MeasuredTag /> {students(plan)}</dd>
      <dt className="text-muted-foreground">Progress</dt><dd><MeasuredTag /> {progress(plan)}</dd>
      <dt className="text-muted-foreground">Topics</dt><dd>{plan.topicCount}</dd>
      <dt className="text-muted-foreground">Updated</dt><dd>{dateText(plan.updatedAt)}</dd>
    </dl>
  </li>
}

function PlanTable({ plans }: { plans: TeachingPlanCard[] }) {
  return <div className="overflow-x-auto rounded-xl border border-border">
    <table className="w-full min-w-[44rem] text-sm" data-testid="plan-table">
      <caption className="sr-only">Your plans</caption>
      <thead className="bg-muted/50 text-start text-xs uppercase tracking-wide text-muted-foreground"><tr>
        <th scope="col" className="p-3 text-start">Plan</th><th scope="col" className="p-3 text-start">Class and band</th><th scope="col" className="p-3 text-start">Students</th>
        <th scope="col" className="p-3 text-start">Progress</th><th scope="col" className="p-3 text-start">Status</th><th scope="col" className="p-3 text-start">Updated</th>
      </tr></thead>
      <tbody>{plans.map(plan => <tr key={plan.id} className="border-t border-border" data-testid="plan-row">
        <th scope="row" className="p-3 text-start font-semibold"><Link href={`/teacher/plans/${encodeURIComponent(plan.id)}`} className="hover:underline">{plan.title}</Link></th>
        <td className="p-3">{plan.scope.classLabel}<br /><span className="text-xs text-muted-foreground">{plan.scope.subject} · {bandText(plan.scope.targetBand)}</span></td>
        <td className="p-3">{students(plan)}</td><td className="p-3">{progress(plan)}</td><td className="p-3"><PlanStatusChip status={plan.status} /></td><td className="p-3">{dateText(plan.updatedAt)}</td>
      </tr>)}</tbody>
    </table>
  </div>
}

/** T2: the teacher's plans (F-T2-01) with the New plan dialog (F-T2-03). Only the signed-in teacher's scoped plans are ever listed. */
export function TeachingPlansList({ openNewInitially = false }: { openNewInitially?: boolean }) {
  const router = useRouter()
  const apis = useTeachingApis()
  const context = useTeachingContextData()
  const [view, setView] = useState<View>('cards')
  const [status, setStatus] = useState<PlanStatus | 'ALL'>('ALL')
  const [classId, setClassId] = useState('')
  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [dialog, setDialog] = useState(openNewInitially)
  const filters = { status: status === 'ALL' ? undefined : status, classId: classId || undefined, q: q || undefined }
  const list = useInfiniteQuery({
    queryKey: [...teachingKeys.plans(apis.schoolId), 'list', filters], retry: false, staleTime: 0, refetchOnWindowFocus: false,
    queryFn: ({ pageParam }) => apis.plans.list({ ...filters, cursor: pageParam }),
    initialPageParam: null as string | null, getNextPageParam: last => last.nextCursor, placeholderData: keepPreviousData,
  })
  const plans = list.data?.pages.flatMap(page => page.items) ?? []
  const counts = list.data?.pages[0]?.counts
  const classes = context.data?.classes ?? []
  const noClass = context.isSuccess && classes.length === 0
  const filtered = status !== 'ALL' || !!classId || !!q

  const onCreated = (plan: TeachingPlanDetail) => { setDialog(false); router.push(`/teacher/plans/${encodeURIComponent(plan.id)}`) }
  const changeDialog = (open: boolean) => { setDialog(open); if (!open && openNewInitially) router.replace('/teacher/plans') }

  return <div className="space-y-5" data-testid="plans-screen">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1">
        {tabs.map(tab => {
          const count = counts ? (tab.key === 'ALL' ? counts.draft + counts.published + counts.archived : counts[tab.key.toLowerCase() as 'draft' | 'published' | 'archived']) : null
          return <button key={tab.key} type="button" aria-pressed={status === tab.key} onClick={() => setStatus(tab.key)} data-testid={`tab-${tab.key.toLowerCase()}`}
            className={cn('min-h-9 rounded-lg border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring', status === tab.key ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted')}>{tab.label}{count !== null && <span className="ms-1.5 text-xs text-muted-foreground">{count}</span>}</button>
        })}
      </div>
      <Button size="lg" onClick={() => setDialog(true)} disabled={noClass} data-testid="new-plan"><Plus aria-hidden="true" />New plan</Button>
    </div>
    <div className="flex flex-wrap items-end gap-3">
      <div className="relative min-w-48 flex-1">
        <label htmlFor="plan-search" className="sr-only">Search your plans</label>
        <Search aria-hidden="true" className="pointer-events-none absolute start-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input id="plan-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search plans" className="h-9 ps-8" maxLength={100} />
      </div>
      {classes.length > 1 && <div className="w-56"><NativeSelect label="Class" value={classId} onChange={e => setClassId(e.target.value)}><option value="">All classes</option>{classes.map(entry => <option key={entry.classId} value={entry.classId}>{entry.label}</option>)}</NativeSelect></div>}
      <div role="group" aria-label="View" className="ms-auto flex gap-1">
        <Button variant={view === 'cards' ? 'secondary' : 'outline'} size="lg" aria-pressed={view === 'cards'} onClick={() => setView('cards')}><LayoutGrid aria-hidden="true" />Cards</Button>
        <Button variant={view === 'table' ? 'secondary' : 'outline'} size="lg" aria-pressed={view === 'table'} onClick={() => setView('table')}><Rows3 aria-hidden="true" />Table</Button>
      </div>
    </div>

    {noClass && <InlineAlert tone="info" testId="plans-no-class">You are not assigned to a class yet, so there is nothing to plan for. Ask your school administrator to assign you to a class and subject.</InlineAlert>}
    {list.isPending && <LoadingBlock label="Loading your plans" />}
    {list.error && (
      isDenied(list.error)
        ? <InlineAlert testId="plans-denied">You do not have access to teaching plans for this school. Choose your school workspace again, or ask your administrator.</InlineAlert>
        : <div className="space-y-3" data-testid="plans-error"><InlineAlert>{isUnavailable(list.error) ? 'The teaching workspace is unavailable right now. Your plans are safe; try again in a moment.' : teachingErrorText(list.error)}</InlineAlert><Button variant="outline" onClick={() => void list.refetch()}>Retry</Button></div>
    )}
    {list.isSuccess && plans.length === 0 && !noClass && (
      <div className="rounded-xl border border-dashed border-border p-8 text-center" data-testid="plans-empty">
        <h2 className="text-lg font-bold">{filtered ? 'No plans match' : 'You have no plans yet'}</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{filtered ? 'Try a different status, class or search.' : 'A plan is a set of phases and topics for one class and subject. Start from scratch or from the school curriculum.'}</p>
        {!filtered && <Button className="mt-4" size="lg" onClick={() => setDialog(true)}><Plus aria-hidden="true" />Create your first plan</Button>}
      </div>
    )}
    {plans.length > 0 && (view === 'cards'
      ? <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Plans" data-testid="plan-cards">{plans.map(plan => <PlanCardView key={plan.id} plan={plan} />)}</ul>
      : <PlanTable plans={plans} />)}
    {list.hasNextPage && <div className="text-center"><Button variant="outline" size="lg" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>{list.isFetchingNextPage ? 'Loading…' : 'Load more'}</Button></div>}
    {list.isFetchNextPageError && <InlineAlert>More plans could not be loaded. <button type="button" className="underline" onClick={() => void list.fetchNextPage()}>Try again</button></InlineAlert>}
    <NewPlanDialog open={dialog} onOpenChange={changeDialog} onCreated={onCreated} defaultClassId={classId || undefined} />
  </div>
}
