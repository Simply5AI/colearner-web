'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, ErrorState, Skeleton } from '@/components/design-system'
import { QuestionRenderer } from '@/components/practice/questions/question-renderer'
import { buildAnswer, draftFromAnswer, initialDraft, type Draft } from '@/components/practice/questions/answers'
import { kindInstruction, kindName } from '@/components/practice/session/session-model'
import { useTutorShell } from '@/components/tutor-loop/shell/tutor-shell-context'
import { formatClock, newRequestId, secondsLeft, tutorPracticeApi, type MockItem, type MockSitting } from '@/lib/api/tutor-loop/practice'
import { tutorIconSrc } from '@/components/tutor-loop/shell/tutor-shell-context'
import { cn } from '@/lib/utils'

/** TL11: the sitting. Server owns the deadline; autosave retries the same revision; no pause; tutor is away. */
export function MockSittingScreen({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const qc = useQueryClient()
  const shell = useTutorShell()
  const sittingQ = useQuery({ queryKey: ['tutor-practice', 'sitting', sessionId], queryFn: () => tutorPracticeApi.sitting(sessionId), retry: false, refetchOnWindowFocus: false })
  const readAt = useRef(0)
  const [now, setNow] = useState(0)
  const [index, setIndex] = useState(0)
  const [offline, setOffline] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [nav, setNav] = useState<MockSitting['navigator']>([])
  const submitId = useRef(newRequestId())
  const sitting = sittingQ.data

  useEffect(() => { if (sitting) { readAt.current = Date.now(); setNav(sitting.navigator); setNow(0) } }, [sitting])
  useEffect(() => {
    if (!sitting?.deadlineAt) return
    const t = setInterval(() => setNow(Date.now() - readAt.current), 1000)
    return () => clearInterval(t)
  }, [sitting])
  const left = sitting ? secondsLeft(sitting, now) : null

  const submit = useCallback(async () => {
    if (submitting) return
    setSubmitting(true); setSubmitError(null)
    try {
      await tutorPracticeApi.submitMock(sessionId, submitId.current)
      router.push(`/learn/practice/mock/${encodeURIComponent(sessionId)}/result`)
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'DEADLINE_PASSED' || (e as { status?: number }).status === 409) router.push(`/learn/practice/mock/${encodeURIComponent(sessionId)}/result`)
      else { setSubmitError('We could not send your mock. Your answers are saved. Try again.'); setSubmitting(false) }
    }
  }, [router, sessionId, submitting])

  useEffect(() => { if (sitting?.status === 'SUBMITTED') router.replace(`/learn/practice/mock/${encodeURIComponent(sessionId)}/result`) }, [sitting?.status, router, sessionId])
  useEffect(() => { if (left === 0 && sitting?.status === 'IN_PROGRESS') void submit() }, [left, sitting?.status, submit])
  useEffect(() => { void qc })

  if (sittingQ.isPending) return <div className="tutor-frame py-6" aria-busy="true"><Skeleton className="h-40" /></div>
  if (sittingQ.isError || !sitting) return <div className="tutor-frame py-6"><ErrorState title="This mock did not load" description="Your clock keeps running on our side. Try again." action={<Button onClick={() => sittingQ.refetch()}>Try again</Button>} /></div>
  const answered = nav.filter((n) => n.answered).length
  const low = left != null && left <= 60
  return <div className="tutor-frame pb-8 pt-4" data-testid="mock-sitting">
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background py-3">
      <div className="flex-1 text-sm font-bold">Question {index + 1} of {sitting.itemCount} · {answered} answered</div>
      <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
        <img src={tutorIconSrc(shell.tutorIcon, 'resting')} alt="" className="h-6 w-6" />{shell.tutorName} is away until you finish</span>
      {left != null && <span role="timer" aria-label={`${Math.ceil(left / 60)} minutes left`} className={cn('rounded-full px-3 py-1 font-mono text-sm font-black', low ? 'bg-red-100 text-red-800' : 'bg-muted')}>{formatClock(left)}</span>}
    </header>
    <p className="mt-2 text-xs text-muted-foreground">{sitting.conditions ? 'Exam conditions: no hints, no answers until you finish. You cannot pause.' : 'Practice simulation: timed, no pause, answers shown after you finish.'}</p>
    {offline && <p role="alert" className="mt-2 rounded-xl bg-amber-100 p-2 text-sm text-amber-900">Reconnecting… Your answers are kept here and will save again. The clock is not affected.</p>}
    <div role="status" aria-live="polite" className="sr-only">{low ? 'Less than a minute left' : ''}</div>
    <SittingItem key={index} sessionId={sessionId} index={index} total={sitting.itemCount} onOffline={setOffline}
      onSaved={(i, ans, fl) => setNav((cur) => cur.map((n) => (n.index === i ? { ...n, answered: ans ?? n.answered, flagged: fl ?? n.flagged } : n)))} />
    <nav aria-label="Question navigator" className="mt-4 flex flex-wrap gap-1.5">
      {nav.map((n) => <button key={n.index} type="button" aria-current={n.index === index ? 'step' : undefined} onClick={() => setIndex(n.index)}
        aria-label={`Question ${n.index + 1}${n.answered ? ', answered' : ''}${n.flagged ? ', flagged' : ''}`}
        className={cn('relative min-h-10 min-w-10 rounded-lg border text-sm font-bold', n.index === index && 'ring-2 ring-[var(--color-accent)]', n.answered && 'bg-[var(--color-accent-100)]')}>
        {n.index + 1}{n.flagged && <span aria-hidden="true" className="absolute -end-1 -top-1 text-xs">⚑</span>}</button>)}
    </nav>
    <div className="mt-5 border-t bg-background py-3"><div className="flex flex-wrap justify-between gap-2">
      <Button variant="ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}>Back</Button>
      {index < sitting.itemCount - 1 ? <Button onClick={() => setIndex(index + 1)}>Next</Button> : <Button onClick={() => setConfirm(true)}>Finish</Button>}
      <Button variant="secondary" onClick={() => setConfirm(true)}>Submit mock</Button></div></div>
    {confirm && <div role="alertdialog" aria-modal="true" aria-label="Submit your mock" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-background p-5"><h2 className="text-lg font-black">Submit your mock?</h2>
        <p className="mt-1 text-sm">{sitting.itemCount - answered > 0 ? `${sitting.itemCount - answered} questions are blank and will score 0.` : 'All questions are answered.'} You cannot change answers after this.</p>
        {submitError && <p role="alert" className="mt-2 text-sm">{submitError}</p>}
        <div className="mt-3 flex gap-2"><Button loading={submitting} onClick={() => void submit()}>Submit</Button><Button variant="ghost" onClick={() => setConfirm(false)}>Keep going</Button></div></div></div>}
  </div>
}

