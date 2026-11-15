'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Button, ErrorState, Skeleton } from '@/components/design-system'
import { QuestionRenderer } from '@/components/practice/questions/question-renderer'
import { buildAnswer, initialDraft, type Draft } from '@/components/practice/questions/answers'
import { kindInstruction, kindName } from '@/components/practice/session/session-model'
import { useTutorShell } from '@/components/tutor-loop/shell/tutor-shell-context'
import { buildTutorHref } from '@/lib/tutor-loop/open-tutor'
import { newRequestId, tutorPracticeApi, type Confidence, type PracticeAnswerReceipt } from '@/lib/api/tutor-loop/practice'
import { cn } from '@/lib/utils'

const confs: { id: Confidence; label: string }[] = [{ id: 'SURE', label: 'Sure' }, { id: 'SOMEWHAT', label: 'Somewhat' }, { id: 'GUESSING', label: 'Guessing' }]

/** TL10 session for one set: question label, hint then retry, "How sure are you?", and a summary with a measured next step. */
export function PracticeSetScreen({ sessionId, total: knownTotal = null }: { sessionId: string; total?: number | null }) {
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<boolean[]>([])
  const [done, setDone] = useState(false)
  const finish = useMutation({ mutationFn: () => tutorPracticeApi.finish(sessionId), onSuccess: () => setDone(true) })
  if (done) return <Summary sessionId={sessionId} results={results} />
  return <div className="mx-auto w-full max-w-2xl space-y-3 px-4 pb-24 pt-6">
    <p className="text-sm font-bold" role="status">Question {index + 1}</p>
    <PracticeItem key={index} sessionId={sessionId} index={index}
      onNext={(correct, last) => { setResults((r) => [...r, correct]); if (last) finish.mutate(); else setIndex(index + 1) }} onMissing={() => finish.mutate()} limit={knownTotal} />
    {finish.isError && <p role="alert" className="text-sm">We could not finish this set. <button type="button" className="font-bold underline" onClick={() => finish.mutate()}>Try again</button></p>}
  </div>
}

