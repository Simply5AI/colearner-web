'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Pencil, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InlineAlert, LoadingBlock, UnavailableNote } from '@/components/teacher/plans/fields'
import { batchFailureText, isWorking, POLL_MS, type BatchDetail } from '@/lib/api/teaching/co-drafts'
import { isDenied, isUnavailable, teachingErrorText } from '@/lib/api/teaching/plans'
import { answerSummary, difficultyLabel, reviewLabel, typeLabel, validateQuestion, type QuestionDetail } from '@/lib/api/teaching/question-schema'
import { errorCode, questionErrorText } from '@/lib/api/teaching/questions'
import { AuthorOnlyBadge, QuestionFlags } from './question-flags'
import { questionKeys, useCoState, useQuestionApis } from './use-question-apis'

function DraftCard({ draft, index, onDecided, onRefresh }: { draft: QuestionDetail; index: number; onDecided: (next: QuestionDetail) => void; onRefresh: () => void }) {
  const apis = useQuestionApis()
  const [busy, setBusy] = useState<'ACCEPT' | 'REJECT' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const content = draft.draftRevision?.content ?? draft.content
  const warnings = validateQuestion(content)
  const decided = draft.reviewState === 'ACCEPTED' || draft.reviewState === 'REJECTED'
  const decide = async (decision: 'ACCEPT' | 'REJECT') => {
    setBusy(decision); setError(null)
    try { onDecided(await apis.questions.review(draft.id, decision, draft.version)) }
    catch (e) { if (errorCode(e) === 'VERSION_CONFLICT') setStale(true); setError(questionErrorText(e)) }
    finally { setBusy(null) }
  }
  return <li className="space-y-3 rounded-xl border border-border p-4" data-testid="draft-card" data-question-id={draft.id} data-review-state={draft.reviewState} aria-label={`Question ${index + 1}`}>
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-semibold">{index + 1}.</span>
      <span className="rounded-full border border-border px-2 py-0.5">{typeLabel[draft.type]}</span>
      {draft.difficulty && <span className="rounded-full border border-border px-2 py-0.5">{difficultyLabel[draft.difficulty]}</span>}
      {draft.authorOnly && <AuthorOnlyBadge />}
      <span data-testid="decision-state" className={decided ? 'font-semibold' : 'text-muted-foreground'}>{reviewLabel[draft.reviewState]}</span>
    </div>
    <p className="whitespace-pre-wrap break-words text-base font-medium" data-testid="draft-prompt">{content.prompt}</p>
    {content.options && <ul className="space-y-1 text-sm">{content.options.map(option => {
      const correct = content.correctAnswer.kind === 'option' ? content.correctAnswer.optionId === option.id : content.correctAnswer.kind === 'options' ? content.correctAnswer.optionIds.includes(option.id) : false
      return <li key={option.id} className="flex items-start gap-2"><span aria-hidden="true" className="mt-0.5 w-4 shrink-0">{correct ? '✓' : '•'}</span><span>{option.label}{correct && <span className="ms-1 text-xs font-semibold text-primary">(correct)</span>}</span></li>
    })}</ul>}
    <dl className="space-y-1 rounded-lg bg-muted/40 p-3 text-sm" data-testid="draft-key">
      <div><dt className="inline font-semibold">Answer key: </dt><dd className="inline whitespace-pre-wrap break-words">{answerSummary(content) || 'None'}</dd></div>
      {content.explanation && <div><dt className="inline font-semibold">Explanation: </dt><dd className="inline break-words">{content.explanation}</dd></div>}
      {content.rubric && <div><dt className="inline font-semibold">Rubric: </dt><dd className="inline break-words">{content.rubric}</dd></div>}
      {content.hints.length > 0 && <div><dt className="inline font-semibold">Hints: </dt><dd className="inline break-words">{content.hints.map(h => h.text).join(' · ')}</dd></div>}
    </dl>
    {draft.flags.length > 0 && <QuestionFlags question={draft} onChanged={onRefresh} showNotes />}
    {warnings.length > 0 && !decided && <div role="note" className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm" data-testid="draft-warnings">
      <p className="font-semibold">Check before accepting</p>
      <ul className="list-disc ps-5">{warnings.map((w, i) => <li key={i}>{w.message}</li>)}</ul>
    </div>}
    {error && <InlineAlert testId="draft-error">{error}{stale && <> <button type="button" className="underline" onClick={onRefresh}>Refresh the list</button>.</>}</InlineAlert>}
    {!decided
      ? <div className="flex flex-wrap gap-2">
        <Button size="lg" onClick={() => void decide('ACCEPT')} aria-disabled={busy !== null || undefined} data-testid="draft-accept"><Check aria-hidden="true" />{busy === 'ACCEPT' ? 'Publishing…' : 'Accept'}</Button>
        <Button size="lg" variant="outline" render={<Link href={`/teacher/questions/${encodeURIComponent(draft.id)}`} />} data-testid="draft-edit"><Pencil aria-hidden="true" />Edit</Button>
        <Button size="lg" variant="outline" onClick={() => void decide('REJECT')} aria-disabled={busy !== null || undefined} data-testid="draft-reject"><X aria-hidden="true" />{busy === 'REJECT' ? 'Rejecting…' : 'Reject'}</Button>
      </div>
      : <p className="text-sm text-muted-foreground" data-testid="draft-decided">{draft.reviewState === 'REJECTED' ? 'Rejected. Archived with its history kept.' : 'Published to your question bank.'} <Link href={`/teacher/questions/${encodeURIComponent(draft.id)}`} className="underline">Open</Link></p>}
  </li>
}

