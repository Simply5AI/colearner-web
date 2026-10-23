'use client'

import Link from 'next/link'
import { BookOpen, Compass, ShieldCheck, Square, Volume2 } from 'lucide-react'
import { Button, CoAvatar, type CoState } from '@/components/design-system'
import { AiOriginTag } from '@/components/lesson/lesson-parts'
import { linkHref, type LearnBand } from '@/lib/api/learn'
import { useLocalReadAloud } from '@/lib/hooks/use-read-aloud'
import { cn } from '@/lib/utils'
import { failureMessage, pendingLabel, replyView, SAFETY_LABEL, sourceChipText, speechRateFor, type ReplyView } from './co-model'
import type { CoTurnView } from './co-types'

/* ---------- small shared pieces ---------- */

/** Co's words as plain text, or word by word with the spoken word marked while the device voice reads them. */
function SpokenText({ text, words, active, kids }: { text: string; words: readonly string[]; active: number | null; kids: boolean }) {
  return <p className={cn('max-w-prose whitespace-pre-line leading-relaxed', kids && 'text-[length:var(--ds-h3)] font-semibold leading-snug')} data-testid="co-reply-text">
    {active === null ? text : words.map((word, index) => <span key={index}>{index > 0 && ' '}{index === active
      ? <mark aria-current="true" className="rounded-sm bg-secondary px-0.5 text-secondary-foreground outline outline-2 outline-primary">{word}</mark>
      : word}</span>)}
  </p>
}

/** Device read-aloud for one reply. The control does not exist when the device has no local voice (never a dead button); nothing autoplays. */
function ReplyReadAloud({ text, band, children }: { text: string; band: LearnBand; children: (control: React.ReactNode, state: { speaking: boolean; active: number | null; words: readonly string[] }) => React.ReactNode }) {
  const speech = useLocalReadAloud(text, { rate: speechRateFor(band) })
  const kids = band === 'kids'
  const control = !speech.canReadAloud ? null : speech.speaking
    ? <Button variant="secondary" onClick={speech.onStop} className={cn(kids && 'min-w-44 text-[length:var(--ds-h3)]')}><Square size={kids ? 24 : 18} aria-hidden="true" />{kids ? 'Stop' : 'Stop reading'}</Button>
    : <Button variant={kids ? 'primary' : 'secondary'} onClick={speech.onReadAloud} className={cn(kids && 'min-w-44 text-[length:var(--ds-h3)]')}><Volume2 size={kids ? 28 : 18} aria-hidden="true" />{kids ? 'Read to me' : 'Listen'}</Button>
  return <>{children(control, { speaking: speech.speaking, active: speech.activeWordIndex, words: speech.words })}</>
}

const replyPose = (view: ReplyView): CoState => view.kind === 'safety' ? 'encouraging' : 'explaining'
const avatarSize = (band: LearnBand) => band === 'kids' ? 72 : band === 'tweens' ? 56 : 40

/** Source chips: where in the learner's own material the answer comes from. They open the library item (the reader). */
export function ReplySources({ sources, fallbackHref, band }: { sources: ReplyView['sources']; fallbackHref: string | null; band: LearnBand }) {
  if (sources.length === 0) return null
  const quoted = sources.filter(source => source.quote.trim())
  return <section aria-label="Where this comes from" data-testid="co-sources" className="space-y-2">
    <ul className="flex flex-wrap gap-2">
      {sources.map(source => {
        const href = linkHref(source.link) ?? fallbackHref
        const chip = <><BookOpen size={16} aria-hidden="true" />{sourceChipText(source)}</>
        return <li key={`${source.anchorRef}:${source.label}`}>{href
          ? <Link href={href} className="ds-pill border border-border hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring">{chip}</Link>
          : <span className="ds-pill border border-border">{chip}</span>}</li>
      })}
    </ul>
    {band !== 'kids' && quoted.length > 0 && <details className="text-[length:var(--ds-small)]">
      <summary className="cursor-pointer font-semibold text-muted-foreground">See the words from your material</summary>
      <div className="mt-2 space-y-2">{quoted.map(source => <blockquote key={`${source.anchorRef}:${source.label}`} className="border-s-4 border-primary ps-3 text-muted-foreground"><span className="font-semibold">{sourceChipText(source)}: </span>&ldquo;{source.quote}&rdquo;</blockquote>)}</div>
    </details>}
  </section>
}

