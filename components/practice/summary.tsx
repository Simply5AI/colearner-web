'use client'

import Link from 'next/link'
import { useEffect, useRef, type ReactNode } from 'react'
import { ClipboardList, GraduationCap, RefreshCw } from 'lucide-react'
import { CoCharacter } from '@/components/design-system'
import { ActionControl, LearnFrame, MeasuredTag } from '@/components/learn/learn-common'
import { dateLabel } from '@/components/learn/learn-format'
import { linkHref, type Actionable, type LearnBand } from '@/lib/api/learn'
import { isPracticeId, practiceRoutes, type PracticeSummary } from '@/lib/api/practice'
import { cn } from '@/lib/utils'
import { durationLabel } from './hub-model'
import { ModeTag, PracticeReadAloud, StarRow } from './states-parts'

const TEACH_BACK_REASON = 'Teach it back to Co opens in a later release.'

function Stat({ label, value, id }: { label: string; value: ReactNode; id: string }) {
  return <div data-stat={id} className="ds-card flex flex-col gap-1"><span className="text-[length:var(--ds-h2)] font-extrabold">{value}</span><span className="text-[length:var(--ds-small)] text-muted-foreground">{label}</span></div>
}

/** Teach-back is B11: shown, disabled, with the server's own reason (a fixed line when the server gives none). */
function TeachBack({ action }: { action: Actionable }) {
  return <div className="flex flex-wrap items-start gap-3" data-testid="teach-back">
    <GraduationCap size={22} aria-hidden="true" className="mt-3 text-primary" />
    <ActionControl action={{ ...action, enabled: false, disabledReason: action.disabledReason ?? TEACH_BACK_REASON }} label="Teach it back to Co" variant="secondary" />
  </div>
}

function reviewLink(item: PracticeSummary['missed'][number], sessionId: string): { href: string; label: string } | null {
  const source = linkHref(item.sourceLink)
  if (source) return { href: source, label: 'Review it' }
  return isPracticeId(sessionId) ? { href: `${practiceRoutes.answerSheet(sessionId)}#item-${item.itemIndex}`, label: 'Review it' } : null
}

/** Missed questions. Shown to tweens and teens only; kids never see them as a list of misses. */
function Missed({ summary, band, limit }: { summary: PracticeSummary; band: LearnBand; limit: number }) {
  const items = summary.missed.slice(0, limit)
  if (items.length === 0) return null
  const title = band === 'tweens' ? (items.length === 1 ? 'One to look at again' : 'To look at again') : 'Concepts to revise'
  return <section aria-labelledby="missed-title" data-testid="missed" className="space-y-3">
    <h2 id="missed-title">{title}</h2>
    <ul className="space-y-3">{items.map(item => {
      const link = reviewLink(item, summary.session.id)
      return <li key={item.itemIndex} className="ds-card space-y-2">
        <p className="break-words font-bold">{item.prompt}</p>
        {item.explanation && <p className="text-muted-foreground">{item.explanation}</p>}
        {link && <Link href={link.href} className="ds-button ds-button-secondary"><RefreshCw size={16} aria-hidden="true" />{link.label}</Link>}
      </li>
    })}</ul>
    {summary.missed.length > items.length && <p className="text-[length:var(--ds-small)] text-muted-foreground">The answer sheet has the other {summary.missed.length - items.length}.</p>}
  </section>
}

/** F-L11-07: grading that could not run is said plainly. Those answers are not scored. Kids get a gentle line with no count. */
export function FeedbackUnavailableNote({ count, band, sheetHref }: { count: number; band: LearnBand; sheetHref: string | null }) {
  if (count <= 0) return null
  const kids = band === 'kids'
  return <section role="status" data-state="feedback-unavailable" aria-labelledby="feedback-title" className="ds-card space-y-2 border-2 border-dashed border-border">
    <h2 id="feedback-title">{kids ? 'Co could not check some answers' : 'Some written answers could not be checked'}</h2>
    <p>{kids ? 'Co could not read some of your answers this time. They do not count, and that is okay.' : `Co could not check ${count === 1 ? '1 written answer' : `${count} written answers`} right now, so ${count === 1 ? 'it is' : 'they are'} not in your score and ${count === 1 ? 'it does' : 'they do'} not change when you review next.`}</p>
    {!kids && sheetHref && <Link href={sheetHref} className="ds-button ds-button-secondary">Open the answer sheet</Link>}
  </section>
}

function KidsSummary({ summary, headingRef }: { summary: PracticeSummary; headingRef: React.RefObject<HTMLHeadingElement | null> }) {
  const tough = summary.tough
  const title = tough ? 'That was a tricky one!' : 'You did it!'
  const homeHref = linkHref(summary.next.home) ?? '/learn/home'
  return <>
    <section data-state={tough ? 'tough' : 'great'} aria-labelledby="summary-title" className="ds-state rounded-[var(--radius)] bg-secondary py-8">
      <CoCharacter band="kids" state={tough ? 'encouraging' : 'celebrating'} decorative className="size-36 sm:size-52" />
      <div className="flex flex-wrap items-center justify-center gap-3">
        <h1 id="summary-title" ref={headingRef} tabIndex={-1} className="text-[length:var(--ds-h1)] outline-none">{title}</h1>
        <PracticeReadAloud text={title} />
      </div>
      <StarRow stars={summary.stars} size={56} />
      <p className="text-[length:var(--ds-h3)] font-bold" data-testid="kids-stars">{tough ? 'You tried hard!' : 'You played the whole round!'}</p>
      {summary.reward && <p className="text-[length:var(--ds-h3)]" data-testid="reward">You collected {summary.reward.stars} {summary.reward.stars === 1 ? 'star' : 'stars'}!</p>}
      {tough && <p className="max-w-prose text-[length:var(--ds-h3)]">Let’s look at it again together?</p>}
      <div className="flex w-full flex-wrap justify-center gap-4">
        {tough
          ? <ActionControl action={summary.next.quickRecap} label="Look again" className="min-h-16 min-w-44 text-[length:var(--ds-h3)]" />
          : <ActionControl action={summary.next.retry} label="Play again" className="min-h-16 min-w-44 text-[length:var(--ds-h3)]" />}
        <Link href={homeHref} className="ds-button ds-button-secondary min-h-16 min-w-44 text-[length:var(--ds-h3)]">{tough ? 'Later' : 'Home'}</Link>
      </div>
    </section>
    <FeedbackUnavailableNote count={summary.feedbackUnavailableCount} band="kids" sheetHref={null} />
  </>
}

