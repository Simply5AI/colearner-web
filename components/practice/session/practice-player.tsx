'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Check } from 'lucide-react'
import { Button } from '@/components/design-system'
import { LessonFocusFrame } from '@/components/lesson/lesson-focus-frame'
import { practiceSessionApi } from './session-api'
import { useCountdown, type PollTiming } from './session-hooks'
import { PracticeItem } from './practice-item'
import { clockLabel, modeLabel, practiceErrorCode, practiceErrorText } from './session-model'
import type { LearnBand } from '@/lib/api/learn'
import { PracticeHeader } from './session-parts'
import type { PracticeSessionState } from './practice-types'

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

export interface PlayerProps {
  sessionId: string
  /** The learner's band (signed-in child, else teens): the session reply does not carry one. */
  band: LearnBand
  state: PracticeSessionState
  /** Time of the last server read; a new value restarts the local count from the server's `remainingSec`. */
  syncKey: number
  /** Re-reads the session from the server. Resolves with the fresh state when the read worked. */
  refresh: () => Promise<PracticeSessionState | null>
  onFinished: (sessionId: string) => void
  onExit: () => void
  onEnded: (reason: 'expired' | 'completed') => void
  pollTiming?: PollTiming
}

/**
 * Where to open. The platform's `currentIndex` is clamped to the last question, so "every question is attempted" is read
 * from the counts: when all items have an attempt the learner only has to finish.
 */
function resumeIndex(progress: { answered: number; total: number; currentIndex: number }, itemCount: number): number {
  const total = progress.total || itemCount
  if (total > 0 && progress.answered >= total) return total
  return Math.max(0, Math.min(progress.currentIndex, total))
}

/**
 * F-L10-01: the focused question sequence. One question at a time: Question, optional hints, the server's verdict, Next.
 * Exit asks first and the place is already saved on the server, so GET session resumes at the first open question.
 * The timer (ages 10 to 17, and EXAM) counts down from the server's `remainingSec`; the server alone ends the time.
 */
export function PracticePlayer({ sessionId, band, state, syncKey, refresh, onFinished, onExit, onEnded, pollTiming }: PlayerProps) {
  const { session, progress } = state
  const total = progress.total || session.itemCount
  const mode = session.mode
  const exam = mode === 'EXAM'
  const [index, setIndex] = useState(() => resumeIndex(progress, total))
  const [exitOpen, setExitOpen] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)
  const finishLock = useRef(false)
  const { announcement, announce } = useAnnouncer()
  const titleId = useId()

  const showTimer = state.remainingSec !== null && (exam || band !== 'kids')
  const secondsLeft = useCountdown(state.remainingSec, syncKey)

  // Time left: announced at 5 minutes and 1 minute only, and the server is asked when the local count reaches zero.
  const told = useRef(new Set<number>())
  useEffect(() => {
    if (!showTimer || secondsLeft === null) return
    for (const threshold of [300, 60]) {
      if (secondsLeft <= threshold && secondsLeft > threshold - 5 && !told.current.has(threshold)) { told.current.add(threshold); announce(clockLabel(secondsLeft)) }
    }
  }, [announce, secondsLeft, showTimer])
  const asked = useRef<number | null>(null)
  useEffect(() => {
    if (!showTimer || secondsLeft !== 0 || asked.current === syncKey) return
    asked.current = syncKey
    void refresh()
  }, [refresh, secondsLeft, showTimer, syncKey])

  const next = useCallback(() => { setIndex(value => value + 1); void refresh() }, [refresh])
  // `closed`: the server said this very question is already finished (answered on another device, skipped). If the
  // server's place has not moved past it (the platform clamps `currentIndex` to the last question), move on ourselves.
  const resync = useCallback(async (closed = false) => {
    const fresh = await refresh()
    if (!fresh) return
    const target = resumeIndex(fresh.progress, fresh.session.itemCount)
    setIndex(closed && target <= index ? Math.min(index + 1, fresh.session.itemCount) : target)
  }, [index, refresh])
  const ended = useCallback((reason: 'expired' | 'completed') => { onEnded(reason); void refresh() }, [onEnded, refresh])

  const finish = useCallback(async () => {
    if (finishLock.current) return
    finishLock.current = true
    setFinishing(true); setFinishError(null)
    try {
      await practiceSessionApi.complete(sessionId)
      onFinished(sessionId)
      return
    } catch (error) {
      const code = practiceErrorCode(error)
      if (code === 'SESSION_COMPLETED') { onFinished(sessionId); return }
      if (code === 'SESSION_EXPIRED') { ended('expired'); return }
      setFinishError(practiceErrorText(error, 'We could not finish just now. Your answers are saved. Please try again.'))
    }
    finishLock.current = false
    setFinishing(false)
  }, [ended, onFinished, sessionId])

  // Esc asks to leave. Typing fields and open lists keep their own keys.
  const requestExit = useCallback(() => setExitOpen(true), [])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || exitOpen) return
      if (event.key === 'Escape') { event.preventDefault(); requestExit() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [exitOpen, requestExit])

  const allDone = index >= total
  const label = `${modeLabel[mode]}${session.title ? `: ${session.title}` : ''}`
  return <LessonFocusFrame band={band} label={label}>
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-5 px-4 pb-6 pt-3 sm:px-7" data-band={band} data-mode={mode} data-testid="practice-player">
      <PracticeHeader band={band} mode={mode} title={session.title || null} number={index + 1} total={total} done={Math.min(index, total)} secondsLeft={secondsLeft} showTimer={showTimer} onExit={requestExit} />
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="practice-announcer">{announcement}</div>
      {allDone
        ? <section className="ds-card mx-auto w-full max-w-xl space-y-4 text-center" data-testid="all-answered" aria-labelledby={titleId}>
          <h2 id={titleId}>{band === 'kids' ? 'You answered them all!' : 'You have answered every question'}</h2>
          <p>{exam ? 'Finish the test to see how you did.' : 'Finish to see how it went.'}</p>
          {finishError && <p role="alert" className="ds-field-error justify-center" data-testid="finish-error">{finishError}</p>}
          <Button onClick={() => void finish()} loading={finishing}><Check size={18} aria-hidden="true" />{exam ? 'Finish test' : 'Finish'}</Button>
        </section>
        : <PracticeItem key={index} sessionId={sessionId} index={index} total={total} mode={mode} band={band} onNext={next} onFinish={() => void finish()}
          finishing={finishing} finishError={finishError} onSessionEnded={ended} onOutOfOrder={closed => void resync(closed)} announce={announce} pollTiming={pollTiming} />}
    </div>

    <Dialog.Root open={exitOpen} onOpenChange={setExitOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[70] bg-foreground/40" />
        <Dialog.Popup data-age-band={band} initialFocus={true} finalFocus={true} className="fixed start-1/2 top-1/2 z-[70] w-[min(26rem,92vw)] -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-[var(--radius,18px)] border border-border bg-card p-6 shadow-xl outline-none rtl:translate-x-1/2">
          <Dialog.Title className="text-[length:var(--ds-h2)] font-extrabold">{exam ? 'Leave this test?' : 'Leave this practice?'}</Dialog.Title>
          <Dialog.Description className="text-muted-foreground">
            {exam ? 'Your answers so far are saved, but the timer keeps running. You can come back until the time is up.' : 'Your answers are saved. You can pick up right where you stopped.'}
          </Dialog.Description>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setExitOpen(false)}>{exam ? 'Keep going' : 'Keep practising'}</Button>
            <Button variant="secondary" onClick={onExit}>{exam ? 'Leave test' : 'Leave practice'}</Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </LessonFocusFrame>
}
