'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { ArrowLeft, ArrowRight, Check, Mic, X } from 'lucide-react'
import { AskCoLauncher } from '@/components/co/co-launcher'
import { Button } from '@/components/design-system'
import { linkHref, type LearnBand } from '@/lib/api/learn'
import { isAccessChangedError, lessonApi, lessonErrorMessage, notesAllowed, type LessonContentView, type LessonDetail } from '@/lib/api/lesson'
import { useLocalReadAloud } from '@/lib/hooks/use-read-aloud'
import { cn } from '@/lib/utils'
import { LessonCheck } from './lesson-check'
import { LessonFocusFrame } from './lesson-focus-frame'
import { useAdoptLessonDetail, useLessonProgress, useMaterialSourceUrl, useRefreshLesson } from './lesson-hooks'
import { buildScript, coPose, speechRate, stepName } from './lesson-model'
import { NotesPanel, useLessonNotes } from './lesson-notes'
import { AiOriginTag, CoPanel, LessonBlocks, SourceChips } from './lesson-parts'
import type { LessonTabsSlot } from './lesson-tabs'
import { ReadAloudControl, SpeechProvider } from './lesson-speech'

const STEP_COUNT = 5
/** A field where typing text is the point, so "/" and the arrows belong to the field. */
const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || target instanceof HTMLTextAreaElement
  || (target instanceof HTMLInputElement && !['button', 'checkbox', 'radio', 'submit', 'reset'].includes(target.type)))
/** Radio groups and selects use the arrow keys themselves, so they keep them. */
const ownsArrows = (target: EventTarget | null) => isTyping(target) || (target instanceof Element && target.closest('[role="tablist"]') !== null) || (target instanceof HTMLInputElement && target.type === 'radio') || target instanceof HTMLSelectElement

/** Ask Co cannot answer here (the server said so). The control keeps the layout and the "/" shortcut real, but it never acts and always says why. */
function AskCoControl({ band, reason, controlRef }: { band: LearnBand; reason: string; controlRef: React.RefObject<HTMLButtonElement | null> }) {
  const reasonId = useId()
  const kids = band === 'kids'
  return <div className={cn('grid gap-1', kids && 'justify-items-center')} data-testid="ask-co">
    <button ref={controlRef} type="button" aria-disabled="true" aria-describedby={reasonId} onClick={event => event.preventDefault()}
      className={cn('ds-button ds-button-secondary cursor-not-allowed opacity-70', kids && 'min-h-[4.5rem] min-w-[4.5rem] rounded-full px-6 text-[length:var(--ds-h3)]')}>
      <Mic size={kids ? 32 : 18} aria-hidden="true" />Ask Co
    </button>
    <p id={reasonId} className="text-[length:var(--ds-small)] text-muted-foreground">{reason}</p>
  </div>
}

export interface LessonPlayerProps {
  detail: LessonDetail
  content: LessonContentView
  band: LearnBand
  /** Leaves the lesson (router navigation supplied by the screen). */
  onExit: () => void
  /** Read-only look back at a finished lesson: progress is not written. */
  review?: boolean
  /** Dev harness only: shorter timings. */
  timing?: { debounceMs?: number; retryBaseMs?: number }
  /** Topic tabs (pack 0.1.11): the tab bar is shown inside the focused frame, and the step area is the tab's panel. */
  tabs?: LessonTabsSlot
}

/**
 * F-L7-01/02/03: the five-step player. Focused mode, back/next/exit with persisted step completion, per-band layout,
 * embedded CHECK, citations on every sourced step, on-device read-aloud, notes for 10 to 17, and a disabled Ask Co.
 */