function PracticeItem({ sessionId, index, onNext, onMissing, limit }: { sessionId: string; index: number; limit: number | null; onNext: (correct: boolean, last: boolean) => void; onMissing: () => void }) {
  const shell = useTutorShell()
  const q = useQuery({ queryKey: ['tutor-practice', 'item', sessionId, index], queryFn: () => tutorPracticeApi.item(sessionId, index), retry: false, refetchOnWindowFocus: false, staleTime: Infinity })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [hints, setHints] = useState<string[]>([])
  const [conf, setConf] = useState<Confidence | null>(null)
  const [receipt, setReceipt] = useState<PracticeAnswerReceipt | null>(null)
  const [tried, setTried] = useState<string[]>([])
  const attemptId = useRef(newRequestId())
  const promptId = useId(); const instructionId = useId(); const idPrefix = useId()
  const hint = useMutation({ mutationFn: () => tutorPracticeApi.hint(sessionId, index), onSuccess: (h) => setHints((c) => [...c, h.text]) })
  const answer = useMutation({
    mutationFn: (a: NonNullable<ReturnType<typeof buildAnswer>>) => tutorPracticeApi.answer(sessionId, index, { clientAttemptId: attemptId.current, answer: a, ...(conf ? { confidence: conf } : {}) }),
    onSuccess: setReceipt,
  })
  const past = !!q.error && (q.error as { status?: number }).status === 404 && index > 0
  useEffect(() => { if (past) onMissing() }, [past, onMissing])
  if (q.isPending || past) return <Skeleton className="h-40" />
  if (q.isError || !q.data) return <ErrorState title="This question did not load" description="Try again." action={<Button onClick={() => q.refetch()}>Try again</Button>} />
  const question = q.data.question
  const d = draft ?? initialDraft(question)
  const verdict = receipt ? (receipt.gradingStatus === 'PENDING' ? 'pending' : receipt.correct ? 'right' : 'wrong') : null
  const canRetry = verdict === 'wrong' && receipt != null && receipt.attemptNo < question.attemptsAllowed
  const last = limit != null && index + 1 >= limit
  const submit = () => { const a = buildAnswer(question, d); if (a) answer.mutate(a) }
  const retry = () => {
    if (d.kind === 'MCQ' && d.optionId) setTried((t) => [...t, d.optionId!])
    attemptId.current = newRequestId(); setReceipt(null); setDraft(null)
  }
  return <section className="space-y-3" aria-label={`Question ${index + 1}`}>
    <span className="text-xs font-bold text-muted-foreground">{kindName[question.kind]}</span>
    <h1 id={promptId} className="text-xl font-black">{question.prompt}</h1>
    <p id={instructionId} className="text-sm text-muted-foreground">{kindInstruction(question, 'teens')}</p>
    <QuestionRenderer question={question} draft={d} onDraft={setDraft} band="teens" locked={!!receipt && !canRetry ? true : !!answer.isPending} marks={null} tried={tried} announce={() => {}} idPrefix={idPrefix} promptId={promptId} instructionId={instructionId} />
    {!receipt && <div className="flex flex-wrap items-center gap-2" role="group" aria-label="How sure are you?"><span className="text-sm font-bold">How sure are you?</span>
      {confs.map((c) => <button key={c.id} type="button" aria-pressed={conf === c.id} onClick={() => setConf(conf === c.id ? null : c.id)} className={cn('min-h-10 rounded-full border px-3 text-sm', conf === c.id && 'border-[var(--color-accent)] bg-[var(--color-accent-100)]')}>{c.label}</button>)}</div>}
    {hints.length > 0 && <ol aria-label="Hints" className="space-y-1 rounded-2xl bg-muted p-3 text-sm">{hints.map((h, i) => <li key={i}><b>Hint {i + 1}:</b> {h}</li>)}</ol>}
    <div role="status" aria-live="polite" className="text-sm">
      {verdict === 'right' && <b>Yes, that is right.</b>}
      {verdict === 'pending' && <span>{shell.tutorName} is checking your answer…</span>}
      {verdict === 'wrong' && <span><b>Not yet.</b> {canRetry ? 'Try a hint, then try again.' : 'That one is done.'}</span>}
      {answer.isError && <span>We could not send that. Your answer is still here. Try again.</span>}
      {hint.isError && <span>No more hints for this question.</span>}
    </div>
    <div className="flex flex-wrap gap-2">
      {!receipt && <Button loading={answer.isPending} disabled={!buildAnswer(question, d)} onClick={submit}>Check</Button>}
      {!receipt && question.hintsAvailable > 0 && <Button variant="secondary" loading={hint.isPending} onClick={() => hint.mutate()}>{hints.length ? 'Show next hint' : 'Need a hint?'}</Button>}
      {canRetry && <Button onClick={retry}>Try again</Button>}
      {receipt && (verdict !== 'wrong' || !canRetry) && <Button onClick={() => onNext(!!receipt.correct, last)}>{last ? 'Finish' : 'Next'}</Button>}
      {receipt && !canRetry && receipt.explanation && <details className="w-full rounded-2xl bg-muted p-3 text-sm"><summary className="cursor-pointer font-bold">Want to see why?</summary><p className="mt-1">{receipt.explanation}</p></details>}
      {receipt && !canRetry && !receipt.explanation && shell.canUseTutor && <Link className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-bold" href={buildTutorHref({ kind: 'PRACTICE_RESULT', sessionId, attemptId: receipt.attemptId }, { mode: 'EXPLAIN' })}>Want to see why?</Link>}
    </div>
  </section>
}

function Summary({ sessionId, results }: { sessionId: string; results: boolean[] }) {
  const shell = useTutorShell()
  const next = useQuery({ queryKey: ['tutor-practice', 'next', sessionId], queryFn: () => tutorPracticeApi.nextStep('PRACTICE', sessionId), retry: false })
  const right = results.filter(Boolean).length
  const a = next.data?.briefing.action
  return <div className="mx-auto w-full max-w-xl space-y-4 px-4 pb-24 pt-8 text-center">
    <h1 className="text-2xl font-black">Set done</h1>
    <p className="text-lg font-bold">{right} of {results.length} right first time</p>
    <section className="rounded-2xl border p-4 text-start" aria-label="Next">
      <span className="text-xs font-bold text-muted-foreground">Next</span>
      {next.isPending && <Skeleton className="mt-2 h-10" />}
      {a && <><p className="font-black">{a.label}</p><p className="text-sm text-muted-foreground">{next.data!.briefing.wording} · {a.minutes} min</p>
        <Link className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-[var(--color-accent-600)] px-4 font-bold text-white" href={a.targetId ? `/learn/practice?topicId=${encodeURIComponent(a.targetId)}` : '/learn/practice'}>Go</Link></>}
      {next.isError && <p className="text-sm">Pick your next step from Practice.</p>}
    </section>
    <Link className="font-bold underline" href="/learn/practice">Done for today</Link>
    {!shell.canUseTutor && <p className="text-xs text-muted-foreground">{shell.tutorName} is resting. Practice still works.</p>}
  </div>
}