/** Follow-up questions. Kids get big tap bubbles; everyone else gets compact chips. They send the question as a new message. */
export function SuggestionChips({ suggestions, band, onPick, disabled, label = 'Ask Co next' }: { suggestions: readonly string[]; band: LearnBand; onPick: (text: string) => void; disabled?: boolean; label?: string }) {
  if (suggestions.length === 0) return null
  const kids = band === 'kids'
  return <section aria-label={label} data-testid="co-suggestions">
    <ul className={cn('flex flex-wrap gap-2', kids && 'grid gap-3')}>
      {suggestions.map(text => <li key={text}>
        <button type="button" disabled={disabled} onClick={() => onPick(text)}
          className={cn('co-suggestion ds-pill border border-border text-start hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60',
            band === 'tweens' && 'min-h-[3rem]', band === 'teens' && 'min-h-[2.75rem]',
            kids && 'ds-speech-bubble min-h-16 w-full justify-start rounded-[var(--radius)] px-5 py-3 text-[length:var(--ds-h3)] font-bold')}>
          {text}
        </button>
      </li>)}
    </ul>
  </section>
}

/* ---------- a finished reply ---------- */

export interface ReplyCardProps {
  turn: CoTurnView
  band: LearnBand
  /** Where a source chip goes when the source carries no link of its own: the material in the library. */
  materialHref: string | null
  onSuggestion: (text: string) => void
  canAsk: boolean
  /** Follow-up chips belong to the newest reply only. */
  suggestions?: boolean
}

/**
 * A finished Co reply. Everything shown is decided by `replyView`: the "Beyond your material" tag appears only when the
 * server set it; a safety redirect shows the code-owned guidance verbatim and nothing else.
 */
export function CoReplyCard({ turn, band, materialHref, onSuggestion, canAsk, suggestions = true }: ReplyCardProps) {
  if (!turn.reply) return null
  const view = replyView(turn.reply)
  const kids = band === 'kids'
  const safety = view.kind === 'safety'
  return <ReplyReadAloud text={view.text} band={band}>{(listen, state) => <article aria-label={safety ? SAFETY_LABEL : 'Co’s answer'} data-testid={safety ? 'co-safety' : 'co-reply'} data-turn={turn.id} data-origin={view.origin}
    className={cn('co-reply flex gap-3 rounded-[var(--radius)] border p-3 sm:p-4', safety ? 'border-primary/50 bg-secondary' : 'border-border bg-card')}>
    <CoAvatar band={band} state={replyPose(view)} size={avatarSize(band)} className="shrink-0" />
    <div className="min-w-0 flex-1 space-y-3">
      {safety && <p className="flex items-center gap-2 font-extrabold text-primary" data-testid="co-safety-label"><ShieldCheck size={kids ? 28 : 22} aria-hidden="true" />{SAFETY_LABEL}</p>}
      {!safety && view.beyond && <p data-testid="co-beyond" className="inline-flex flex-wrap items-center gap-2 text-[length:var(--ds-small)]">
        <span className="ds-pill border border-primary/60 text-primary"><Compass size={16} aria-hidden="true" />Beyond your material</span>
        {view.beyondNote && <span className="text-muted-foreground" data-testid="co-beyond-note">{view.beyondNote}</span>}
      </p>}
      <SpokenText text={view.text} words={state.words} active={state.speaking ? state.active : null} kids={kids} />
      {listen}
      {!safety && view.keyPoints.length > 0 && <section aria-label="Key points" data-testid="co-key-points" className="space-y-1 rounded-[var(--radius)] bg-muted p-3">
        <h3 className="text-[length:var(--ds-h3)]">Key points</h3>
        <ul className="list-disc space-y-1 ps-6">{view.keyPoints.map(point => <li key={point}>{point}</li>)}</ul>
      </section>}
      {!safety && <ReplySources sources={view.sources} fallbackHref={materialHref} band={band} />}
      {!safety && suggestions && <SuggestionChips suggestions={view.suggestions} band={band} onPick={onSuggestion} disabled={!canAsk} />}
      {view.origin === 'AI' && turn.reply?.generatedBy.kind === 'AI'
        ? <AiOriginTag band={band} variant="helper" packVersion={turn.reply.generatedBy.packVersion} promptRelease={turn.reply.generatedBy.promptRelease} />
        : <p data-kind="code-origin" className="text-[length:var(--ds-small)] font-bold text-muted-foreground">Safety message from CoLearner</p>}
    </div>
  </article>}</ReplyReadAloud>
}