export function LessonPlayer({ detail, content, band, onExit, review = false, timing, tabs }: LessonPlayerProps) {
  const lessonId = detail.lesson.id
  const refresh = useRefreshLesson(lessonId)
  const adopt = useAdoptLessonDetail(lessonId)
  const loadCurrent = useCallback(async () => (await lessonApi.detail(lessonId)).progress, [lessonId])
  const progress = useLessonProgress({ lessonId, initial: review ? { ...detail.progress, currentStep: 0 } : detail.progress, loadCurrent, persist: !review, onAccessChanged: () => void refresh(), ...timing })
  const { current, completed, status, go } = progress
  const step = content.steps[current] ?? content.steps[0]!
  const stepIndex = Math.min(current, STEP_COUNT - 1)
  const notes = useLessonNotes(lessonId, refresh)
  const noteBand = notesAllowed(detail.lesson.band)
  const materialHref = linkHref(detail.source.materialLink)
  const hasVideoMoments = content.steps.some(item => item.sources.some(source => typeof source.startMs === 'number'))
  const sourceUrl = useMaterialSourceUrl(detail.lesson.materialId, hasVideoMoments)

  const script = useMemo(() => buildScript(step), [step])
  const speech = useLocalReadAloud(script.text, { rate: speechRate(band) })
  const [hints, setHints] = useState(0)
  const [announcement, setAnnouncement] = useState('')
  const [exitOpen, setExitOpen] = useState(false)
  const [askOpen, setAskOpen] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement | null>(null)
  const askCo = useRef<HTMLButtonElement>(null)
  const headingId = useId()
  const kids = band === 'kids'

  // Each step starts with focus on its heading and a polite announcement; speech and hints never carry over.
  // The heading may mount after this effect (the focused frame attaches after first paint), so a ref callback finishes the job.
  const needsFocus = useRef(true)
  const headingRef = useCallback((node: HTMLHeadingElement | null) => {
    heading.current = node
    if (node && needsFocus.current) { needsFocus.current = false; node.focus() }
  }, [])
  useEffect(() => {
    setHints(0)
    needsFocus.current = true
    if (heading.current) { needsFocus.current = false; heading.current.focus() }
    setAnnouncement(`Step ${stepIndex + 1} of ${STEP_COUNT}: ${stepName(step.kind, band)}. ${step.title}`)
  }, [stepIndex, step.kind, step.title, band])

  const solved = completed.includes(current)
  const canNext = step.kind !== 'CHECK' || solved
  const last = current === STEP_COUNT - 1

  const finish = useCallback(async () => {
    if (finishing) return
    setFinishing(true); setFinishError(null)
    try {
      go(STEP_COUNT - 1, STEP_COUNT - 1)
      if (!await progress.settle()) { setFinishError('We could not save your last step yet. Check your connection and try again.'); return }
      await adopt(await lessonApi.complete(lessonId))
    } catch (error) {
      if (isAccessChangedError(error)) { void refresh(); return }
      setFinishError(lessonErrorMessage(error, 'The lesson could not be finished. Your progress is saved; try again.'))
    } finally { setFinishing(false) }
  }, [adopt, finishing, go, lessonId, progress, refresh])

  const next = useCallback(() => {
    if (!canNext || finishing) return
    if (last) {
      if (review) { onExit(); return }
      void finish()
    } else go(current + 1, review || completed.includes(current) ? undefined : current)
  }, [canNext, completed, current, finish, finishing, go, last, onExit, review])
  const back = useCallback(() => { if (current > 0) go(current - 1) }, [current, go])

  const requestExit = useCallback(() => { speech.onStop(); setExitOpen(true) }, [speech])
  const leave = async () => { await progress.settle(); onExit() }

  // Keyboard: arrows move (logical direction in RTL), Escape asks to leave, "/" reaches Ask Co (and opens it when it is available).
  // While Ask Co or the leave question is open they own the keyboard.
  const askAvailable = detail.askCo.status === 'AVAILABLE'
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || exitOpen || askOpen) return
      if (event.key === 'Escape') { event.preventDefault(); requestExit(); return }
      if (event.key === '/') { if (isTyping(event.target)) return; event.preventDefault(); askCo.current?.focus(); if (askAvailable) askCo.current?.click(); return }
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      if (ownsArrows(event.target)) return
      const rtl = (document.documentElement.dir || getComputedStyle(document.documentElement).direction) === 'rtl'
      const forward = (event.key === 'ArrowRight') !== rtl
      event.preventDefault()
      if (forward) next(); else back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [askAvailable, askOpen, back, exitOpen, next, requestExit])

  const dots = Array.from({ length: STEP_COUNT }, (_, index) => index)
  const askReason = detail.askCo.reason ?? 'Asking Co questions is not ready yet.'
  // B10: only a server-confirmed AVAILABLE state opens the real panel, at the step the learner is on; anything else keeps the reason.
  const ask = askAvailable
    ? <AskCoLauncher band={band} controlRef={askCo} context={{ kind: 'LESSON', lessonId: detail.askCo.context?.lessonId ?? lessonId, stepIndex }} materialHref={materialHref}
      onOpenChange={open => { if (open) speech.onStop(); setAskOpen(open) }} />
    : <AskCoControl band={band} reason={askReason} controlRef={askCo} />
  const saveText = status === 'saving' ? 'Saving your place…' : status === 'saved' ? 'Your place is saved' : status === 'error' ? 'We could not save your place yet.' : ''
  const pose = coPose(step.kind, band, hints > 0)

  return <LessonFocusFrame band={band} label={`Lesson: ${content.title}`}>
    <SpeechProvider active={speech.activeWordIndex} starts={script.starts}>
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-5 px-4 pb-6 pt-3 sm:px-7" data-band={band} data-step={step.kind}>
        <header className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" aria-label="Close lesson" onClick={requestExit}><X size={22} aria-hidden="true" /></Button>
          <div className="min-w-0 flex-1 basis-56">
            <h1 className="truncate text-[length:var(--ds-h2)] leading-tight">{content.title}</h1>
            <AiOriginTag band={band} packVersion={detail.generatedBy.packVersion} promptRelease={detail.generatedBy.promptRelease} />
          </div>
          <div className="flex items-center gap-3" data-testid="lesson-progress">
            <div role="img" aria-label={`Step ${stepIndex + 1} of ${STEP_COUNT}`} className="flex items-center gap-2">
              {dots.map(index => <span key={index} aria-hidden="true" data-state={index === stepIndex ? 'current' : completed.includes(index) ? 'done' : 'todo'}
                className={cn('block rounded-full border-2 border-primary', kids ? 'size-6' : 'size-4', (completed.includes(index) || index === stepIndex) && 'bg-primary', index === stepIndex && 'ring-2 ring-primary ring-offset-2 ring-offset-background')} />)}
            </div>
            <span aria-hidden="true" className="font-bold">{stepIndex + 1} of {STEP_COUNT}</span>
          </div>
        </header>

        {tabs?.bar}
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="lesson-announcer">{announcement}</div>

        <div role={tabs ? 'tabpanel' : undefined} id={tabs?.panelId} aria-labelledby={tabs?.tabId} className={cn('grid flex-1 items-start gap-6', band !== 'teens' && 'lg:grid-cols-[minmax(12rem,17rem)_minmax(0,1fr)]')}>
          {band !== 'teens' && <CoPanel band={band} pose={pose} line={step.coLine}>{ask}</CoPanel>}
          <article aria-labelledby={headingId} className="ds-card min-w-0 space-y-6 !p-5 sm:!p-7" data-testid="lesson-step">
            <div className="space-y-2">
              <p className="text-[length:var(--ds-caption)] font-bold uppercase tracking-widest text-primary">Step {stepIndex + 1} of {STEP_COUNT} · {stepName(step.kind, band)}</p>
              <h2 id={headingId} ref={headingRef} tabIndex={-1} className="outline-none">{step.title}</h2>
            </div>
            <ReadAloudControl speech={speech} band={band} note={detail.readAloud.note} />
            {step.kind === 'INTRO' && content.objectives.length > 0 && <section aria-label="What you will learn" className="space-y-2">
              <h3 className="text-[length:var(--ds-h3)]">{kids ? 'Today we will learn' : 'What you will learn'}</h3>
              <ul className="list-disc space-y-1 ps-6">{content.objectives.map(objective => <li key={objective}>{objective}</li>)}</ul>
            </section>}
            <LessonBlocks blocks={step.blocks} band={band} content={content} stepIndex={stepIndex}
              onSaveTerm={noteBand ? termIndex => notes.add.mutate({ stepIndex, termIndex }) : undefined} savingTerm={notes.add.isPending} />
            {step.kind === 'CHECK' && step.check && <LessonCheck key={`${lessonId}:${stepIndex}`} lessonId={lessonId} stepIndex={stepIndex} check={step.check} sources={step.sources} band={band}
              alreadyDone={solved} onCorrect={() => go(current, current)} onHintsChange={setHints} onAccessChanged={() => void refresh()} />}
            {step.kind === 'RECAP' && <>
              {content.keyTerms.length > 0 && band !== 'kids' && <section aria-label="Key words" className="space-y-2">
                <h3 className="text-[length:var(--ds-h3)]">Key words</h3>
                <dl className="grid gap-3 sm:grid-cols-2">{content.keyTerms.map(term => <div key={term.term} className="rounded-[var(--radius)] border border-border p-3"><dt className="font-bold text-primary">{term.term}</dt><dd>{term.definition}</dd></div>)}</dl>
              </section>}
              {content.unknowns.length > 0 && <section aria-label="Not in your material" data-testid="unknowns" className="space-y-2 rounded-[var(--radius)] bg-muted p-4">
                <h3 className="text-[length:var(--ds-h3)]">Not in your material</h3>
                <p className="text-muted-foreground">{kids ? 'Your pages do not say these things, so Co did not guess:' : 'Your material does not cover these, so Co has not made anything up about them:'}</p>
                <ul className="list-disc space-y-1 ps-6">{content.unknowns.map(item => <li key={item}>{item}</li>)}</ul>
              </section>}
            </>}
            <SourceChips sources={step.sources} materialHref={materialHref} band={band} sourceUrl={sourceUrl} />
            {noteBand && <NotesPanel band={band} stepIndex={stepIndex} notes={detail.notes} api={notes} />}
          </article>
        </div>

        {band === 'teens' && <CoPanel band={band} pose={pose} line={step.coLine}>{ask}</CoPanel>}

        <nav aria-label="Lesson navigation" className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-7 sm:px-7">
          <Button variant="secondary" onClick={back} disabled={current === 0} className={cn(kids && 'min-w-32 text-[length:var(--ds-h3)]')}><ArrowLeft size={18} aria-hidden="true" className="rtl:rotate-180" />Back</Button>
          <div className="order-last min-w-0 basis-full text-center text-[length:var(--ds-small)] text-muted-foreground sm:order-none sm:flex-1 sm:basis-0">
            <p role="status" aria-live="polite" data-testid="save-status" data-status={status}>{review ? 'Looking again. Nothing is saved.' : saveText}
              {status === 'error' && <> <button type="button" className="font-bold text-primary underline" onClick={progress.retry}>Retry saving</button></>}</p>
            {step.kind === 'CHECK' && !canNext && <p data-testid="next-locked">Answer the question correctly to go on.</p>}
            {finishError && <p role="alert" className="text-destructive">{finishError}</p>}
            {!kids && <p className="hidden sm:block" aria-hidden="true"><kbd>←</kbd> <kbd>→</kbd> move · <kbd>Esc</kbd> leave · <kbd>/</kbd> Ask Co</p>}
          </div>
          <Button onClick={next} disabled={!canNext} loading={finishing} className={cn(kids && 'min-w-32 text-[length:var(--ds-h3)]')}>
            {last ? <><Check size={18} aria-hidden="true" />{review ? 'Done' : 'Finish'}</> : <>Next<ArrowRight size={18} aria-hidden="true" className="rtl:rotate-180" /></>}
          </Button>
        </nav>
      </div>
    </SpeechProvider>

    <Dialog.Root open={exitOpen} onOpenChange={setExitOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[70] bg-foreground/40" />
        <Dialog.Popup data-age-band={band} initialFocus={true} finalFocus={true} className="fixed start-1/2 top-1/2 z-[70] w-[min(26rem,92vw)] -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-[var(--radius,18px)] border border-border bg-card p-6 shadow-xl outline-none rtl:translate-x-1/2">
          <Dialog.Title className="text-[length:var(--ds-h2)] font-extrabold">Leave this lesson?</Dialog.Title>
          <Dialog.Description className="text-muted-foreground">{status === 'error' ? 'We could not save your latest step yet. You can keep going and try again.' : review ? 'You can come back to this lesson any time.' : 'Your place is saved. You can pick up right here next time.'}</Dialog.Description>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setExitOpen(false)}>Keep learning</Button>
            <Button variant="secondary" onClick={() => void leave()}>Leave lesson</Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </LessonFocusFrame>
}