/** Review queue for one Co draft batch (F-T4-05). Polls while Co works; Co output is never published without a teacher decision. */
export function CoReviewQueue({ batchId }: { batchId: string }) {
  const apis = useQuestionApis()
  const client = useQueryClient()
  const key = questionKeys.batch(apis.schoolId, batchId)
  const [recheckMessage, setRecheckMessage] = useState<string | null>(null)
  const query = useQuery({
    queryKey: key, queryFn: () => apis.co.batch(batchId), retry: false, staleTime: 0, gcTime: 0, refetchOnWindowFocus: false,
    refetchInterval: current => (current.state.data && !isWorking(current.state.data.batch.status) ? false : POLL_MS),
  })
  const firstPlan = query.data?.drafts[0]?.planId
  const coState = useCoState(firstPlan)
  const update = (next: QuestionDetail) => client.setQueryData<BatchDetail>(key, old => old && { ...old, drafts: old.drafts.map(d => (d.id === next.id ? next : d)) })
  const refetch = () => void query.refetch()

  const back = <Link href="/teacher/questions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring"><ArrowLeft aria-hidden="true" className="size-4" />All questions</Link>
  if (query.isPending) return <div className="space-y-4">{back}<LoadingBlock label="Loading the Co draft" /></div>
  if (query.error) {
    return <div className="space-y-4">{back}{isDenied(query.error)
      ? <InlineAlert testId="review-denied">This draft was not found, or you do not have access to it.</InlineAlert>
      : <div className="space-y-3" data-testid="review-error"><InlineAlert>{isUnavailable(query.error) ? 'Co drafts are unavailable right now. Nothing is lost; try again in a moment.' : teachingErrorText(query.error)}</InlineAlert><Button variant="outline" onClick={refetch}>Retry</Button></div>}</div>
  }
  const { batch, drafts } = query.data
  const pending = drafts.filter(d => d.reviewState !== 'ACCEPTED' && d.reviewState !== 'REJECTED')
  const recheck = coState.data?.review
  const onRecheck = async () => {
    setRecheckMessage(null)
    try { await apis.co.recheck(pending.map(d => d.id)); setRecheckMessage('Co is checking these questions. Suggestions appear here when it finishes.'); setTimeout(refetch, POLL_MS) }
    catch (e) { setRecheckMessage(questionErrorText(e)) }
  }

  return <div className="space-y-5" data-testid="review-queue" data-batch-status={batch.status}>
    {back}
    {isWorking(batch.status) && <div role="status" aria-live="polite" className="space-y-2 rounded-xl border border-border p-5" data-testid="batch-working">
      <p className="flex items-center gap-2 font-semibold"><Sparkles aria-hidden="true" className="size-4" />{batch.status === 'QUEUED' ? 'Co has your request and will start soon.' : 'Co is drafting questions from your material.'}</p>
      <p className="text-sm text-muted-foreground">Topic: {batch.topicTitle}{batch.materialTitles.length > 0 && <> · Reading: {batch.materialTitles.join(', ')}</>}. This page checks again every few seconds. You can leave and come back; nothing is published until you accept it.</p>
    </div>}
    {batch.status === 'FAILED' && <div className="space-y-3" data-testid="batch-failed"><InlineAlert>{batchFailureText(batch.failureCode)}</InlineAlert><Button render={<Link href="/teacher/questions" />} variant="outline" size="lg">Back to the question bank</Button></div>}
    {batch.status === 'CANCELLED' && <InlineAlert tone="info" testId="batch-cancelled">This draft was cancelled. Nothing was added to your question bank.</InlineAlert>}
    {batch.status === 'READY' && <>
      <div className="space-y-1">
        <h2 className="text-xl font-bold" data-testid="review-heading">Co drafted {batch.draftCount} {batch.draftCount === 1 ? 'question' : 'questions'} from &lsquo;{batch.topicTitle}&rsquo;</h2>
        <p className="text-sm text-muted-foreground" data-testid="review-progress">{drafts.length - pending.length} of {drafts.length} reviewed. Co&rsquo;s drafts are suggestions: check each answer before you accept. {batch.materialTitles.length > 0 && <>Drafted from: {batch.materialTitles.join(', ')}.</>}</p>
      </div>
      {drafts.length === 0 && <div className="rounded-xl border border-dashed border-border p-8 text-center" data-testid="review-empty"><h3 className="text-lg font-bold">Co did not return any questions</h3><p className="mt-1 text-sm text-muted-foreground">Nothing was added. Try a different topic or material.</p></div>}
      {pending.length > 0 && <div className="space-y-1">
        {recheck?.state === 'UNAVAILABLE'
          ? <UnavailableNote testId="recheck-unavailable" label="Co checking is not available" reason={recheck.reason ?? 'Co is not available right now.'} />
          : <Button variant="outline" size="lg" onClick={() => void onRecheck()} aria-disabled={!recheck || undefined} data-testid="recheck"><Sparkles aria-hidden="true" />Ask Co to check these again</Button>}
        {recheckMessage && <p role="status" className="text-sm" data-testid="recheck-message">{recheckMessage}</p>}
      </div>}
      <ol className="space-y-4" aria-label="Drafted questions">{drafts.map((draft, index) => <DraftCard key={draft.id} draft={draft} index={index} onDecided={update} onRefresh={refetch} />)}</ol>
    </>}
  </div>
}
