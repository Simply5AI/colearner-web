'use client'

import { forwardRef } from 'react'
import { BookOpen, CheckCircle2, CircleHelp, Clock, Hourglass, Save, X } from 'lucide-react'
import { Button, CoCharacter, type CoState } from '@/components/design-system'
import { Spoken } from './practice-speech'
import { linkHref, type Link, type LearnBand } from '@/lib/api/learn'
import { cn } from '@/lib/utils'
import { describeRevealed, type ItemMarks } from '../questions/marks'
import { clockLabel, formatClock, modeLabel, type ItemPhase } from './session-model'
import type { AnswerReceipt, PracticeMode, QuestionView } from './practice-types'

/** Co beside the question: tall on a wide screen for kids and tweens, a compact row on a phone, a small dock for teens. */
export function PracticeCo({ band, pose, line, hideBelowLg }: { band: LearnBand; pose: CoState; line: string; hideBelowLg?: boolean }) {
  const kids = band === 'kids'
  return <aside aria-label="Co helper" data-testid="co-panel" data-co-pose={pose}
    className={cn('flex items-center gap-3', band === 'teens' ? 'rounded-[var(--radius)] border border-border bg-card p-3' : 'lg:sticky lg:top-24 lg:flex-col lg:text-center', hideBelowLg && 'max-lg:hidden')}>
    <CoCharacter band={band} state={pose} size={band === 'teens' ? 48 : kids ? 160 : 120} decorative
      className={band === 'teens' ? 'size-12 flex-none' : kids ? 'size-20 flex-none sm:size-28 lg:size-44' : 'size-16 flex-none lg:size-32'} />
    <p className={cn('ds-speech-bubble !block min-w-0 flex-1 font-bold lg:flex-none', kids && 'text-[length:var(--ds-h3)]')} data-testid="co-line">{line}</p>
  </aside>
}

/** A link back to where the question came from (the learner's own material or lesson). Opens in a new tab so the session stays put. */
export function SourceChip({ link, band }: { link: Link | null | undefined; band: LearnBand }) {
  const href = linkHref(link ?? null)
  if (!href || !link) return null
  const text = link.route === 'LESSON'
    ? (band === 'kids' ? 'Back to the lesson' : 'Look back at the lesson')
    : (band === 'kids' ? 'Look at your page' : 'Look back at your material')
  return <a href={href} target="_blank" rel="noopener noreferrer" data-testid="source-chip" className="ds-pill border border-border hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring">
    <BookOpen size={16} aria-hidden="true" />{text}<span className="sr-only"> (opens in a new tab)</span>
  </a>
}

export interface HeaderProps {
  band: LearnBand
  mode: PracticeMode
  title: string | null
  /** 1-based number of the question being answered, and how many there are. */
  number: number
  total: number
  /** Items already answered or skipped. */
  done: number
  secondsLeft: number | null
  showTimer: boolean
  onExit: () => void
}
export function PracticeHeader({ band, mode, title, number, total, done, secondsLeft, showTimer, onExit }: HeaderProps) {
  const kids = band === 'kids'
  const percent = total > 0 ? Math.round((Math.min(done, total) / total) * 100) : 0
  return <header className="flex flex-wrap items-center gap-3">
    <Button variant="ghost" aria-label={mode === 'EXAM' ? 'Leave the test' : 'Leave practice'} onClick={onExit}><X size={22} aria-hidden="true" /></Button>
    <div className="min-w-0 flex-1 basis-56 space-y-1.5">
      <p className="font-bold" data-testid="question-count"><span className="sr-only">Progress: </span>Question {Math.min(number, total)} of {total}</p>
      <div role="progressbar" aria-label="Practice progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(done, total)} aria-valuetext={`${Math.min(done, total)} of ${total} done`}
        className={cn('overflow-hidden rounded-full bg-muted', kids ? 'h-4' : 'h-2.5')}>
        <div className="h-full rounded-full bg-primary" style={{ inlineSize: `${percent}%` }} />
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      {title && <span className="ds-pill max-w-56 truncate" title={title}>{title}</span>}
      <span className="ds-pill" data-testid="mode-tag">{modeLabel[mode]}</span>
      {showTimer && secondsLeft !== null && <p role="timer" aria-label={clockLabel(secondsLeft)} data-testid="session-timer" className={cn('ds-pill', secondsLeft <= 60 && 'bg-secondary text-secondary-foreground ring-2 ring-primary')}>
        <Clock size={16} aria-hidden="true" /><span aria-hidden="true">{formatClock(secondsLeft)}</span></p>}
    </div>
  </header>
}