function OlderSummary({ summary, band, headingRef }: { summary: PracticeSummary; band: LearnBand; headingRef: React.RefObject<HTMLHeadingElement | null> }) {
  const tough = summary.tough
  const teens = band === 'teens'
  const { score } = summary
  const homeHref = linkHref(summary.next.home) ?? '/learn/home'
  const time = durationLabel(summary.durationSec)
  const sheetHref = isPracticeId(summary.session.id) ? practiceRoutes.answerSheet(summary.session.id) : null
  const nextReview = dateLabel(summary.nextReviewAt)
  const title = tough ? 'That was a tricky one' : summary.session.mode === 'EXAM' ? 'Mock test finished' : 'Nice work'
  const encouragement = tough ? 'Tricky sessions are how learning sticks. A quick look back can help.' : null
  return <>
    <section data-state={tough ? 'tough' : 'great'} aria-labelledby="summary-title" className="ds-card flex flex-wrap items-center gap-6">
      <CoCharacter band={band} state={tough ? 'encouraging' : 'celebrating'} decorative />
      <div className="min-w-0 flex-1 basis-64 space-y-2">
        <ModeTag mode={summary.session.mode} band={band} showRule={false} />
        <h1 id="summary-title" ref={headingRef} tabIndex={-1} className="outline-none">{title}</h1>
        <p className="font-semibold">{summary.session.title}</p>
        {encouragement && <p className="text-muted-foreground">{encouragement}</p>}
      </div>
      <div className="space-y-1" data-testid="stars"><StarRow stars={summary.stars} size={32} />{summary.reward && <p className="text-[length:var(--ds-small)] font-semibold" data-testid="reward">Reward: {summary.reward.stars} {summary.reward.stars === 1 ? 'star' : 'stars'}</p>}</div>
    </section>
    <section aria-label="Your results" className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]">
      <div className="col-span-full"><MeasuredTag>Measured from your answers</MeasuredTag></div>
      <Stat id="score" label="Right" value={`${score.correct} of ${score.total}`} />
      {teens && score.accuracyPercent !== null && <Stat id="accuracy" label="Accuracy" value={`${Math.round(score.accuracyPercent)}%`} />}
      {teens && score.firstTryCorrect !== score.correct && <Stat id="first-try" label="Right first try" value={`${score.firstTryCorrect} of ${score.total}`} />}
      {time && <Stat id="time" label="Time" value={time} />}
      {summary.xp !== null && <Stat id="xp" label="XP earned" value={`+${summary.xp}`} />}
      {summary.level !== null && <Stat id="level" label="Level" value={summary.level} />}
      {summary.readiness !== null && <Stat id="readiness" label="Readiness" value={`${Math.round(summary.readiness)}%`} />}
      {nextReview && <Stat id="next-review" label="Next review" value={nextReview} />}
    </section>
    <FeedbackUnavailableNote count={summary.feedbackUnavailableCount} band={band} sheetHref={sheetHref} />
    <Missed summary={summary} band={band} limit={teens ? 8 : 3} />
    <section aria-label="What next" className="flex flex-wrap items-start gap-3">
      {tough
        ? <>
          <ActionControl action={summary.next.quickRecap} label="Quick recap" />
          <Link href={homeHref} className="ds-button ds-button-secondary">Try again later</Link>
          <ActionControl action={summary.next.retry} label="Try again now" variant="ghost" />
        </>
        : <>
          <ActionControl action={summary.next.retry} label="Practise again" />
          <Link href={homeHref} className="ds-button ds-button-secondary">Home</Link>
        </>}
      <TeachBack action={summary.next.teachBack} />
      {sheetHref && <Link href={sheetHref} className="ds-button ds-button-ghost"><ClipboardList size={18} aria-hidden="true" />Answer sheet</Link>}
      <Link href={practiceRoutes.hub} className="ds-button ds-button-ghost">Back to practice</Link>
    </section>
  </>
}

/**
 * L11 for one finished session: Great or Tough, by band. Everything shown comes from the server response: a reward is
 * drawn exactly as returned (it is one per session, so opening this again shows the same stars), and XP, level and
 * readiness appear only when the server sends a number.
 */
export function SummaryView({ summary, band }: { summary: PracticeSummary; band: LearnBand }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [])
  return <LearnFrame band={band} label="Practice summary" className={cn(band === 'kids' && 'max-w-3xl')}>
    {band === 'kids' ? <KidsSummary summary={summary} headingRef={heading} /> : <OlderSummary summary={summary} band={band} headingRef={heading} />}
  </LearnFrame>
}