/* ---------- working, failed, stopped ---------- */

/** Co is really working: a thinking pose and a plain sentence. Never a partial answer, never a fake delay. */
export function PendingCard({ band, slow, onStop, stopping }: { band: LearnBand; slow: boolean; onStop: () => void; stopping: boolean }) {
  return <div data-testid="co-pending" className="flex items-center gap-3 rounded-[var(--radius)] border border-dashed border-border bg-card p-3 sm:p-4">
    <CoAvatar band={band} state="thinking" size={avatarSize(band)} className="shrink-0" />
    <div className="min-w-0 flex-1 space-y-1">
      <p className={cn('font-bold', band === 'kids' && 'text-[length:var(--ds-h3)]')}>{pendingLabel(band)}</p>
      {slow && <div className="space-y-1" data-testid="co-slow">
        <p className="text-[length:var(--ds-small)] text-muted-foreground">This is taking longer than usual.</p>
        <Button variant="secondary" onClick={onStop} loading={stopping}>Stop waiting</Button>
      </div>}
    </div>
  </div>
}

export function FailedCard({ turn, band, onRetry, retrying }: { turn: CoTurnView; band: LearnBand; onRetry: () => void; retrying: boolean }) {
  const retryable = turn.failure?.retryable ?? false
  return <div role="alert" data-testid="co-failed" className="flex gap-3 rounded-[var(--radius)] border border-destructive/50 bg-card p-3 sm:p-4">
    <CoAvatar band={band} state="encouraging" size={avatarSize(band)} className="shrink-0" />
    <div className="min-w-0 flex-1 space-y-2">
      <p className={cn('font-bold', band === 'kids' && 'text-[length:var(--ds-h3)]')}>Co could not answer that.</p>
      <p className="text-muted-foreground">{failureMessage(turn.failure)}{retryable ? ' You can try again.' : ' You can ask something else.'}</p>
      {retryable && <Button onClick={onRetry} loading={retrying} className={cn(band === 'kids' && 'min-w-44 text-[length:var(--ds-h3)]')}>Try again</Button>}
    </div>
  </div>
}

export function StoppedCard({ band }: { band: LearnBand }) {
  return <div data-testid="co-stopped" className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card p-3 text-muted-foreground">
    <CoAvatar band={band} state="idle" size={avatarSize(band)} className="shrink-0" />
    <p>That question was stopped. You can ask it again.</p>
  </div>
}

/** What the learner said, aligned to the inline end. */
export function LearnerBubble({ text, band }: { text: string; band: LearnBand }) {
  return <p data-testid="co-learner" className={cn('ms-auto w-fit max-w-[88%] whitespace-pre-wrap break-words rounded-[var(--radius)] rounded-ee-md bg-primary px-4 py-2 text-primary-foreground', band === 'kids' && 'text-[length:var(--ds-h3)] font-semibold')}>
    <span className="sr-only">You asked: </span>{text}
  </p>
}
