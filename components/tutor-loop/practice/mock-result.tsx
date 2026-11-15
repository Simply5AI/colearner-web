'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Button, ErrorState, Skeleton } from '@/components/design-system'
import { buildTutorHref } from '@/lib/tutor-loop/open-tutor'
import { useTutorShell } from '@/components/tutor-loop/shell/tutor-shell-context'
import { tutorPracticeApi, type MockResult } from '@/lib/api/tutor-loop/practice'
import { formatTutorDate } from '@/lib/tutor-loop/date'

const actionHref = (a: MockResult['suggestedActions'][number]) =>
  a.kind === 'PRACTICE' && a.targetId ? `/learn/practice?topicId=${encodeURIComponent(a.targetId)}` : a.targetId ? `/learn/practice?topicId=${encodeURIComponent(a.targetId)}` : '/learn/practice'

/** TL12: result vs last mock and pass mark, by topic, up to three actions, add to schedule (confirmed preview). */
export function MockResultScreen({ sessionId }: { sessionId: string }) {
  const shell = useTutorShell()
  const q = useQuery({
    queryKey: ['tutor-practice', 'mock-result', sessionId], retry: false,
    queryFn: () => tutorPracticeApi.mockResult(sessionId),
    refetchInterval: (s) => (s.state.data?.status === 'MARKING_PENDING' ? 4000 : false),
  })
  const [open, setOpen] = useState(false)
  const preview = useMutation({ mutationFn: () => tutorPracticeApi.revisionPreview(sessionId, q.data?.revision ?? 0), onSuccess: () => setOpen(true) })
  const apply = useMutation({ mutationFn: (id: string) => tutorPracticeApi.applySchedulePreview(id), onSuccess: () => setOpen(false) })
  if (q.isPending) return <div className="mx-auto max-w-2xl p-6" aria-busy="true"><Skeleton className="h-40" /></div>
  if (q.isError) return <div className="mx-auto max-w-2xl p-6"><ErrorState title="Your result did not load" description="Your answers are saved. Try again." action={<Button onClick={() => q.refetch()}>Try again</Button>} /></div>
  const r = q.data
  const pending = r.status !== 'FULLY_MARKED'
  return <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-24 pt-6">
    <section className="rounded-3xl border p-5 text-center" aria-label="Result">
      <h1 className="text-2xl font-black">{pending ? 'Partly marked' : 'Mock done'}</h1>
      {r.scorePercent != null ? <p className="mt-1 text-4xl font-black">{r.scorePercent}%</p>
        : <p role="status" className="mt-1 text-sm">{r.ungradedItemCount} written {r.ungradedItemCount === 1 ? 'answer is' : 'answers are'} still being marked. Your score appears when every answer is marked.</p>}
      <p className="text-sm text-muted-foreground">{r.gradedItemCount} of {r.itemCount} marked · {formatTutorDate(r.submittedAt.slice(0, 10))}</p>
      {r.passMarkPercent != null && r.scorePercent != null && <p className="text-sm font-bold">Pass mark {r.passMarkPercent}% · {r.scorePercent >= r.passMarkPercent ? 'Above the pass mark' : 'Below the pass mark'}</p>}
      {r.priorMockPercent != null && r.scorePercent != null && <p className="text-sm">Last mock {r.priorMockPercent}% · {r.scorePercent - r.priorMockPercent >= 0 ? '+' : ''}{r.scorePercent - r.priorMockPercent} points</p>}
      {r.readinessDeltaPercent != null && <p className="text-xs text-muted-foreground">Measured readiness change: {r.readinessDeltaPercent >= 0 ? '+' : ''}{r.readinessDeltaPercent}%</p>}
    </section>
    <section aria-label="By topic"><h2 className="text-sm font-black">By topic</h2><ul className="mt-2 space-y-2">
      {r.byTopic.map((t) => <li key={t.topicId} className="rounded-2xl border p-3 text-sm"><div className="flex justify-between"><b>{t.label}</b><span>{t.scorePoints} of {t.itemCount}{t.ungradedCount ? ` · ${t.ungradedCount} unmarked` : ''}</span></div>
        <div className="mt-1 h-2 rounded-full bg-muted" aria-hidden="true"><div className="h-2 rounded-full bg-[var(--color-accent)]" style={{ width: `${t.itemCount ? Math.round((100 * t.scorePoints) / t.itemCount) : 0}%` }} /></div></li>)}</ul></section>
    {r.suggestedActions.length > 0 && <section aria-label="What next"><h2 className="text-sm font-black">{shell.tutorName}’s suggestions</h2>
      <ul className="mt-2 space-y-2">{r.suggestedActions.slice(0, 3).map((a, i) => <li key={`${a.kind}-${i}`}><Link className="flex justify-between rounded-2xl border p-3 text-sm font-bold hover:border-[var(--color-accent)]" href={actionHref(a)}><span>{a.label}</span><span>{a.minutes} min</span></Link></li>)}</ul></section>}
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" loading={preview.isPending} disabled={pending} onClick={() => preview.mutate()}>Add to my week</Button>
      {shell.canUseTutor && <Link className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-bold" href={buildTutorHref({ kind: 'MOCK_RESULT', sessionId }, { mode: 'EXPLAIN' })}>Go over it with {shell.tutorName}</Link>}
      <Link className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-bold" href={`/learn/practice/mock/${encodeURIComponent(sessionId)}/review`}>Review answers</Link>
      <Link className="inline-flex min-h-11 items-center px-4 text-sm font-bold underline" href="/learn/practice?tab=exam">Done for today</Link>
    </div>
    {preview.error && <p role="alert" className="text-sm">We could not prepare that change. Try again.</p>}
    {open && preview.data && <div role="dialog" aria-modal="true" aria-label="Add to my week" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><div className="w-full max-w-md rounded-2xl bg-background p-5">
      <h2 className="text-lg font-black">Add to my week</h2>
      {preview.data.changes.length === 0 ? <p className="text-sm">Nothing needs to move.</p> : <ul className="mt-2 text-sm">{preview.data.changes.map((c) => <li key={c.itemId}>{c.from ? formatTutorDate(c.from) : 'New'} to {c.to ? formatTutorDate(c.to) : 'removed'}</li>)}</ul>}
      {!preview.data.canApply && <p className="mt-2 text-sm">Your schedule can not take this change right now.</p>}
      {apply.error && <p role="alert" className="mt-2 text-sm">That change is out of date. Preview it again.</p>}
      <div className="mt-3 flex gap-2"><Button disabled={!preview.data.canApply} loading={apply.isPending} onClick={() => apply.mutate(preview.data.id)}>Confirm</Button><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div></div></div>}
  </div>
}
