'use client'

import { useId, useState, type FormEvent } from 'react'
import { ArrowRight, Check, PartyPopper, X } from 'lucide-react'
import { Button, CoCharacter } from '@/components/design-system'
import type { LearnBand } from '@/lib/api/learn'
import type { HomeworkDetail } from '@/lib/api/co'
import { cn } from '@/lib/utils'
import type { ActionKind } from './homework-hooks'
import { finalLimit, maxFinalTries, problemLimit, responseLimit, type HomeworkView } from './homework-model'
import {
  AiLabel, CharCount, CoSays, FailurePanel, HintLadder, Journey, ParentNotice, SafetyPanel, StepTrail, ThinkingPanel, useFocusOnChange,
} from './homework-parts'

export interface HomeworkActions {
  confirmRestatement: (confirmed: boolean) => Promise<boolean>
  submitStep: (text: string) => Promise<boolean>
  requestHint: (level: 1 | 2 | 3) => Promise<boolean>
  goToFinal: () => Promise<boolean>
  submitFinal: (text: string) => Promise<boolean>
  /** In CAPTURE: replaces the problem text; Co then restates it again. */
  submitProblem: (problem: string) => Promise<boolean>
  /** Ends a checked session. */
  finish: () => Promise<boolean>
  retryFailed: () => Promise<boolean>
  /** Reads the session again (used when nothing seems to be happening). */
  refresh: () => void
  newProblem: () => void
  goHome: () => void
  leave: () => void
}
export type { ActionKind } from './homework-hooks'
/** The one action in flight (or the last one that failed). A hint request is reported separately so the ladder can show it. */
export interface ActionStatus { pending: boolean; kind: ActionKind | null; error: Error | null; errorKind: ActionKind | null }

export interface HomeworkSessionViewProps {
  detail: HomeworkDetail
  view: HomeworkView
  band: LearnBand
  actions: HomeworkActions
  status: ActionStatus
  /** Set when the server said the learner has no tries left on the final answer. */
  triesExhausted?: boolean
}

const bigButton = (band: LearnBand) => cn(band === 'kids' && 'text-[length:var(--ds-h3)]')

function ProblemCard({ problem, band }: { problem: string; band: LearnBand }) {
  return <section aria-label="The problem you are working on" data-testid="problem-card" className="ds-card space-y-1">
    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{band === 'kids' ? 'Your problem' : 'The problem'}</p>
    <p dir="auto" className={cn('whitespace-pre-line break-words font-bold', band === 'kids' && 'text-[length:var(--ds-h3)]')}>{problem}</p>
  </section>
}

/** The error of the last action, except a hint request (the ladder shows its own). */
function ActionError({ status }: { status: ActionStatus }) {
  if (!status.error || status.errorKind === 'hint') return null
  return <p role="alert" data-testid="action-error" className="ds-field-error">{status.error.message}</p>
}

/** A labelled multi-line box with a live character count; Ctrl+Enter sends. The text stays if sending fails. */
function AnswerBox({ label, value, onChange, limit, disabled, placeholder, rows }: { label: string; value: string; onChange: (value: string) => void; limit: number; disabled: boolean; placeholder: string; rows: number }) {
  const id = useId()
  const countId = useId()
  return <div className="ds-field">
    <label htmlFor={id}>{label}</label>
    <textarea id={id} dir="auto" value={value} rows={rows} maxLength={limit} disabled={disabled} placeholder={placeholder} spellCheck aria-describedby={countId}
      onChange={event => onChange(event.target.value.slice(0, limit))} className="ds-input min-h-28 resize-y leading-relaxed" />
    <CharCount id={countId} value={value} limit={limit} />
  </div>
}

/* ---------- phases ---------- */

