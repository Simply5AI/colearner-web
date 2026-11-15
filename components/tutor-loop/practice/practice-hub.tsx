'use client'

import { useEffect, useState } from 'react'
import type { QuestionSetView } from '@/lib/api/tutor-loop/practice'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AgeBandScope, Button, ErrorState, Skeleton } from '@/components/design-system'
import { GoalRow, useGoalFilter } from '@/lib/tutor-loop/goal-filter'
import { buildTutorHref } from '@/lib/tutor-loop/open-tutor'
import { formatTutorDate } from '@/lib/tutor-loop/date'
import { useTutorShell } from '@/components/tutor-loop/shell/tutor-shell-context'
import { cn } from '@/lib/utils'
import { isTutorResting } from '@/lib/api/tutor-loop/client'
import {
  newRequestId, questionKindLabels, tutorPracticeApi, tutorQuestionKinds, generationFailureCopy,
  type PracticeTopic, type TutorQuestionKind,
} from '@/lib/api/tutor-loop/practice'
import { ExamPrepTab } from './exam-prep'

export type PracticeTab = 'today' | 'exam'
export const stateLabel: Record<string, string> = {
  NOT_STARTED: 'Not started', LEARNING: 'Learning', PRACTICING: 'Practising', SECURE: 'Secure', MASTERED: 'Mastered', NEEDS_REVIEW: 'Needs review',
}
const tabs: { id: PracticeTab; label: string }[] = [{ id: 'today', label: 'Everyday practice' }, { id: 'exam', label: 'Exam prep' }]

export function TopicSheet({ topicId, goalId, onClose }: { topicId: string; goalId: string | null; onClose: () => void }) {
  const router = useRouter()
  const shell = useTutorShell()
  const [kinds, setKinds] = useState<TutorQuestionKind[]>(['MCQ', 'TRUE_FALSE'])
  const [requestId] = useState(newRequestId)
  const q = useQuery({ queryKey: ['tutor-practice', 'topic', topicId, goalId], queryFn: () => tutorPracticeApi.topic(topicId, goalId), retry: false })
  const [setId, setSetId] = useState<string | null>(null)
  const go = (set: QuestionSetView) => {
    if (set.sessionId && set.status === 'READY') router.push(`/learn/practice/set/${encodeURIComponent(set.sessionId)}${set.questionCount ? `?count=${set.questionCount}` : ''}`)
  }
  const build = useMutation({
    mutationFn: () => tutorPracticeApi.createQuestionSet({ clientRequestId: requestId, topicId, kinds, goalId }),
    onSuccess: (set) => { if (set.sessionId && set.status === 'READY') go(set); else if (set.status === 'QUEUED' || set.status === 'RUNNING') setSetId(set.id) },
  })
  const poll = useQuery({
    queryKey: ['tutor-practice', 'question-set', setId], enabled: !!setId, retry: false,
    queryFn: () => tutorPracticeApi.questionSet(setId!),
    refetchInterval: (qq) => (qq.state.data && ['QUEUED', 'RUNNING'].includes(qq.state.data.status) ? 2000 : false),
  })
  useEffect(() => { if (poll.data?.status === 'READY') go(poll.data) })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const data: PracticeTopic | undefined = q.data
  const material = data?.materials[0]
  const tutorCtx = material ? ({ kind: 'MATERIAL', materialId: material.id } as const) : ({ kind: 'GLOBAL' } as const)
  const toggle = (k: TutorQuestionKind) => setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]))
  const live = poll.data ?? build.data
  const waiting = !!live && (live.status === 'QUEUED' || live.status === 'RUNNING') && !poll.isError
  const setFailed = build.error || poll.isError || (live && (live.status === 'FAILED' || live.status === 'CANCELLED'))
  return <div role="dialog" aria-modal="true" aria-label={data?.topic.title ?? 'Topic'} className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
    <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-background p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-start justify-between gap-3">
        <div>
          {data && <span className="text-xs font-bold text-muted-foreground">{stateLabel[data.topic.state] ?? data.topic.state}</span>}
          <h2 className="text-xl font-black">{data?.topic.title ?? 'Loading topic'}</h2>
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className="min-h-10 min-w-10 rounded-full border">×</button>
      </div>
      {q.isPending && <Skeleton className="mt-4 h-24" />}
      {q.isError && <ErrorState title="This topic did not load" description="Check your connection and try again." action={<Button onClick={() => q.refetch()}>Try again</Button>} />}
      {data && <>
        {data.inShort && <section className="mt-4 rounded-2xl bg-muted p-4 text-sm" aria-label="In short">
          <p><b>In short:</b> {data.inShort.text}</p>
          {data.example && <p className="mt-2"><b>Example:</b> {data.example.text}</p>}
          <p className="mt-2 text-xs font-bold text-muted-foreground">{data.inShort.source === 'MATERIAL' ? (data.inShort.citation?.label ?? 'From your material') : 'Not from your material'}</p>
        </section>}
        <h3 className="mt-5 text-sm font-black">How do you want to learn this?</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {shell.canUseTutor
            ? <Link className="rounded-2xl border p-3 text-sm hover:border-[var(--color-accent)]" href={buildTutorHref(tutorCtx, { mode: 'EXPLAIN' })}><b>Learn with {shell.tutorName}</b><br /><span className="text-muted-foreground">Ask, get examples, go at your pace</span></Link>
            : <span className="rounded-2xl border p-3 text-sm opacity-70"><b>{shell.tutorName} is away</b><br />Not available right now</span>}
          {material
            ? <Link className="rounded-2xl border p-3 text-sm hover:border-[var(--color-accent)]" href={`/learn/lesson/new?materialId=${encodeURIComponent(material.id)}&topicId=${encodeURIComponent(topicId)}&format=short`}><b>Short lesson</b><br /><span className="text-muted-foreground">4 cards · about 5 min</span></Link>
            : <span className="rounded-2xl border p-3 text-sm opacity-70"><b>Short lesson</b><br />Add material for this topic first</span>}
          {shell.canUseTutor && <Link className="rounded-2xl border p-3 text-sm hover:border-[var(--color-accent)]" href={buildTutorHref(tutorCtx, { mode: 'BRIEF' })}><b>More examples</b><br /><span className="text-muted-foreground">A short brief with worked examples</span></Link>}
        </div>
        <section className="mt-5" aria-label="Question set">
          <h3 className="text-sm font-black">Question set</h3>
          <p className="text-sm text-muted-foreground">Pick the kinds of questions you want.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {tutorQuestionKinds.map((k) => <button key={k} type="button" aria-pressed={kinds.includes(k)} onClick={() => toggle(k)}
              className={cn('min-h-10 rounded-full border px-3 text-sm font-bold', kinds.includes(k) && 'border-[var(--color-accent)] bg-[var(--color-accent-100)]')}>{questionKindLabels[k]}</button>)}
          </div>
          <Button className="mt-3" disabled={kinds.length === 0} loading={build.isPending} onClick={() => build.mutate()}>Start questions</Button>
          <div role="status" aria-live="polite" className="mt-2 text-sm">
            {waiting && <span>{shell.tutorName} is writing your questions…</span>}
            {setFailed && <span>{build.error && isTutorResting(build.error) ? generationFailureCopy('AI_UNAVAILABLE') : generationFailureCopy(live?.reasonCode ?? null)} <button type="button" className="font-bold underline" onClick={() => { setSetId(null); build.mutate() }}>Try again</button></span>}
          </div>
        </section>
      </>}
    </div>
  </div>
}