function SittingItem({ sessionId, index, total, onOffline, onSaved }: {
  sessionId: string; index: number; total: number; onOffline: (v: boolean) => void; onSaved: (i: number, answered?: boolean, flagged?: boolean) => void
}) {
  const q = useQuery({ queryKey: ['tutor-practice', 'mock-item', sessionId, index], queryFn: () => tutorPracticeApi.mockItem(sessionId, index), retry: false, refetchOnWindowFocus: false, staleTime: Infinity })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [flagged, setFlagged] = useState(false)
  const revision = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const promptId = useId(); const instructionId = useId(); const idPrefix = useId()
  const item: MockItem | undefined = q.data
  useEffect(() => {
    if (!item) return
    revision.current = item.draft.revision
    setFlagged(item.draft.flagged)
    setDraft((item.draft.answer ? draftFromAnswer(item.question, item.draft.answer as never) : null) ?? initialDraft(item.question))
  }, [item])

  const save = useCallback(async (body: { answer?: ReturnType<typeof buildAnswer>; flagged?: boolean }, attempt = 0): Promise<void> => {
    try {
      const r = await tutorPracticeApi.saveMockItem(sessionId, index, { revision: revision.current, ...body })
      revision.current = r.revision
      onOffline(false)
      onSaved(index, r.answer != null, r.flagged)
    } catch (e) {
      const status = (e as { status?: number }).status
      if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) { onOffline(false); return }
      onOffline(true)
      if (attempt < 8) setTimeout(() => void save(body, attempt + 1), Math.min(10000, 1000 * 2 ** attempt))
    }
  }, [sessionId, index, onOffline, onSaved])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  if (q.isPending) return <Skeleton className="mt-4 h-40" />
  if (q.isError || !item || !draft) return <ErrorState title="This question did not load" description="Try again." action={<Button onClick={() => q.refetch()}>Try again</Button>} />
  const onDraft = (d: Draft) => {
    setDraft(d)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { const a = buildAnswer(item.question, d); if (a) void save({ answer: a }) }, 600)
  }
  const toggleFlag = () => { const next = !flagged; setFlagged(next); void save({ flagged: next }) }
  return <section className="mt-4 space-y-3" aria-label={`Question ${index + 1} of ${total}`}>
    <span className="text-xs font-bold text-muted-foreground">{kindName[item.question.kind]}</span>
    <h1 id={promptId} className="text-xl font-black">{item.question.prompt}</h1>
    <p id={instructionId} className="text-sm text-muted-foreground">{kindInstruction(item.question, 'teens')}</p>
    <QuestionRenderer question={item.question} draft={draft} onDraft={onDraft} band="teens" locked={false} marks={null} tried={[]} announce={() => {}} idPrefix={idPrefix} promptId={promptId} instructionId={instructionId} />
    <button type="button" aria-pressed={flagged} onClick={toggleFlag} className={cn('min-h-10 rounded-full border px-3 text-sm font-bold', flagged && 'bg-amber-100')}>{flagged ? 'Flagged to come back' : 'Flag for later'}</button>
  </section>
}