function RestatePanel({ detail, band, actions, status }: Pick<HomeworkSessionViewProps, 'detail' | 'band' | 'actions' | 'status'>) {
  const heading = useFocusOnChange<HTMLHeadingElement>('restate')
  const restatement = detail.restatement ?? ''
  const kids = band === 'kids'
  return <section data-phase="restate" aria-labelledby="restate-title" className="space-y-5">
    <h2 id="restate-title" ref={heading} tabIndex={-1} className="sr-only">Check that Co understood</h2>
    <CoSays band={band} pose="asking" readText={`${restatement} Is that right?`} label="Co's version of your problem">
      <p data-testid="restatement">{restatement}</p>
      <p data-testid="restate-question">Is that right?</p>
    </CoSays>
    <div className="flex flex-wrap gap-3">
      <Button onClick={() => void actions.confirmRestatement(true)} loading={status.pending && status.kind === 'restatement'} className={bigButton(band)} data-testid="restate-yes"><Check size={kids ? 28 : 18} aria-hidden="true" />Yes</Button>
      <Button variant="secondary" onClick={() => void actions.confirmRestatement(false)} disabled={status.pending} className={bigButton(band)} data-testid="restate-no">Not quite</Button>
    </div>
    <ActionError status={status} />
  </section>
}

function CapturePanel({ detail, band, actions, status }: Pick<HomeworkSessionViewProps, 'detail' | 'band' | 'actions' | 'status'>) {
  const heading = useFocusOnChange<HTMLHeadingElement>('capture')
  const [text, setText] = useState(detail.session.problem)
  const limit = problemLimit[band]
  const submit = (event: FormEvent) => { event.preventDefault(); if (text.trim()) void actions.submitProblem(text.trim()) }
  return <section data-phase="capture" aria-labelledby="capture-title" className="space-y-5">
    <CoSays band={band} pose="curious">
      <h2 id="capture-title" ref={heading} tabIndex={-1} className="text-[length:inherit] font-extrabold">{band === 'kids' ? 'Let us fix the problem!' : 'Let us fix the problem'}</h2>
      <p>{band === 'kids' ? 'Change the words so I understand. Then I will try again.' : 'Change the words so Co understands it, then Co will try again.'}</p>
    </CoSays>
    <form onSubmit={submit} className="space-y-3">
      <AnswerBox label="The problem" value={text} onChange={setText} limit={limit} disabled={status.pending} placeholder="Type the problem here" rows={4} />
      <Button type="submit" loading={status.pending && status.kind === 'problem'} disabled={!text.trim()} className={bigButton(band)}>Check again</Button>
      <ActionError status={status} />
    </form>
  </section>
}

function StepsPanel({ detail, view, band, actions, status }: HomeworkSessionViewProps) {
  const step = view.step
  const heading = useFocusOnChange<HTMLHeadingElement>(`step:${step?.number ?? 'none'}`)
  const answerId = step?.number ?? 0
  // The draft belongs to one step: a new step starts with an empty box (the text of the step before never carries over).
  const [draft, setDraft] = useState<{ step: number; text: string }>({ step: answerId, text: '' })
  const text = draft.step === answerId ? draft.text : ''
  const setText = (value: string) => setDraft({ step: answerId, text: value })
  const limit = responseLimit[band]
  const busy = status.pending || view.pending !== null
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!text.trim() || busy) return
    if (await actions.submitStep(text.trim())) setText('')
  }
  if (!step) {
    return <section data-phase="steps" aria-labelledby="steps-wait" className="space-y-4">
      <h2 id="steps-wait" ref={heading} tabIndex={-1} className="sr-only">Waiting for the next step</h2>
      <StepTrail steps={detail.steps.filter(candidate => candidate.learnerResponse !== null)} />
      {view.pending ? <ThinkingPanel band={band} kind={view.pending.kind} /> : <p data-testid="no-step">There is no step to show right now.</p>}
      <Button variant="secondary" onClick={() => void actions.goToFinal()} disabled={busy}>I am ready to answer</Button>
      <ActionError status={status} />
    </section>
  }
  return <section data-phase="steps" aria-labelledby="step-title" className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="step-title" ref={heading} tabIndex={-1} data-testid="step-title" className="font-extrabold">Step {step.number}</h2>
    </div>
    <StepTrail steps={view.pastSteps} />
    <CoSays band={band} pose={view.hints.length > 0 ? 'hinting' : 'asking'} readText={step.prompt} label={`Co's question for step ${step.number}`}>
      <p data-testid="step-prompt">{step.prompt}</p>
    </CoSays>
    {view.pending && <ThinkingPanel band={band} kind={view.pending.kind} />}
    <form onSubmit={submit} className="space-y-3">
      <AnswerBox label="Your answer to this step" value={text} onChange={setText} limit={limit} disabled={busy} placeholder={band === 'kids' ? 'Type what you think' : 'Write what you think'} rows={band === 'teens' ? 4 : 3} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={status.pending && status.kind === 'step'} disabled={!text.trim() || busy} className={bigButton(band)} data-testid="step-send"><ArrowRight size={band === 'kids' ? 28 : 18} aria-hidden="true" />{band === 'kids' ? 'Done!' : 'Send'}</Button>
        <Button variant="ghost" onClick={() => void actions.goToFinal()} disabled={busy} data-testid="go-final" className={bigButton(band)}>I am ready to answer the problem</Button>
      </div>
      <ActionError status={status} />
    </form>
    <HintLadder band={band} hints={view.hints} next={view.hintNext} total={Math.min(3, detail.session.hintsMax)} requesting={status.pending && status.kind === 'hint'} error={status.errorKind === 'hint' ? status.error?.message ?? null : view.hintFailed ? 'Co could not find a hint just now. You can ask again.' : null} disabled={busy}
      onRequest={level => void actions.requestHint(level)} />
  </section>
}