export function PracticeHub({ initialTab = 'today', initialTopicId = null }: { initialTab?: PracticeTab; initialTopicId?: string | null }) {
  const shell = useTutorShell()
  const filter = useGoalFilter()
  const [tab, setTab] = useState<PracticeTab>(initialTab)
  const [topicId, setTopicId] = useState<string | null>(initialTopicId)
  const q = useQuery({ queryKey: ['tutor-practice', 'hub', filter.goalId], queryFn: () => tutorPracticeApi.practice(filter.goalId), retry: false })
  const data = q.data
  const goal = data?.goalCards.find((g) => g.id === filter.goalId) ?? null
  return <AgeBandScope band={shell.band} className="mx-auto w-full max-w-[1000px] space-y-4 px-4 pb-24 pt-6 sm:px-6">
    <h1 className="text-2xl font-black">Practice</h1>
    <GoalRow goals={shell.goals} selectedGoalId={filter.goalId} onSelectGoal={filter.setGoalId} />
    <div role="tablist" aria-label="Practice" className="inline-flex gap-0.5 rounded-full bg-muted p-1">
      {tabs.map((t) => <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
        className={cn('min-h-10 rounded-full px-4 text-sm font-bold', tab === t.id ? 'bg-background shadow-sm' : 'text-muted-foreground')}>{t.label}</button>)}
    </div>
    {q.isPending && <div aria-busy="true" aria-label="Loading practice"><Skeleton className="h-24" /></div>}
    {q.isError && <ErrorState title="Practice did not load" description="Check your connection and try again." action={<Button onClick={() => q.refetch()}>Try again</Button>} />}
    {data && tab === 'today' && <>
      {data.topics.length === 0 && <p className="rounded-2xl border p-4 text-sm">No topics for this goal yet. Add material and they will show up here.</p>}
      {goal?.dueDate && <p className="text-sm text-muted-foreground">{goal.title} · due {formatTutorDate(goal.dueDate)}</p>}
      <section aria-label="Today's review" className="rounded-2xl border p-4">
        <b>Today’s review</b>
        <p className="text-sm text-muted-foreground">{data.dueReview.itemCount > 0 ? `${data.dueReview.itemCount} questions due · about ${data.dueReview.estimatedMinutes} min` : 'Nothing due today.'}</p>
      </section>
      <section aria-label="Practise a topic"><h2 className="text-sm font-black">Practise a topic</h2>
        <div className="mt-2 flex flex-wrap gap-2">{data.topics.filter((t) => !t.archived).map((t) =>
          <button key={t.id} type="button" onClick={() => setTopicId(t.id)} className="min-h-10 rounded-full border px-3 text-sm font-bold">
            <span className="sr-only">{stateLabel[t.state] ?? t.state}: </span>{t.title}</button>)}</div>
      </section>
      <section aria-label="Recent"><h2 className="text-sm font-black">Recent</h2>
        {data.recentSessions.length === 0 && <p className="text-sm text-muted-foreground">Nothing yet. Your sessions will show here.</p>}
        <ul className="mt-2 space-y-2">{data.recentSessions.map((s) => <li key={s.sessionId} className="flex justify-between rounded-2xl border p-3 text-sm">
          <span><b>{s.kind === 'MOCK' ? 'Mock exam' : data.topics.find((topic) => topic.id === s.topicId)?.title ?? 'Practice'}</b> · {formatTutorDate(s.startedAt.slice(0, 10))}</span>
          {s.kind === 'MOCK' && s.completedAt ? <Link className="font-bold underline" href={`/learn/practice/mock/${encodeURIComponent(s.sessionId)}/result`}>Result</Link> : <span>{s.itemCount} questions</span>}
        </li>)}</ul>
      </section>
    </>}
    {data && tab === 'exam' && <ExamPrepTab goalId={filter.goalId} practice={data} />}
    {topicId && <TopicSheet topicId={topicId} goalId={filter.goalId} onClose={() => setTopicId(null)} />}
  </AgeBandScope>
}
