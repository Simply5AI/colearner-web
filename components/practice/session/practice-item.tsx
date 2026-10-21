'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, SkipForward } from 'lucide-react'
import { Button } from '@/components/design-system'
import { LearnLoadError, LearnSkeleton } from '@/components/learn/learn-common'
import { ReadAloudControl } from '@/components/lesson/lesson-speech'
import { Spoken, SpeechProvider } from './practice-speech'
import type { LearnBand } from '@/lib/api/learn'
import { useLocalReadAloud } from '@/lib/hooks/use-read-aloud'
import { cn } from '@/lib/utils'
import { answerProblem, buildAnswer, draftFromAnswer, initialDraft, type Draft } from '../questions/answers'
import { QuestionRenderer } from '../questions/question-renderer'
import type { PracticeMode, QuestionView } from './practice-types'
import { canTryAgain, marksFor, receiptPhase, visibleResult } from './receipt-model'
import { practiceSessionApi } from './session-api'
import { PracticeHints, useHints } from './session-hints'
import { useAnswerSubmission, usePendingPoll, useQuestion, type PollTiming } from './session-hooks'
import { buildPracticeScript, coLineFor, coPoseFor, kindInstruction, kindName, practiceErrorCode, practiceErrorText, questionSegments, speechRateFor, type ItemPhase } from './session-model'
import { PracticeCo, ReceiptCard, SourceChip } from './session-parts'

export interface PracticeItemProps {
  sessionId: string
  index: number
  total: number
  mode: PracticeMode
  band: LearnBand
  /** Move to the next question (the item is answered or skipped). */
  onNext: () => void
  /** The last item is done: complete the session and open the summary. */
  onFinish: () => void
  finishing: boolean
  finishError: string | null
  onSessionEnded: (reason: 'expired' | 'completed') => void
  /** The server says this item is not the one it expects; the player re-reads the session. */
  onOutOfOrder: (closed?: boolean) => void
  announce: (message: string) => void
  pollTiming?: PollTiming
}

/** Loads one item's learner view. The question is fetched when the learner reaches it, never ahead. */
export function PracticeItem(props: PracticeItemProps) {
  const query = useQuestion(props.sessionId, props.index)
  const { onSessionEnded, onOutOfOrder } = props
  const code = query.error ? practiceErrorCode(query.error) : undefined
  useEffect(() => {
    if (code === 'ITEM_OUT_OF_ORDER') onOutOfOrder()
    else if (code === 'SESSION_EXPIRED') onSessionEnded('expired')
    else if (code === 'SESSION_COMPLETED') onSessionEnded('completed')
  }, [code, onOutOfOrder, onSessionEnded])
  if (query.isPending) return <LearnSkeleton band={props.band} label="Getting your question" rows={2} />
  if (query.error) return <LearnLoadError error={query.error} retry={() => void query.refetch()} band={props.band} backHref="/learn/practice" backLabel="Back to practice" />
  return <ItemBody key={`${props.sessionId}:${props.index}:${query.data.questionId}`} {...props} question={query.data} />
}

const actionBase = 'min-w-32'