function FinalPanel({ band, actions, status, view, detail }: Pick<HomeworkSessionViewProps, 'band' | 'actions' | 'status' | 'view' | 'detail'>) {
  const heading = useFocusOnChange<HTMLHeadingElement>('final')
  const [text, setText] = useState('')
  const id = useId()
  const countId = useId()
  const busy = status.pending || view.pending !== null
  const submit = async (event: FormEvent) => { event.preventDefault(); if (text.trim() && !busy) await actions.submitFinal(text.trim()) }
  const line = band === 'kids' ? 'Your turn! Type your answer. I will not tell you, but I will check it.'
    : band === 'tweens' ? 'Your turn. Type your own answer and I will check it. I will not tell you the answer.'
      : 'Enter your own answer. Co will check it, but will not give it to you.'
  return <section data-phase="final" aria-labelledby="final-title" className="space-y-5">
    <h2 id="final-title" ref={heading} tabIndex={-1} className="sr-only">Your answer</h2>
    <StepTrail steps={detail.steps.filter(step => step.learnerResponse !== null)} />
    <CoSays band={band} pose="encouraging" readText={line}><p data-testid="final-line">{line}</p></CoSays>
    <form onSubmit={submit} className="space-y-3">
      <div className="ds-field">
        <label htmlFor={id}>Your answer</label>
        <input id={id} dir="auto" value={text} maxLength={finalLimit} disabled={busy} autoComplete="off" spellCheck={false} aria-describedby={countId} data-testid="final-input"
          placeholder={band === 'kids' ? 'Type your answer' : 'Type your final answer'} onChange={event => setText(event.target.value.slice(0, finalLimit))} className="ds-input" />
        <CharCount id={countId} value={text} limit={finalLimit} />
      </div>
      <Button type="submit" loading={status.pending && status.kind === 'final'} disabled={!text.trim() || busy} className={bigButton(band)} data-testid="final-check">Check my answer</Button>
      <ActionError status={status} />
    </form>
  </section>
}

const onTrackLine: Record<LearnBand, string> = {
  kids: 'You did it! You worked it out yourself!',
  tweens: 'You did it! You worked that out yourself.',
  teens: 'That looks right, and you worked it out yourself.',
}
const notYetLine = 'Not quite yet. Check the last step again.'
const unclearLine = 'I could not tell what you meant. Try writing your answer a different way.'

