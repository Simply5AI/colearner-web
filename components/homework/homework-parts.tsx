'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Check, Lightbulb, ShieldCheck, Sparkles, Square, Volume2 } from 'lucide-react'
import { Button, CoCharacter, type CoState } from '@/components/design-system'
import type { LearnBand } from '@/lib/api/learn'
import type { CoReply, HomeworkStep } from '@/lib/api/co'
import { useLocalReadAloud } from '@/lib/hooks/use-read-aloud'
import { cn } from '@/lib/utils'
import {
  AI_LABEL, charsLeft, hintButtonLabel, hintLabels, journeyIndex, parentNotice, phaseSteps, safetyText,
  type HintShown, type HomeworkView,
} from './homework-model'

/* ---------- small shared pieces ---------- */

/** A polite live region whose text can repeat: the same sentence twice in a row is announced twice. */
export function useAnnouncer() {
  const [announcement, setAnnouncement] = useState('')
  const tick = useRef(0)
  const announce = useCallback((message: string) => {
    tick.current += 1
    setAnnouncement(message ? `${message}${tick.current % 2 === 0 ? '​' : ''}` : '')
  }, [])
  return { announcement, announce }
}

/** Panels move focus to their heading when they appear or change (the page sits in a focused frame, so focus must land inside it). */
export function useFocusOnChange<T extends HTMLElement>(key: string) {
  const ref = useRef<T>(null)
  // A layout effect: focus lands in the same commit that shows the panel, so a screen reader never reads a stale position.
  useLayoutEffect(() => { ref.current?.focus() }, [key])
  return ref
}

/** Device read-aloud: local voices only, nothing autoplays, and no control at all when the device cannot speak. */
export function CoReadAloud({ text, band }: { text: string; band: LearnBand }) {
  const speech = useLocalReadAloud(text, { rate: band === 'kids' ? 0.85 : 1 })
  if (!speech.canReadAloud || !text.trim()) return null
  const kids = band === 'kids'
  return speech.speaking
    ? <Button variant="secondary" onClick={speech.onStop} aria-label="Stop reading" data-testid="read-aloud"><Square size={kids ? 24 : 18} aria-hidden="true" />{kids ? 'Stop' : 'Stop reading'}</Button>
    : <Button variant="secondary" onClick={speech.onReadAloud} aria-label={kids ? 'Read to me' : 'Read aloud'} data-testid="read-aloud"><Volume2 size={kids ? 24 : 18} aria-hidden="true" />{kids ? 'Read to me' : 'Listen'}</Button>
}

/** Says out loud, in a visible label, that Co is an AI helper (the model is never presented as a person or a teacher). */
export function AiLabel({ className }: { className?: string }) {
  return <span data-testid="ai-label" className={cn('ds-pill', className)}><Sparkles size={16} aria-hidden="true" />{AI_LABEL}</span>
}

/** Who can see this homework help. The wording is by age band and follows the snapshot the server sent. */
export function ParentNotice({ band, mode, className }: { band: LearnBand; mode: 'FULL' | 'SUMMARY' | null | undefined; className?: string }) {
  return <p data-testid="parent-notice" className={cn('flex items-start gap-2 text-[length:var(--ds-small)] text-muted-foreground', className)}>
    <ShieldCheck size={band === 'kids' ? 22 : 16} aria-hidden="true" className="mt-0.5 flex-none" /><span>{parentNotice(band, mode)}</span>
  </p>
}

export function CharCount({ value, limit, id }: { value: string; limit: number; id: string }) {
  const count = charsLeft(value, limit)
  return <p id={id} className="flex flex-wrap items-center justify-between gap-2 text-[length:var(--ds-small)] text-muted-foreground">
    <span data-testid="char-count">{count.used} / {limit} characters</span>
    <span role="status" aria-live="polite" className={count.close ? 'font-bold text-foreground' : 'sr-only'}>{count.close ? `${Math.max(0, count.left)} characters left` : ''}</span>
  </p>
}

