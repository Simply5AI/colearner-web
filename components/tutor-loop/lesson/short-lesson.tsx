'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Button, ErrorState, Skeleton } from '@/components/design-system'
import { generationFailureCopy, tutorPracticeApi, type ShortLessonCard } from '@/lib/api/tutor-loop/practice'
import { buildTutorHref } from '@/lib/tutor-loop/open-tutor'
import { useTutorShell } from '@/components/tutor-loop/shell/tutor-shell-context'
import { cn } from '@/lib/utils'

const tag: Record<string, string> = { IDEA: 'The idea', EXAMPLE: 'Example', WATCH_OUT: 'Watch out', CHECK: 'Try it' }

/** TL13: four cards (idea, example, watch out, check), then "Lesson done" with a measured next step. */
export function ShortLessonScreen({ lessonId }: { lessonId: string }) {
  const shell = useTutorShell()
  const q = useQuery({
    queryKey: ['tutor-lesson', lessonId], retry: false, queryFn: () => tutorPracticeApi.shortLesson(lessonId),
    refetchInterval: (s) => (s.state.data && ['QUEUED', 'RUNNING'].includes(s.state.data.status) ? 2500 : false),
  })
  const [i, setI] = useState(0)
  const [pick, setPick] = useState<{ id: string; ok: boolean } | null>(null)
  const check = useMutation({
    mutationFn: (v: { optionId: string }) => tutorPracticeApi.checkLesson(lessonId, v.optionId),
    onSuccess: (r, v) => setPick({ id: v.optionId, ok: r.correct }),
  })
  const next = useQuery({ queryKey: ['tutor-lesson', 'next', lessonId], enabled: q.data?.status === 'READY' && i >= (q.data?.cards.length ?? 99), queryFn: () => tutorPracticeApi.nextStep('LESSON', lessonId), retry: false })
  const done = useMutation({ mutationFn: () => tutorPracticeApi.completeLesson(lessonId) })

  if (q.isPending) return <div className="mx-auto max-w-2xl p-6" aria-busy="true"><Skeleton className="h-48" /></div>
  if (q.isError) return <div className="mx-auto max-w-2xl p-6"><ErrorState title="This lesson did not load" description="Try again." action={<Button onClick={() => q.refetch()}>Try again</Button>} /></div>
  const l = q.data
  if (l.status === 'QUEUED' || l.status === 'RUNNING') return <div role="status" className="mx-auto max-w-2xl p-6">{shell.tutorName} is writing your lesson…</div>
  if (l.status !== 'READY') return <div className="mx-auto max-w-2xl p-6"><ErrorState title={`${shell.tutorName} is resting`} description={generationFailureCopy(l.reasonCode)} action={<Link className="font-bold underline" href="/learn/practice">Back to Practice</Link>} /></div>
  const cards: ShortLessonCard[] = l.cards
  const n = cards.length
  const end = i >= n
  if (end) {
    const a = next.data?.briefing.action
    return <div className="mx-auto w-full max-w-xl space-y-4 px-4 pb-24 pt-8 text-center">
      <h1 className="text-3xl font-black">Lesson done</h1>
      <ul className="text-start text-sm">{cards.filter((c) => c.kind !== 'CHECK').map((c, k) => <li key={k}>✓ {'text' in c ? c.text : ''}</li>)}</ul>
      <section className="rounded-2xl bg-[var(--color-accent-100)] p-4 text-start"><p className="font-black">{a?.label ?? 'Practise this topic'}</p>
        <p className="text-sm">Practising soon after helps it stick.</p>
        <Link className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-[var(--color-accent-600)] px-4 font-bold text-white" href={a?.targetId ? `/learn/practice?topicId=${encodeURIComponent(a.targetId)}` : '/learn/practice'}>Practise</Link></section>
      <Link className="font-bold underline" href="/learn/today">Done for today</Link>
    </div>
  }
  const c = cards[i]!
  const isCheck = c.kind === 'CHECK'
  const locked = isCheck && !pick?.ok
  const goNext = () => {
    if (i === n - 1) { done.mutate(undefined, { onSuccess: () => { setPick(null); setI(i + 1) } }); return }
    setPick(null); setI(i + 1)
  }
  return <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 pb-32 pt-6">
    <div className="flex items-center gap-3"><Link aria-label="Close lesson" href="/learn/practice" className="grid h-10 w-10 place-items-center rounded-full border">×</Link>
      <div role="progressbar" aria-valuemin={1} aria-valuemax={n} aria-valuenow={i + 1} aria-label={`${i + 1} of ${n}`} className="flex flex-1 gap-1.5">{cards.map((_, k) => <span key={k} className={cn('h-2 flex-1 rounded-full', k <= i ? 'bg-[var(--color-accent)]' : 'bg-muted')} />)}</div>
      <b className="text-sm">{i + 1} of {n}</b></div>
    <main className="mt-6 space-y-3">
      <span className="rounded-full bg-muted px-3 py-1 text-xs font-black">{tag[c.kind]}</span>
      {c.kind === 'CHECK' ? <>
        <h1 className="text-2xl font-black">{c.prompt}</h1>
        <div role="radiogroup" aria-label="Choose one" className="space-y-2">{c.options.map((o) => <button key={o.id} role="radio" aria-checked={pick?.id === o.id} type="button" disabled={check.isPending || pick?.ok}
          onClick={() => check.mutate({ optionId: o.id })} className={cn('flex min-h-14 w-full items-center justify-between rounded-2xl border-2 px-4 text-start', pick?.id === o.id && (pick.ok ? 'border-green-600 bg-green-50' : 'border-dashed'))}>
          <span>{o.text}</span><span className="text-xs font-bold">{pick?.id === o.id ? (pick.ok ? 'Right' : 'Not this one') : ''}</span></button>)}</div>
        <p role="status" aria-live="polite" className="text-sm">{pick?.ok ? 'Yes. That is the idea.' : pick ? 'Not quite. Look at the example again, then try once more.' : ''}{check.isError ? 'We could not check that. Try again.' : ''}{done.isError ? (((done.error as { code?: string }).code === 'CHECK_REQUIRED') ? 'Answer the question correctly first.' : 'We could not finish the lesson. Try again.') : ''}</p>
      </> : <>
        <p className="text-xl leading-relaxed">{c.text}</p>
        {c.citation && <span className="inline-flex rounded-full border px-3 py-1 text-xs font-bold">{c.citation.label}</span>}
      </>}
    </main>
    <div className="fixed inset-x-0 bottom-0 border-t bg-background p-3"><div className="mx-auto flex max-w-2xl justify-between gap-2">
      <Button variant="ghost" disabled={i === 0} onClick={() => { setPick(null); setI(i - 1) }}>Back</Button>
      {shell.canUseTutor && <Link className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-bold" href={buildTutorHref({ kind: 'LESSON', lessonId, stepIndex: i }, { mode: 'EXPLAIN_DIFFERENTLY' })}>I don’t get it</Link>}
      <Button disabled={locked} loading={done.isPending} onClick={goNext}>{i === n - 1 ? 'Finish' : 'Next'}</Button></div></div>
  </div>
}