function ItemBody({ question, sessionId, index, total, mode, band, onNext, onFinish, finishing, finishError, onSessionEnded, onOutOfOrder, announce, pollTiming }: PracticeItemProps & { question: QuestionView }) {
  const kids = band === 'kids'
  const exam = mode === 'EXAM'
  const promptId = useId()
  const instructionId = useId()
  const idPrefix = useId()
  const heading = useRef<HTMLHeadingElement | null>(null)
  const receiptHeading = useRef<HTMLHeadingElement | null>(null)
  const startedAt = useRef(typeof performance !== 'undefined' ? performance.now() : 0)

  const [retries, setRetries] = useState(0)
  const [tried, setTried] = useState<string[]>([])
  const [exhausted, setExhausted] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [skipError, setSkipError] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)

  const submission = useAnswerSubmission({
    sessionId, index, attemptNo: question.attemptNo + retries,
    onRefused: error => {
      const code = practiceErrorCode(error)
      if (code === 'SESSION_EXPIRED') { onSessionEnded('expired'); return }
      if (code === 'SESSION_COMPLETED') { onSessionEnded('completed'); return }
      if (code === 'ITEM_OUT_OF_ORDER' || code === 'ITEM_CLOSED') { onOutOfOrder(code === 'ITEM_CLOSED'); return }
      if (code === 'ATTEMPTS_EXHAUSTED') setExhausted(true)
      setRefusal(practiceErrorText(error, 'That answer could not be sent. Your answer is still here, so you can try again.'))
    },
  })
  const { receipt, status } = submission
  const [draft, setDraft] = useState<Draft>(() => (submission.restored ? draftFromAnswer(question, submission.restored.answer) : null) ?? initialDraft(question))

  const marks = useMemo(() => marksFor(question, receipt, mode), [question, receipt, mode])
  const phaseOfReceipt = receiptPhase(receipt, mode)
  const hints = useHints({ sessionId, index, available: exam ? 0 : question.hintsAvailable })
  const phase: ItemPhase = status === 'sending' ? 'sending' : status === 'unconfirmed' ? 'unconfirmed' : phaseOfReceipt ?? (hints.texts.length > 0 ? 'hint' : 'question')
  const retry = canTryAgain(receipt, mode)
  const locked = status !== 'idle' || !!receipt || exhausted
  const isLast = (receipt?.isLastItem ?? false) || index >= total - 1

  // Polling: "Co is checking…" re-sends the same submission (same clientAttemptId) and adopts the server's current state.
  const poll = usePendingPoll({
    active: phaseOfReceipt === 'pending' && !!submission.body,
    poll: () => practiceSessionApi.answer(sessionId, index, submission.body!),
    onReceipt: submission.setReceipt,
    timing: pollTiming,
  })

  // Focus: the question heading on arrival, the receipt heading when an answer comes back.
  useEffect(() => { heading.current?.focus(); announce(`Question ${index + 1} of ${total}`) }, [announce, index, total])
  const receiptKey = receipt ? `${receipt.attempt.id}:${receipt.attempt.status}` : null
  const lastFocused = useRef<string | null>(null)
  useEffect(() => {
    if (!receiptKey || lastFocused.current === receiptKey) return
    lastFocused.current = receiptKey
    receiptHeading.current?.focus()
  }, [receiptKey])

  // Read-aloud: the question and its choices; after an answer, the feedback and explanation. Local voices only; never autoplays.
  const result = visibleResult(receipt, mode)
  const script = useMemo(() => buildPracticeScript(receipt
    ? [{ id: 'feedback', text: result?.feedback ?? '' }, { id: 'explanation', text: result?.explanation ?? '' }]
    : questionSegments(question)), [question, receipt, result?.feedback, result?.explanation])
  const speech = useLocalReadAloud(script.text, { rate: speechRateFor(band) })
  const readAloud = <ReadAloudControl speech={speech} band={band} note="Uses your device voice. Nothing leaves your device." />

  const problem = answerProblem(question, draft)
  const check = () => {
    if (locked) return
    const answer = buildAnswer(question, draft)
    if (!answer) { announce(problem ?? 'Finish your answer first.'); return }
    setRefusal(null)
    submission.submit(answer, (typeof performance !== 'undefined' ? performance.now() : 0) - startedAt.current)
  }
  const tryAgain = () => {
    if (!retry) return
    if (draft.kind === 'MCQ' && draft.optionId) { const id = draft.optionId; setTried(previous => previous.includes(id) ? previous : [...previous, id]); setDraft(initialDraft(question)) }
    else if (draft.kind === 'TRUE_FALSE' && draft.value !== null) { const id = String(draft.value); setTried(previous => previous.includes(id) ? previous : [...previous, id]); setDraft(initialDraft(question)) }
    setRetries(count => count + 1)
    submission.clearReceipt()
    setRefusal(null)
    startedAt.current = performance.now()
    lastFocused.current = null
    requestAnimationFrame(() => heading.current?.focus())
  }
  const skip = async () => {
    if (skipping || exam || locked) return
    setSkipping(true); setSkipError(null)
    try { await practiceSessionApi.skip(sessionId, index); onNext() }
    catch (error) {
      const code = practiceErrorCode(error)
      if (code === 'SESSION_EXPIRED') onSessionEnded('expired')
      else if (code === 'SESSION_COMPLETED') onSessionEnded('completed')
      else if (code === 'ITEM_OUT_OF_ORDER' || code === 'ITEM_CLOSED') onOutOfOrder(code === 'ITEM_CLOSED')
      else setSkipError(practiceErrorText(error, 'We could not skip this one. Please try again.'))
    } finally { setSkipping(false) }
  }
  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    // Enter sends a finished choice answer. Text areas keep Enter for new lines; buttons and selects keep it for themselves.
    if (event.key !== 'Enter' || event.defaultPrevented || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
    const target = event.target
    if (!(target instanceof HTMLInputElement) || !['radio', 'checkbox'].includes(target.type)) return
    event.preventDefault()
    check()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, locked, question])

  const hintsOpen = !exam && question.hintsAvailable > 0 && (!receipt || retry)
  const lookBack = question.sourceLink ?? hints.sourceLink
  const sourceChip = !exam && lookBack ? <SourceChip link={lookBack} band={band} /> : null
  const receiptSource = !exam && phaseOfReceipt && phaseOfReceipt !== 'recorded' ? <SourceChip link={result?.sourceLink ?? lookBack} band={band} /> : null

  const unconfirmedText = status === 'unconfirmed' ? 'We could not tell if your answer arrived. Nothing is lost. Press Send again.' : null
  const nextLabel = isLast ? (exam ? 'Finish test' : kids ? 'All done!' : 'Finish') : phaseOfReceipt === 'pending' ? 'Carry on' : kids ? 'Next' : 'Next question'
  const showNext = !!receipt && !retry
  const copy = (
    <PracticeCo band={band} pose={coPoseFor(phase)} line={coLineFor(phase, band, mode)} hideBelowLg={!!receipt} />
  )
  const questionHeading = <div className="space-y-2">
    <p className="text-[length:var(--ds-caption)] font-bold uppercase tracking-widest text-primary">{kindName[question.kind]}{!kids && question.attemptNo + retries > 1 && question.attemptsAllowed > 1 ? ` · try ${question.attemptNo + retries} of ${question.attemptsAllowed}` : ''}</p>
    <h2 id={promptId} ref={heading} tabIndex={-1} className="max-w-prose outline-none" data-testid="question-prompt"><Spoken id="prompt" text={question.prompt} /></h2>
    <p id={instructionId} className="text-[length:var(--ds-small)] text-muted-foreground">{kindInstruction(question, band)}</p>
  </div>

  return <SpeechProvider active={speech.activeWordIndex} starts={script.starts}>
    <div className={cn('grid flex-1 items-start gap-6', band !== 'teens' && 'lg:grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)]')} data-band={band} data-kind={question.kind} data-phase={phase} onKeyDown={onKeyDown}>
      {copy}
      <div className="min-w-0 space-y-5">
        <article aria-labelledby={promptId} className="ds-card min-w-0 space-y-5 !p-5 sm:!p-7" data-testid="question-card">
          {questionHeading}
          {!receipt && readAloud}
          <QuestionRenderer question={question} draft={draft} onDraft={setDraft} band={band} locked={locked} marks={marks} tried={tried}
            announce={announce} idPrefix={idPrefix} promptId={promptId} instructionId={instructionId} />
          {hintsOpen && <PracticeHints band={band} available={question.hintsAvailable} hints={hints} canAsk={!locked || retry} sourceChip={sourceChip} />}
          {(unconfirmedText || refusal) && <p role="alert" className="ds-field-error" data-testid="answer-error">{unconfirmedText ?? refusal}</p>}
        </article>
        {receipt && phaseOfReceipt && <>
          <ReceiptCard ref={receiptHeading} phase={phaseOfReceipt} band={band} mode={mode} question={question} receipt={receipt} marks={marks} gaveUp={poll.gaveUp} onCheckAgain={poll.checkAgain}
            coPose={coPoseFor(phaseOfReceipt)} retry={retry} source={receiptSource} />
          {(result?.feedback || result?.explanation) && <div className="flex flex-wrap items-center gap-3">{readAloud}</div>}
        </>}
      </div>
    </div>

    <nav aria-label="Practice actions" className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-7 sm:px-7">
      <div className="flex flex-wrap items-center gap-2">
        {!receipt && !exam && status === 'idle' && !exhausted && <Button variant="ghost" onClick={() => void skip()} loading={skipping}><SkipForward size={18} aria-hidden="true" className="rtl:rotate-180" />{kids ? 'Skip' : 'Skip for now'}</Button>}
        {retry && <Button variant="ghost" onClick={isLast ? onFinish : onNext} loading={finishing && isLast}>{isLast ? (kids ? 'All done!' : 'Finish') : kids ? 'Move on' : 'Skip for now'}</Button>}
      </div>
      <div className="order-last min-w-0 basis-full text-center text-[length:var(--ds-small)] text-muted-foreground sm:order-none sm:flex-1 sm:basis-0" aria-live="off">
        {!receipt && status === 'idle' && !exhausted && problem && <span data-testid="answer-problem">{problem}</span>}
        {skipError && <span role="alert" className="text-destructive">{skipError}</span>}
        {finishError && <span role="alert" className="text-destructive" data-testid="finish-error">{finishError}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!receipt && status !== 'unconfirmed' && !exhausted && <Button onClick={check} loading={status === 'sending'} aria-disabled={!!problem || undefined} className={cn(actionBase, kids && 'text-[length:var(--ds-h3)]')}>
          {status === 'sending' ? 'Checking…' : <><Check size={18} aria-hidden="true" />{exam ? (kids ? 'Save' : 'Save answer') : kids ? 'Check!' : 'Check my answer'}</>}
        </Button>}
        {status === 'unconfirmed' && <Button onClick={submission.resend} className={cn(actionBase, kids && 'text-[length:var(--ds-h3)]')}><RotateCcw size={18} aria-hidden="true" />Send again</Button>}
        {retry && <Button onClick={tryAgain} className={cn(actionBase, kids && 'text-[length:var(--ds-h3)]')}><RotateCcw size={18} aria-hidden="true" />Try again</Button>}
        {(showNext || exhausted) && <Button onClick={isLast ? onFinish : onNext} loading={finishing} className={cn(actionBase, kids && 'text-[length:var(--ds-h3)]')}>
          {isLast ? <><Check size={18} aria-hidden="true" />{nextLabel}</> : <>{nextLabel}<ArrowRight size={18} aria-hidden="true" className="rtl:rotate-180" /></>}
        </Button>}
      </div>
    </nav>
  </SpeechProvider>
}
