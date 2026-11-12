'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { keepPreviousData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { FileUp, Plus, Search, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InlineAlert, LoadingBlock, NativeSelect } from '@/components/teacher/plans/fields'
import { isDenied, isUnavailable, teachingErrorText } from '@/lib/api/teaching/plans'
import {
  difficultyLabel, difficulties, originLabel, questionOrigins, questionStatuses, questionTypes, reviewStates, statusLabel, typeLabel,
  type QuestionListItem,
} from '@/lib/api/teaching/question-schema'
import { cn } from '@/lib/utils'
import { CoDraftDialog } from './co-draft-dialog'
import { AuthorOnlyBadge, QuestionFlags, StatusChips, SuccessRate } from './question-flags'
import { questionKeys, useCoBatches, useCoState, usePlanOptions, usePlanTopics, useQuestionApis } from './use-question-apis'

function useDebounced<T>(value: T, ms = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => { const timer = setTimeout(() => setDebounced(value), ms); return () => clearTimeout(timer) }, [value, ms])
  return debounced
}

export interface QuestionBankFilters { planId: string; topicId: string; type: string; difficulty: string; origin: string; status: string; reviewState: string; flagged: boolean }
const noFilters: QuestionBankFilters = { planId: '', topicId: '', type: '', difficulty: '', origin: '', status: '', reviewState: '', flagged: false }

const batchStatusText: Record<string, string> = { QUEUED: 'Waiting to start', RUNNING: 'Co is drafting', READY: 'Ready to review', FAILED: 'Did not finish', CANCELLED: 'Cancelled' }