function CheckedPanel({ detail, view, band, actions, status, triesExhausted }: HomeworkSessionViewProps) {
  const final = detail.final
  const verdict = view.verdict
  // "Try again" opens the answer box for THIS result only: a new result (or a new try) closes it again, without an effect that could race the press.
  const result = `${final?.answer ?? ''}:${verdict ?? ''}`
  const [againFor, setAgainFor] = useState<string | null>(null)
  const again = againFor === result
  const exhausted = !!triesExhausted || view.finalTriesUsed >= maxFinalTries
  const heading = useFocusOnChange<HTMLHeadingElement>(`checked:${result}:${again}`)
  if (again && !exhausted) return <FinalPanel band={band} actions={actions} status={status} view={view} detail={detail} />
  const onTrack = verdict === 'on_track'
  const line = onTrack ? onTrackLine[band] : verdict === 'unclear' ? unclearLine : notYetLine
  return <section data-phase="checked" data-verdict={verdict ?? 'none'} aria-labelledby="checked-title" className={cn('space-y-5', onTrack && 'ds-card border-2 border-primary')}>
    {final && <p data-testid="your-answer" className="text-[length:var(--ds-small)] text-muted-foreground"><span className="font-bold text-foreground">Your answer:</span> <span dir="auto">{final.answer}</span></p>}
    <CoSays band={band} pose={onTrack ? 'celebrating' : 'encouraging'} readText={`${line} ${final?.feedback ?? ''}`.trim()}>
      <h2 id="checked-title" ref={heading} tabIndex={-1} data-testid="checked-title" className="flex items-center gap-2 text-[length:inherit] font-extrabold">{onTrack && <PartyPopper size={band === 'kids' ? 32 : 24} aria-hidden="true" />}{line}</h2>
      {final?.feedback && <p data-testid="check-feedback" className="font-normal">{final.feedback}</p>}
    </CoSays>
    {onTrack
      ? <div className="flex flex-wrap gap-3"><Button onClick={actions.newProblem} className={bigButton(band)}>New problem</Button><Button variant="secondary" onClick={actions.goHome}>Back home</Button></div>
      : exhausted
        ? <div className="space-y-3" data-testid="tries-used">
          <p>You have used all your tries on this one. That is okay. Ask your teacher or a grown-up to look at it with you.</p>
          <div className="flex flex-wrap gap-3"><Button onClick={() => void actions.finish()} loading={status.pending && status.kind === 'finish'} className={bigButton(band)} data-testid="finish">Finish</Button><Button variant="secondary" onClick={actions.newProblem}>New problem</Button></div>
        </div>
        : <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setAgainFor(result)} className={bigButton(band)} data-testid="try-again">Try my answer again</Button>
          <span className="text-[length:var(--ds-small)] text-muted-foreground">Try {Math.min(maxFinalTries, view.finalTriesUsed + 1)} of {maxFinalTries} next</span>
          <Button variant="ghost" onClick={() => void actions.finish()} loading={status.pending && status.kind === 'finish'} data-testid="finish">Finish for now</Button>
        </div>}
    <ActionError status={status} />
  </section>
}

function DonePanel({ detail, view, band, actions }: Pick<HomeworkSessionViewProps, 'detail' | 'view' | 'band' | 'actions'>) {
  const heading = useFocusOnChange<HTMLHeadingElement>('done')
  const onTrack = view.verdict === 'on_track'
  return <section data-phase="done" data-verdict={view.verdict ?? 'none'} aria-labelledby="done-title" className={cn('space-y-5', onTrack && 'ds-card border-2 border-primary')}>
    {detail.final && <p data-testid="your-answer" className="text-[length:var(--ds-small)] text-muted-foreground"><span className="font-bold text-foreground">Your answer:</span> <span dir="auto">{detail.final.answer}</span></p>}
    <CoSays band={band} pose={onTrack ? 'celebrating' : 'encouraging'} readText={onTrack ? onTrackLine[band] : 'This one is finished.'}>
      <h2 id="done-title" ref={heading} tabIndex={-1} data-testid="done-title" className="flex items-center gap-2 text-[length:inherit] font-extrabold">
        {onTrack ? <><PartyPopper size={band === 'kids' ? 32 : 24} aria-hidden="true" />{onTrackLine[band]}</> : 'This one is finished'}
      </h2>
      {detail.final?.feedback && <p className="font-normal" data-testid="check-feedback">{detail.final.feedback}</p>}
      {!onTrack && <p className="font-normal" data-testid="done-neutral">Co could not confirm your answer this time. Ask your teacher or a grown-up to look at it with you.</p>}
    </CoSays>
    <div className="flex flex-wrap gap-3"><Button onClick={actions.newProblem} className={bigButton(band)}>New problem</Button><Button variant="secondary" onClick={actions.goHome}>Back home</Button></div>
  </section>
}

