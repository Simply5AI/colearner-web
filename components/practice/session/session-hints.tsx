'use client'

import { useCallback, useId, useRef, useState } from 'react'
import { Lightbulb } from 'lucide-react'
import { Button } from '@/components/design-system'
import type { LearnBand, Link } from '@/lib/api/learn'
import { cn } from '@/lib/utils'
import { practiceSessionApi } from './session-api'
import { hintButtonLabel, hintLabels, practiceErrorCode, practiceErrorText } from './session-model'
import type { HintResult } from './practice-types'

export interface HintsState { texts: string[]; sourceLink: Link | null; request: () => void; pending: boolean; error: string | null; disabled: boolean }

/**
 * The three hint rungs, requested ONE AT A TIME from the server (never ahead of the learner pressing the button).
 * Level N is asked for only after level N-1 was shown. The text is whatever the server sent; the server guarantees a hint
 * never reveals the answer, and the web adds nothing of its own to it. A second press while a request is in flight is ignored.
 */
export function useHints({ sessionId, index, available }: { sessionId: string; index: number; available: number }): HintsState {
  const [texts, setTexts] = useState<string[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [off, setOff] = useState(false)
  const [sourceLink, setSourceLink] = useState<Link | null>(null)
  const busy = useRef(false)
  const shown = useRef(0)
  const request = useCallback(() => {
    if (busy.current || off || shown.current >= Math.min(3, available)) return
    busy.current = true
    setPending(true); setError(null)
    const level = (shown.current + 1) as 1 | 2 | 3
    practiceSessionApi.hint(sessionId, index, level).then((hint: HintResult & { sourceLink: Link | null }) => {
      if (hint.sourceLink) setSourceLink(hint.sourceLink)
      shown.current = Math.max(shown.current, hint.level)
      setTexts(previous => { const next = [...previous]; next[hint.level - 1] = hint.text; return next })
    }).catch((failure: unknown) => {
      if (practiceErrorCode(failure) === 'HINTS_DISABLED_IN_EXAM') setOff(true)
      setError(practiceErrorText(failure, 'We could not get a hint just now. Please try again.'))
    }).finally(() => { busy.current = false; setPending(false) })
  }, [available, index, off, sessionId])
  return { texts, sourceLink, request, pending, error, disabled: off }
}

/**
 * Hint ladder (F-L10-04). Rung names depend on the band (kids: "A little help / More help / Look at this"). Using hints is
 * presented kindly and without any penalty wording. The ladder has no "show answer".
 */
export function PracticeHints({ band, available, hints, canAsk, sourceChip }: { band: LearnBand; available: number; hints: HintsState; canAsk: boolean; sourceChip?: React.ReactNode }) {
  const listId = useId()
  const total = Math.min(3, available)
  const shown = hints.texts.length
  const labels = hintLabels[band]
  const done = shown >= total
  return <section aria-label="Guided hints" className="ds-hint-ladder" data-testid="hint-ladder" data-hints-shown={shown}>
    {shown > 0 && <ol id={listId} className="ds-hint-rungs">
      {hints.texts.map((text, index) => text === undefined ? null : <li key={index} data-hint-level={index + 1}><h3><Lightbulb aria-hidden="true" size={18} />{labels[index]}</h3><div><p>{text}</p></div></li>)}
    </ol>}
    <p role="status" aria-live="polite" className="ds-field-hint">{shown === 0 ? (band === 'kids' ? 'Co is happy to help. It is free!' : 'Hints are free. Ask whenever you like.') : `${shown} of ${total} hints shown`}</p>
    {hints.error && <p role="alert" className="ds-field-error" data-testid="hint-error">{hints.error}</p>}
    <div className="flex flex-wrap items-center gap-3">
      {canAsk && !done && <Button variant="secondary" onClick={hints.request} loading={hints.pending} aria-controls={shown > 0 ? listId : undefined} className={cn(band === 'kids' && 'text-[length:var(--ds-h3)]')}>
        <Lightbulb aria-hidden="true" size={band === 'kids' ? 24 : 18} />{hintButtonLabel(band, shown)}</Button>}
      {shown > 0 && sourceChip}
    </div>
  </section>
}