export interface ReceiptCardProps {
  phase: Extract<ItemPhase, 'correct' | 'partial' | 'incorrect' | 'pending' | 'unavailable' | 'recorded'>
  band: LearnBand
  mode: PracticeMode
  question: QuestionView
  receipt: AnswerReceipt
  marks: ItemMarks | null
  /** Coming back to the poll after it gave up. */
  gaveUp: boolean
  onCheckAgain: () => void
  coPose: CoState
  retry: boolean
  source: React.ReactNode
}
const titles: Record<ReceiptCardProps['phase'], (band: LearnBand, retry: boolean) => string> = {
  correct: band => band === 'kids' ? 'You got it!' : 'Nice work!',
  partial: band => band === 'kids' ? 'So close! Try once more.' : 'You are getting there',
  incorrect: (band, retry) => band === 'kids' ? 'Almost! Let us look again.' : retry ? 'Not quite yet' : 'Good try',
  pending: () => 'Co is checking…',
  unavailable: () => 'Co could not check this one',
  recorded: band => band === 'kids' ? 'Got it!' : 'Answer saved',
}

/**
 * What the learner sees after an answer: the server's feedback and kind explanation, the right answer only when the
 * server revealed it, a source link, and an honest state while Co is checking or cannot check. Encouraging, never sad;
 * kids never see a count of misses or tries.
 */
export const ReceiptCard = forwardRef<HTMLHeadingElement, ReceiptCardProps>(function ReceiptCard({ phase, band, mode, question, receipt, marks, gaveUp, onCheckAgain, coPose, retry, source }, headingRef) {
  const kids = band === 'kids'
  const result = mode === 'EXAM' ? null : receipt.result
  const revealedLines = marks?.revealed ? describeRevealed(question, marks.revealed) : []
  const Icon = phase === 'correct' ? CheckCircle2 : phase === 'pending' || phase === 'unavailable' ? Hourglass : phase === 'recorded' ? Save : CircleHelp
  return <section role="status" aria-live="polite" data-testid="receipt" data-feedback-kind={phase} data-attempt-status={receipt.attempt.status}
    className={cn('ds-answer-feedback !items-start', phase === 'pending' && 'border-dashed')}>
    <CoCharacter band={band} state={coPose} decorative className="size-16 flex-none lg:hidden" />
    <div className="ds-feedback-content min-w-0 flex-1 space-y-2">
      <h3 ref={headingRef} tabIndex={-1} className="outline-none"><Icon size={20} aria-hidden="true" />{titles[phase](band, retry)}</h3>
      {phase === 'pending' && <>
        <p>{kids ? 'Co is reading your answer. You can wait here.' : 'Co is reading your answer. This can take a little while. Your answer is saved, so you can wait here or carry on.'}</p>
        {gaveUp && <p data-testid="pending-slow" className="space-y-2"><span className="block">Co is taking longer than usual.</span><Button variant="secondary" onClick={onCheckAgain}>Check again</Button></p>}
      </>}
      {phase === 'unavailable' && <p>{kids ? 'Your answer is saved. You can go on.' : 'Your answer is saved, but it was not counted either way. You can carry on. If this keeps happening, tell your teacher or a grown-up.'}</p>}
      {phase === 'recorded' && <p>{kids ? 'On to the next one!' : mode === 'EXAM' ? 'Your answer is saved. You will see how you did when the test is finished.' : 'Your answer is saved.'}</p>}
      {result?.feedback && <p data-testid="receipt-feedback"><Spoken id="feedback" text={result.feedback} /></p>}
      {result?.explanation && <p data-testid="receipt-explanation">{!kids && <span className="font-bold">Here is why: </span>}<Spoken id="explanation" text={result.explanation} /></p>}
      {revealedLines.length > 0 && <div data-testid="revealed-answer" className="space-y-1 rounded-[var(--radius)] bg-background/70 p-3">
        <p className="font-bold">The right answer{revealedLines.length > 1 && question.kind !== 'ORDERING' ? 's' : ''}</p>
        <ul className="list-none space-y-0.5 p-0">{revealedLines.map(line => <li key={line}>{line}</li>)}</ul>
      </div>}
      {!kids && retry && receipt.attemptsLeft > 0 && <p className="text-[length:var(--ds-small)] text-muted-foreground" data-testid="tries-left">You have {receipt.attemptsLeft} {receipt.attemptsLeft === 1 ? 'try' : 'tries'} left on this one.</p>}
      {source}
    </div>
  </section>
})