/** Nothing is pending and nothing is ready (for example a result that has not been written yet): say so, and offer to look again. */
function StalledPanel({ band, actions }: Pick<HomeworkSessionViewProps, 'band' | 'actions'>) {
  return <section data-state="stalled" className="ds-state">
    <CoCharacter band={band} state="curious" decorative />
    <h2>Nothing new yet</h2>
    <p>Co has not sent anything for this part yet. Your work is saved.</p>
    <div className="flex flex-wrap justify-center gap-3"><Button onClick={actions.refresh}>Look again</Button><Button variant="secondary" onClick={actions.leave}>Back to homework help</Button></div>
  </section>
}

function ClosedPanel({ band, actions }: Pick<HomeworkSessionViewProps, 'band' | 'actions'>) {
  return <section data-phase="abandoned" className="ds-state">
    <CoCharacter band={band} state="sleepy" decorative />
    <h2>This homework help was closed</h2>
    <p>You can start a new problem whenever you like.</p>
    <Button onClick={actions.newProblem}>New problem</Button>
  </section>
}

/**
 * The homework session as the server holds it: header, journey, notices and the phase the learner is in. Every
 * transition that needs Co shows a real thinking state; a failed turn can be retried; a safety redirect pauses the session.
 */
export function HomeworkSessionView(props: HomeworkSessionViewProps) {
  const { detail, view, band, actions, status } = props
  const phase = detail.session.phase
  const [dismissed, setDismissed] = useState<string | null>(null)
  const safetyHeading = useFocusOnChange<HTMLHeadingElement>(`safety:${view.safety?.id ?? 'none'}`)
  const showSafety = view.safety !== null && dismissed !== view.safety.id
  const trustedAdult = view.safety?.reply.disposition === 'TRUSTED_ADULT'
  let body
  if (phase === 'ABANDONED') body = <ClosedPanel band={band} actions={actions} />
  else if (showSafety && view.safety) body = <SafetyPanel band={band} reply={view.safety.reply} headingRef={safetyHeading} onLeave={actions.leave} onContinue={trustedAdult ? null : () => setDismissed(view.safety!.id)} />
  else if (view.failed) body = <FailurePanel band={band} retryable={view.failed.failure?.retryable ?? false} onRetry={() => void actions.retryFailed()} retrying={status.pending && status.kind === 'retry'} error={status.errorKind === 'retry' ? status.error : null} onLeave={actions.leave} />
  else if (phase === 'STEPS') body = <StepsPanel {...props} />
  else if (view.pending) body = <ThinkingPanel band={band} kind={view.pending.kind ?? (phase === 'RESTATE' || phase === 'CAPTURE' ? 'HW_RESTATE' : phase === 'FINAL' || phase === 'CHECKED' ? 'HW_CHECK' : undefined)} />
  else if (phase === 'RESTATE' && detail.restatement) body = <RestatePanel detail={detail} band={band} actions={actions} status={status} />
  else if (phase === 'CAPTURE') body = <CapturePanel detail={detail} band={band} actions={actions} status={status} />
  else if ((phase === 'FINAL' || phase === 'CHECKED') && !detail.final?.verdict) body = <FinalPanel band={band} actions={actions} status={status} view={view} detail={detail} />
  else if (phase === 'FINAL' || phase === 'CHECKED') body = <CheckedPanel {...props} />
  else if (phase === 'DONE') body = <DonePanel detail={detail} view={view} band={band} actions={actions} />
  else body = <StalledPanel band={band} actions={actions} />
  // The problem stays visible for every step of the way except while a safety check or a closed session is shown.
  const showProblem = phase !== 'ABANDONED' && !showSafety && phase !== 'CAPTURE'
  return <div className="space-y-5" data-testid="homework-view" data-phase={phase} data-band={band}>
    <div className="flex flex-wrap items-center gap-3">
      <Journey band={band} phase={phase} />
      <AiLabel />
    </div>
    <ParentNotice band={band} mode={detail.session.parentVisibility.mode} />
    {showProblem && <ProblemCard problem={detail.session.problem} band={band} />}
    {body}
  </div>
}

/** The close button of the focused header. */
export function CloseButton({ onClick }: { onClick: () => void }) {
  return <Button variant="ghost" aria-label="Leave homework help" onClick={onClick} data-testid="leave"><X size={22} aria-hidden="true" /></Button>
}