/** Co beside what it says. Kids get a large Co and big words; teens a compact row. */
export function CoSays({ band, pose, children, readText, label = 'Co says', testId = 'co-says' }: { band: LearnBand; pose: CoState; children: ReactNode; readText?: string; label?: string; testId?: string }) {
  const kids = band === 'kids'
  return <section aria-label={label} data-testid={testId} data-co-pose={pose} className={cn('flex flex-wrap items-center gap-4', kids && 'gap-6')}>
    <CoCharacter band={band} state={pose} decorative size={band === 'teens' ? 56 : kids ? 160 : 112}
      className={band === 'teens' ? 'size-14 flex-none' : kids ? 'size-24 flex-none sm:size-40' : 'size-20 flex-none sm:size-28'} />
    <div className="ds-speech-bubble !block min-w-0 flex-1 basis-64 space-y-3">
      <div className={cn('min-w-0 space-y-2 break-words', kids ? 'text-[length:var(--ds-h3)] font-extrabold leading-snug' : 'font-bold')}>{children}</div>
      {readText && <CoReadAloud text={readText} band={band} />}
    </div>
  </section>
}

/* ---------- journey ---------- */

export function Journey({ band, phase }: { band: LearnBand; phase: Parameters<typeof journeyIndex>[0] }) {
  const current = journeyIndex(phase)
  return <ol aria-label="Where you are" data-testid="journey" className="flex flex-wrap items-center gap-2">
    {phaseSteps.map((label, index) => <li key={label} aria-current={index === current ? 'step' : undefined} data-done={index < current} className={cn('ds-pill', index === current && 'border-2 border-primary bg-secondary', index < current && 'opacity-80')}>
      {index < current && <Check size={14} aria-hidden="true" />}{band === 'kids' ? `${index + 1}. ` : ''}{label}
    </li>)}
  </ol>
}

/* ---------- pending, failure, safety ---------- */

const thinkingText: Record<string, string> = {
  HW_RESTATE: 'Co is reading your problem.',
  HW_STEP: 'Co is thinking about the next step.',
  HW_HINT: 'Co is finding a hint.',
  HW_CHECK: 'Co is looking at your answer.',
}
/** A real pending state: Co thinks while the server works. It never shows partial text and never fakes a delay. */
export function ThinkingPanel({ band, kind }: { band: LearnBand; kind?: string }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => { const timer = setTimeout(() => setSlow(true), 20000); return () => clearTimeout(timer) }, [])
  const kids = band === 'kids'
  return <section data-state="thinking" aria-label="Co is thinking" className="ds-state">
    <CoCharacter band={band} state="thinking" decorative />
    <div role="status" aria-live="polite" className="space-y-2">
      <h2 data-testid="thinking-title" className="font-extrabold">Co is thinking</h2>
      <p>{(kind && thinkingText[kind]) ?? 'Co is working on it.'}</p>
      <p className="text-muted-foreground">{slow ? 'This is taking a little longer than usual. You can keep waiting, or leave and come back: your place is saved.' : kids ? 'One moment!' : 'This usually takes a few seconds.'}</p>
    </div>
  </section>
}

/** The turn did not finish. Only a retryable failure offers Try again; nothing the learner typed is lost. */
export function FailurePanel({ band, retryable, onRetry, retrying, error, onLeave }: { band: LearnBand; retryable: boolean; onRetry: () => void; retrying: boolean; error: Error | null; onLeave: () => void }) {
  return <section data-state="failed" aria-label="Co could not finish" role="alert" className="ds-state ds-error-state">
    <CoCharacter band={band} state="encouraging" decorative />
    <h2>Co could not finish that</h2>
    <p>Something went wrong on our side. Your work is saved.{retryable ? ' You can try again.' : ''}</p>
    {error && <p role="alert" className="ds-field-error" data-testid="retry-error">{error.message}</p>}
    <div className="flex flex-wrap justify-center gap-3">
      {retryable && <Button onClick={onRetry} loading={retrying}>Try again</Button>}
      <Button variant="secondary" onClick={onLeave}>Back to homework help</Button>
    </div>
  </section>
}

/**
 * A safety redirect: a shield, "Safety check" and the code-owned guidance, verbatim. Co's own words are never used here.
 * The session pauses: nothing can be answered until the learner chooses to go back to the problem (not offered when the
 * redirect points to a trusted adult).
 */