/** "Recent Co drafts": each row opens that batch's review queue, so a closed tab never loses drafts waiting for review. */
function RecentCoDrafts({ planId }: { planId: string }) {
  const batches = useCoBatches(planId)
  const recent = (batches.data ?? []).slice(0, 5)
  if (batches.isPending || batches.isError || recent.length === 0) return null
  return <section aria-labelledby="recent-co-title" className="space-y-2 rounded-xl border border-border bg-card p-4" data-testid="recent-co-drafts">
    <h2 id="recent-co-title" className="text-base font-bold">Recent Co drafts</h2>
    <ul className="divide-y divide-border">
      {recent.map(batch => <li key={batch.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm" data-testid="recent-co-draft">
        <div className="min-w-0">
          <p className="break-words font-medium">{batch.topicTitle || 'Topic'}</p>
          <p className="text-xs text-muted-foreground">{batchStatusText[batch.status] ?? batch.status} · {batch.status === 'READY' ? `${batch.draftCount} of ${batch.requestedCount} drafted` : `${batch.requestedCount} requested`} · {new Date(batch.createdAt).toLocaleDateString()}</p>
        </div>
        <Button variant="outline" size="lg" render={<Link href={`/teacher/questions/review/${encodeURIComponent(batch.id)}`} />}>{batch.status === 'READY' ? 'Review drafts' : 'Open'}</Button>
      </li>)}
    </ul>
  </section>
}

function QuestionRow({ question, onChanged }: { question: QuestionListItem; onChanged: () => void }) {
  const href = `/teacher/questions/${encodeURIComponent(question.id)}`
  return <tr className="border-t border-border align-top" data-testid="question-row" data-question-id={question.id}>
    <th scope="row" className="min-w-64 max-w-md p-3 text-start font-normal">
      <Link href={href} className="line-clamp-2 break-words font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{question.promptPreview || 'Untitled question'}</Link>
      <p className="mt-0.5 text-xs text-muted-foreground">{question.planTitle} · {question.topicTitle}</p>
      <div className="mt-1.5"><StatusChips question={question} /></div>
    </th>
    <td className="p-3"><div className="space-y-1"><span>{typeLabel[question.type]}</span>{question.authorOnly && <div><AuthorOnlyBadge /></div>}</div></td>
    <td className="p-3">{question.difficulty ? difficultyLabel[question.difficulty] : <span className="text-muted-foreground">Not set</span>}</td>
    <td className="p-3"><SuccessRate rate={question.successRate} /></td>
    <td className="min-w-40 p-3">{question.flags.length ? <QuestionFlags question={question} onChanged={onChanged} /> : <span className="text-xs text-muted-foreground">None</span>}</td>
    <td className="p-3 text-xs text-muted-foreground">{originLabel[question.origin]}</td>
  </tr>
}

/** T4 list (F-T4-01, F-T4-02): filters that change the API query, facet counts from the server, measured vs suggested kept apart. */
export function QuestionBankList({ initialPlanId = '', initialTopicId = '' }: { initialPlanId?: string; initialTopicId?: string }) {
  const apis = useQuestionApis()
  const client = useQueryClient()
  const [filters, setFilters] = useState<QuestionBankFilters>({ ...noFilters, planId: initialPlanId, topicId: initialTopicId })
  const [search, setSearch] = useState('')
  const [coOpen, setCoOpen] = useState(false)
  const q = useDebounced(search)
  const set = (patch: Partial<QuestionBankFilters>) => setFilters(current => ({ ...current, ...patch }))

  const plans = usePlanOptions()
  const topics = usePlanTopics(filters.planId || undefined)
  const coState = useCoState(filters.planId || undefined)
  const query = { ...filters, q: q || undefined }
  const list = useInfiniteQuery({
    queryKey: questionKeys.list(apis.schoolId, query), retry: false, staleTime: 0, refetchOnWindowFocus: false,
    queryFn: ({ pageParam }) => apis.questions.list({ ...query, cursor: pageParam }),
    initialPageParam: null as string | null, getNextPageParam: last => last.nextCursor, placeholderData: keepPreviousData,
  })
  const items = list.data?.pages.flatMap(page => page.items) ?? []
  const facets = list.data?.pages[0]?.facets
  const filtered = Object.entries(filters).some(([key, value]) => value && key !== 'planId') || !!filters.planId || !!q
  const refresh = () => void client.invalidateQueries({ queryKey: questionKeys.root(apis.schoolId) })
  const coGenerate = coState.data?.generate
  const coBlocked = !!filters.planId && coGenerate?.state === 'UNAVAILABLE'
  const importHref = `/teacher/questions/import${filters.planId ? `?planId=${encodeURIComponent(filters.planId)}` : ''}`
  const newHref = `/teacher/questions/new${filters.planId ? `?${new URLSearchParams({ planId: filters.planId, ...(filters.topicId ? { topicId: filters.topicId } : {}) })}` : ''}`
  const typeCount = (type: string) => facets?.types[type] ?? 0

  return <div className="space-y-5" data-testid="questions-screen">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div role="group" aria-label="Question type" className="flex flex-wrap gap-1">
        <button type="button" aria-pressed={!filters.type} onClick={() => set({ type: '' })} data-testid="facet-all" className={cn('min-h-9 rounded-lg border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring', !filters.type ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted')}>All types</button>
        {questionTypes.map(type => (facets && typeCount(type) === 0 && filters.type !== type) ? null :
          <button key={type} type="button" aria-pressed={filters.type === type} onClick={() => set({ type: filters.type === type ? '' : type })} data-testid={`facet-${type}`}
            className={cn('min-h-9 rounded-lg border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring', filters.type === type ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted')}>
            {typeLabel[type]}{facets && <span className="ms-1.5 text-xs text-muted-foreground" data-testid={`facet-count-${type}`}>{typeCount(type)}</span>}
          </button>)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="lg" render={<Link href={importHref} />} data-testid="import-csv"><FileUp aria-hidden="true" />Import CSV</Button>
        <Button variant="outline" size="lg" onClick={() => !coBlocked && setCoOpen(true)} aria-disabled={coBlocked || undefined} aria-describedby={coBlocked ? 'co-reason' : undefined} data-testid="ask-co"
          className={coBlocked ? 'cursor-not-allowed opacity-60' : undefined}><Sparkles aria-hidden="true" />Ask Co to draft</Button>
        <Button size="lg" render={<Link href={newHref} />} data-testid="new-question"><Plus aria-hidden="true" />New question</Button>
      </div>
    </div>
    {coBlocked && <p id="co-reason" data-testid="co-reason" className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">Co drafting is not available for this plan.</span> {coGenerate?.reason ?? 'Co is not available right now.'}</p>}

    {filters.planId && <RecentCoDrafts planId={filters.planId} />}

    <form role="search" aria-label="Filter questions" onSubmit={event => event.preventDefault()} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor="question-search" className="block text-sm font-medium">Search questions</label>
        <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute start-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input id="question-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search the question text" className="h-9 ps-8" maxLength={100} /></div>
      </div>
      <NativeSelect label="Plan" value={filters.planId} onChange={e => set({ planId: e.target.value, topicId: '' })} data-testid="filter-plan">
        <option value="">All my plans</option>{plans.data?.map(plan => <option key={plan.id} value={plan.id}>{plan.title}</option>)}</NativeSelect>
      <NativeSelect label="Topic" value={filters.topicId} onChange={e => set({ topicId: e.target.value })} disabled={!filters.planId} data-testid="filter-topic" hint={filters.planId ? undefined : 'Choose a plan first'}>
        <option value="">All topics</option>{topics.data?.map(topic => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</NativeSelect>
      <NativeSelect label="Difficulty" value={filters.difficulty} onChange={e => set({ difficulty: e.target.value })} data-testid="filter-difficulty">
        <option value="">Any difficulty</option>{difficulties.map(d => <option key={d} value={d}>{difficultyLabel[d]}</option>)}</NativeSelect>
      <NativeSelect label="Source" value={filters.origin} onChange={e => set({ origin: e.target.value })} data-testid="filter-origin">
        <option value="">Any source</option>{questionOrigins.map(o => <option key={o} value={o}>{originLabel[o]}{facets?.origins[o] !== undefined ? ` (${facets.origins[o]})` : ''}</option>)}</NativeSelect>
      <NativeSelect label="Status" value={filters.status} onChange={e => set({ status: e.target.value })} data-testid="filter-status">
        <option value="">Any status</option>{questionStatuses.map(s => <option key={s} value={s}>{statusLabel[s]}{facets?.statuses[s] !== undefined ? ` (${facets.statuses[s]})` : ''}</option>)}</NativeSelect>
      <NativeSelect label="Review" value={filters.reviewState} onChange={e => set({ reviewState: e.target.value })} data-testid="filter-review">
        <option value="">Any</option>{reviewStates.filter(s => s !== 'NONE').map(s => <option key={s} value={s}>{{ PENDING_REVIEW: 'Waiting for my review', ACCEPTED: 'Accepted', EDITED: 'Edited by me', REJECTED: 'Rejected' }[s as 'PENDING_REVIEW']}</option>)}</NativeSelect>
      <label className="flex min-h-9 items-center gap-2 self-end text-sm"><input type="checkbox" checked={filters.flagged} onChange={e => set({ flagged: e.target.checked })} data-testid="filter-flagged" className="size-4" />Only questions with suggestions</label>
    </form>

    {list.isPending && <LoadingBlock label="Loading your questions" />}
    {list.error && (isDenied(list.error)
      ? <InlineAlert testId="questions-denied">You do not have access to the question bank for this school. Choose your school workspace again, or ask your administrator.</InlineAlert>
      : <div className="space-y-3" data-testid="questions-error"><InlineAlert>{isUnavailable(list.error) ? 'The question bank is unavailable right now. Your questions are safe; try again in a moment.' : teachingErrorText(list.error)}</InlineAlert><Button variant="outline" onClick={() => void list.refetch()}>Retry</Button></div>)}
    {list.isSuccess && items.length === 0 && (
      <div className="rounded-xl border border-dashed border-border p-8 text-center" data-testid="questions-empty">
        <h2 className="text-lg font-bold">{filtered ? 'No questions match' : 'Your question bank is empty'}</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{filtered ? 'Try different filters, or clear them to see everything.' : 'Write a question, import a CSV, or ask Co to draft some from your material. You review everything before learners see it.'}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {filtered && <Button variant="outline" size="lg" onClick={() => { setFilters(noFilters); setSearch('') }}>Clear filters</Button>}
          <Button size="lg" render={<Link href={newHref} />}><Plus aria-hidden="true" />Write a question</Button>
        </div>
      </div>
    )}
    {items.length > 0 && <div className="overflow-x-auto rounded-xl border border-border" aria-busy={list.isFetching}>
      <table className="w-full min-w-[56rem] text-sm" data-testid="question-table">
        <caption className="sr-only">Question bank</caption>
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr>
          <th scope="col" className="p-3 text-start">Question</th><th scope="col" className="p-3 text-start">Type</th><th scope="col" className="p-3 text-start">Difficulty</th>
          <th scope="col" className="p-3 text-start">Success rate</th><th scope="col" className="p-3 text-start">Suggestions</th><th scope="col" className="p-3 text-start">Source</th>
        </tr></thead>
        <tbody>{items.map(question => <QuestionRow key={question.id} question={question} onChanged={refresh} />)}</tbody>
      </table>
    </div>}
    {list.hasNextPage && <div className="text-center"><Button variant="outline" size="lg" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>{list.isFetchingNextPage ? 'Loading…' : 'Load more'}</Button></div>}
    {list.isFetchNextPageError && <InlineAlert>More questions could not be loaded. <button type="button" className="underline" onClick={() => void list.fetchNextPage()}>Try again</button></InlineAlert>}
    <p className="text-xs text-muted-foreground">Success rate is measured from learner attempts and appears once five learners who share progress have answered. Suggestions from Co or the duplicate check are advice only and never stop you publishing.</p>
    <CoDraftDialog open={coOpen} onOpenChange={setCoOpen} defaultPlanId={filters.planId} defaultTopicId={filters.topicId} />
  </div>
}
