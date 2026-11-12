'use client'

import { useEffect, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MeasuredTag, NativeSelect } from '@/components/teacher/plans/fields'
import { EmptyBlock, FailureBlock, LoadingBlock } from '@/components/teacher/worksheets/states'
import { useB13Apis, type PlanTopic } from '@/components/teacher/worksheets/use-b13-apis'
import { typeLabel } from '@/lib/api/teaching/question-imports'
import { difficultyLabel, type BankQuestion } from '@/lib/api/teaching/worksheets'

const TYPES = ['MCQ', 'MULTI_SELECT', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'LONG_ANSWER', 'CODE', 'PICTURE_CHOICE', 'ORDERING'] as const

/** Published questions of this plan only. Rows carry no answer key. The success rate is measured and shown only when the server sends one. */
export function WorksheetBankPicker({ planId, topics, addedIds, disabledReason, onAdd }: {
  planId: string; topics: PlanTopic[]; addedIds: Set<string>; disabledReason: string | null; onAdd: (question: BankQuestion) => void
}) {
  const apis = useB13Apis()
  const [topicId, setTopicId] = useState('')
  const [type, setType] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => { const handle = setTimeout(() => setQ(text.trim()), 300); return () => clearTimeout(handle) }, [text])

  const query = useInfiniteQuery({
    queryKey: ['b13', apis.schoolId, 'bank', planId, topicId, type, difficulty, q],
    queryFn: ({ pageParam }) => apis.worksheets.bank(planId, { topicId, type, difficulty, q, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.nextCursor ?? undefined,
    retry: false, staleTime: 0, refetchOnWindowFocus: false,
  })
  const items = query.data?.pages.flatMap(page => page.items) ?? []

  return <section aria-labelledby="ws-bank-title" className="space-y-3 rounded-xl border border-border bg-card p-4" data-testid="ws-bank">
    <h3 id="ws-bank-title" className="text-base font-bold">Add published questions</h3>
    <div className="grid gap-2 sm:grid-cols-2">
      <NativeSelect label="Topic" value={topicId} onChange={event => setTopicId(event.target.value)} data-testid="bank-topic">
        <option value="">All topics</option>{topics.map(topic => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
      </NativeSelect>
      <NativeSelect label="Type" value={type} onChange={event => setType(event.target.value)} data-testid="bank-type">
        <option value="">All types</option>{TYPES.map(value => <option key={value} value={value}>{typeLabel[value]}</option>)}
      </NativeSelect>
      <NativeSelect label="Difficulty" value={difficulty} onChange={event => setDifficulty(event.target.value)} data-testid="bank-difficulty">
        <option value="">Any difficulty</option>{Object.entries(difficultyLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </NativeSelect>
      <div className="space-y-1.5"><label htmlFor="bank-search" className="block text-sm font-medium">Search</label>
        <input id="bank-search" type="search" value={text} onChange={event => setText(event.target.value)} data-testid="bank-search" className="h-9 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-base md:text-sm" /></div>
    </div>
    {disabledReason && <p className="text-sm text-muted-foreground" data-testid="bank-disabled-reason">{disabledReason}</p>}
    {query.isPending && <LoadingBlock label="Loading questions" testId="bank-loading" />}
    {query.isError && <FailureBlock error={query.error} onRetry={() => void query.refetch()} subject="the question bank" testId="bank-failure" />}
    {query.isSuccess && items.length === 0 && <EmptyBlock testId="bank-empty" title="No published questions match">{topicId || type || difficulty || q ? 'Clear a filter to see more. ' : ''}Only published questions can go on a worksheet. Publish questions in the question bank first.</EmptyBlock>}
    {items.length > 0 && <ul className="max-h-[32rem] space-y-2 overflow-y-auto pe-1" aria-label="Published questions" data-testid="bank-list">
      {items.map(question => {
        const added = addedIds.has(question.id)
        return <li key={question.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3" data-testid="bank-item" data-question={question.id}>
          <div className="min-w-0 space-y-1 text-sm">
            <p className="break-words">{question.promptPreview}</p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{typeLabel[question.type] ?? question.type}</span>{question.difficulty && <span>· {difficultyLabel[question.difficulty]}</span>}{question.topicTitle && <span>· {question.topicTitle}</span>}
              {question.authorOnly && <span className="rounded-full border border-border px-1.5">Print only: not shown to learners</span>}
              {question.successRate && <span className="inline-flex items-center gap-1"><MeasuredTag />{Math.round(question.successRate.value * 100)}% correct ({question.successRate.attempts} attempts)</span>}
            </p>
          </div>
          <Button type="button" variant={added ? 'ghost' : 'outline'} size="lg" disabled={added || disabledReason !== null} aria-disabled={added || disabledReason !== null}
            onClick={() => onAdd(question)} aria-label={added ? 'Already on the worksheet' : `Add to worksheet: ${question.promptPreview.slice(0, 60)}`} data-testid="bank-add">
            {added ? 'Added' : <><Plus aria-hidden="true" />Add</>}
          </Button>
        </li>
      })}
    </ul>}
    {query.hasNextPage && <Button variant="outline" size="lg" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage} data-testid="bank-more">{query.isFetchingNextPage ? 'Loading' : 'Show more'}</Button>}
  </section>
}
