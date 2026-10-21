'use client'

import Link from 'next/link'
import { BookOpen, CheckCircle2, CircleDashed, CircleHelp, CircleMinus, Sparkles } from 'lucide-react'
import { Button } from '@/components/design-system'
import { LearnFrame } from '@/components/learn/learn-common'
import { dateLabel } from '@/components/learn/learn-format'
import { linkHref, type LearnBand } from '@/lib/api/learn'
import { isPracticeId, practiceRoutes, type AnswerSheet, type AnswerSheetItem } from '@/lib/api/practice'
import { durationLabel } from './hub-model'
import { ModeTag } from './states-parts'

type Mark = 'correct' | 'partial' | 'tried' | 'unchecked' | 'checking' | 'skipped'

/** One mark per answer. It is always written as well as drawn, so colour is never the only signal. */
export function markFor(item: Pick<AnswerSheetItem, 'correct' | 'partial' | 'gradingStatus' | 'yourAnswer'>): Mark {
  if (item.gradingStatus === 'FEEDBACK_UNAVAILABLE') return 'unchecked'
  if (item.gradingStatus === 'PENDING') return 'checking'
  if (item.correct === true) return 'correct'
  if (item.partial) return 'partial'
  if (item.correct === false) return item.yourAnswer === null ? 'skipped' : 'tried'
  // The platform sends correct null, no answer and NOT_NEEDED for a question that was skipped or never reached (a timed
  // test that ran out). Nothing is being checked there, so it must not read "Co is still checking".
  if (item.correct === null && item.yourAnswer === null && item.gradingStatus === 'NOT_NEEDED') return 'skipped'
  return 'checking'
}
const marks: Record<Mark, { icon: typeof CheckCircle2; text: string; kids: string }> = {
  correct: { icon: CheckCircle2, text: 'Correct', kids: 'Yes!' },
  partial: { icon: CircleHelp, text: 'Partly right', kids: 'Almost!' },
  tried: { icon: CircleDashed, text: 'Not right yet', kids: 'Let’s look again' },
  skipped: { icon: CircleMinus, text: 'Skipped', kids: 'Skipped' },
  unchecked: { icon: CircleHelp, text: 'Could not be checked', kids: 'Not counted' },
  checking: { icon: CircleHelp, text: 'Co is still checking', kids: 'Co is still checking' },
}

function AnswerItem({ item, number, band, onRegrade, regrading, requested }: { item: AnswerSheetItem; number: number; band: LearnBand; onRegrade?: (attemptId: string) => void; regrading: boolean; requested: boolean }) {
  const kids = band === 'kids'
  const mark = marks[markFor(item)]
  const Icon = mark.icon
  const source = linkHref(item.sourceLink)
  return <li id={`item-${item.itemIndex}`} data-testid="answer-item" data-mark={markFor(item)} className="ds-card scroll-mt-24 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-[length:var(--ds-h3)]">Question {number}</h2>
      <p className="ds-pill font-bold"><Icon size={16} aria-hidden="true" />{kids ? mark.kids : mark.text}</p>
    </div>
    <p className="break-words font-semibold">{item.prompt}</p>
    <dl className="grid gap-2">
      <div><dt className="text-[length:var(--ds-small)] font-bold text-muted-foreground">Your answer</dt><dd className="break-words">{item.yourAnswer ?? 'No answer'}</dd></div>
      {item.correctAnswer && <div><dt className="text-[length:var(--ds-small)] font-bold text-muted-foreground">The answer</dt><dd className="break-words" data-testid="correct-answer">{item.correctAnswer}</dd></div>}
    </dl>
    {item.feedback && <p className="rounded-[var(--radius)] bg-secondary p-3" data-kind="co-feedback"><Sparkles size={16} aria-hidden="true" className="me-2 inline text-[var(--brand-orange,#cf5d0b)]" /><span className="font-bold">Co says: </span>{item.feedback}</p>}
    {item.explanation && <p className="text-muted-foreground"><span className="font-bold">Why: </span>{item.explanation}</p>}
    {item.gradingStatus === 'FEEDBACK_UNAVAILABLE' && <div role="status" data-state="feedback-unavailable" className="space-y-2 rounded-[var(--radius)] border border-dashed border-border p-3">
      <p>{kids ? 'Co could not check this one, so it does not count.' : 'Co could not check this answer, so it is not in your score and does not change your next review.'}</p>
      {item.attemptId && onRegrade && (requested
        ? <p className="font-semibold">Asked. Co will check it again, so come back in a little while.</p>
        : <Button variant="secondary" onClick={() => onRegrade(item.attemptId!)} loading={regrading}>Ask Co to check again</Button>)}
    </div>}
    {source && <Link href={source} className="ds-pill border border-border hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"><BookOpen size={16} aria-hidden="true" />Look at where this comes from</Link>}
  </li>
}

/** F-L9-06 / F-L11-04: the answer sheet of one finished session, with Co's feedback labelled and grading gaps said plainly. */
export function AnswerSheetView({ sheet, band, onRegrade, regradingId, requested = [], error }: { sheet: AnswerSheet; band: LearnBand; onRegrade?: (attemptId: string) => void; regradingId?: string | null; requested?: readonly string[]; error?: Error | null }) {
  const kids = band === 'kids'
  const { session } = sheet
  const summaryHref = isPracticeId(session.id) ? practiceRoutes.summary(session.id) : null
  const when = dateLabel(session.completedAt ?? session.startedAt)
  const time = durationLabel(session.durationSec)
  return <LearnFrame band={band} label="Answer sheet">
    <header className="space-y-2">
      <ModeTag mode={session.mode} band={band} showRule={false} />
      <h1>{kids ? 'Look back' : 'Answer sheet'}</h1>
      <p className="font-semibold">{session.title}</p>
      <p className="text-muted-foreground">{[when, time, !kids && session.correct !== null ? `${session.correct} of ${session.itemCount} right` : null].filter(Boolean).join(' · ')}</p>
    </header>
    {error && <p role="alert" className="ds-field-error">{error.message}</p>}
    {sheet.items.length === 0
      ? <p data-state="empty" className="ds-card">There are no answers to show for this session.</p>
      : <ol aria-label="Questions and answers" className="space-y-4">{sheet.items.map((item, index) => <AnswerItem key={item.itemIndex} item={item} number={index + 1} band={band} onRegrade={onRegrade} regrading={regradingId === item.attemptId} requested={!!item.attemptId && requested.includes(item.attemptId)} />)}</ol>}
    <div className="flex flex-wrap gap-3">
      {summaryHref && <Link href={summaryHref} className="ds-button ds-button-secondary">Back to summary</Link>}
      <Link href={practiceRoutes.hub} className="ds-button ds-button-ghost">{kids ? 'Back to Play' : 'Back to practice'}</Link>
    </div>
  </LearnFrame>
}