export function SafetyPanel({ band, reply, onContinue, onLeave, headingRef }: { band: LearnBand; reply: CoReply; onContinue: (() => void) | null; onLeave: () => void; headingRef: React.Ref<HTMLHeadingElement> }) {
  const guidance = safetyText(reply)
  const id = useId()
  return <section data-state="safety" data-disposition={reply.disposition} aria-labelledby={id} className="ds-state border-2 border-primary">
    <CoCharacter band={band} state="encouraging" decorative />
    <h2 id={id} ref={headingRef} tabIndex={-1} className="flex items-center gap-2 font-extrabold"><ShieldCheck size={band === 'kids' ? 32 : 24} aria-hidden="true" />Safety check</h2>
    <p role="status" data-testid="safety-guidance" className="whitespace-pre-line !text-foreground">{guidance}</p>
    <CoReadAloud text={guidance} band={band} />
    <p className="text-[length:var(--ds-small)] text-muted-foreground">Your homework help is paused. Nothing more is asked until you are ready.</p>
    <div className="flex flex-wrap justify-center gap-3">
      <Button onClick={onLeave}>Back to homework help</Button>
      {onContinue && <Button variant="secondary" onClick={onContinue}>Go back to my problem</Button>}
    </div>
  </section>
}

/* ---------- hints ---------- */

export interface HintLadderProps {
  band: LearnBand
  hints: HintShown[]
  next: HomeworkView['hintNext']
  /** How many rungs the school allows for this step (0..3). */
  total: number
  requesting: boolean
  error: string | null
  onRequest: (level: 1 | 2 | 3) => void
  disabled?: boolean
}
/**
 * The three hint rungs, asked for ONE AT A TIME from the server: a rung is requested only when the learner presses the
 * button, and only the next one in order. Nothing is fetched ahead. When the school allows fewer rungs (or none) the
 * button is disabled and says why. The ladder has no "show the answer".
 */
export function HintLadder({ band, hints, next, total, requesting, error, onRequest, disabled }: HintLadderProps) {
  const listId = useId()
  const reasonId = useId()
  const labels = hintLabels[band]
  const kids = band === 'kids'
  return <section aria-label="Hints" className="ds-hint-ladder" data-testid="hint-ladder" data-hints-shown={hints.length}>
    {hints.length > 0 && <ol id={listId} className="ds-hint-rungs">
      {hints.map(hint => <li key={hint.level} data-hint-level={hint.level}>
        <h3><Lightbulb aria-hidden="true" size={18} />{labels[hint.level - 1]}</h3>
        <p className="whitespace-pre-line">{hint.text}</p>
        <CoReadAloud text={hint.text} band={band} />
      </li>)}
    </ol>}
    {error && <p role="alert" className="ds-field-error" data-testid="hint-error">{error}</p>}
    <div className="flex flex-wrap items-center gap-3">
      {next.level !== null
        ? <Button variant="secondary" onClick={() => onRequest(next.level)} loading={requesting} disabled={disabled} aria-controls={hints.length > 0 ? listId : undefined} data-testid="hint-button" className={cn(kids && 'text-[length:var(--ds-h3)]')}>
          <Lightbulb size={kids ? 24 : 18} aria-hidden="true" />{hintButtonLabel(band, hints.length)}
        </Button>
        : <div className="grid gap-1" data-testid="hint-unavailable">
          <Button variant="secondary" disabled aria-disabled="true" aria-describedby={reasonId}><Lightbulb size={18} aria-hidden="true" />{hints.length === 0 ? 'Need a hint?' : 'No more hints'}</Button>
          <p id={reasonId} className="text-[length:var(--ds-small)] text-muted-foreground">{next.reason}</p>
        </div>}
      <span role="status" aria-live="polite" className="text-[length:var(--ds-small)] text-muted-foreground">{hints.length > 0 ? `${hints.length} of ${Math.max(hints.length, total)} hints shown` : ''}</span>
    </div>
  </section>
}

/** The steps already answered: a short trail the learner can look back at. */
export function StepTrail({ steps }: { steps: HomeworkStep[] }) {
  if (steps.length === 0) return null
  return <ol aria-label="Steps you have done" data-testid="step-trail" className="grid gap-2">
    {steps.map(step => <li key={step.number} className="ds-card space-y-1 !p-3 text-[length:var(--ds-small)]">
      <p className="font-bold">Step {step.number}: {step.prompt}</p>
      <p className="text-muted-foreground"><span className="font-bold text-foreground">You:</span> <span dir="auto">{step.learnerResponse}</span></p>
    </li>)}
  </ol>
}
