'use client'

import { useId, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Lightbulb } from 'lucide-react'
import { AnswerFeedback, Button, QuestionOptionTile } from '@/components/design-system'
import type { LearnBand } from '@/lib/api/learn'
import { isAccessChangedError, lessonApi, lessonErrorMessage, type LessonCheckResult, type LessonCheckView, type LessonSource } from '@/lib/api/lesson'
import { cn } from '@/lib/utils'
import { sourceChipText } from './lesson-model'
import { Spoken } from './lesson-speech'

const nudge: Record<LearnBand, string> = {
  kids: 'Look at what Co told you. Which one fits?',
  tweens: 'Think about what you just read. Which choice fits best?',
  teens: 'Go back over the explanation. Which option does it support?',
}

interface HintsProps { check: LessonCheckView; sources: readonly LessonSource[]; band: LearnBand; shown: number; onShown: (count: number) => void; disabled?: boolean }
/**
 * A hint ladder with three rungs at most, opened one at a time and never revealing the answer:
 * a nudge (fixed wording), the lesson's own hint (only when the server supplied one), then a pointer to where the
 * material covers it. A rung that has nothing real to show is skipped, never invented.
 */
function CheckHints({ check, sources, band, shown, onShown, disabled }: HintsProps) {
  const listId = useId()
  const rungs = [
    { key: 'nudge', title: 'Nudge', body: <p>{nudge[band]}</p> },
    ...(check.hint ? [{ key: 'hint', title: 'Hint', body: <p>{check.hint}</p> }] : []),
    ...(sources.length > 0 ? [{ key: 'look', title: 'Look back', body: <p>Look back at {[...new Set(sources.map(sourceChipText))].join(', ')} in your material.</p> }] : []),
  ]
  const count = Math.min(shown, rungs.length)
  return <section aria-label="Guided hints" className="ds-hint-ladder" data-testid="hint-ladder">
    <ol id={listId} className="ds-hint-rungs">
      {rungs.slice(0, count).map(rung => <li key={rung.key}><h3><Lightbulb aria-hidden="true" size={18} />{rung.title}</h3><div>{rung.body}</div></li>)}
    </ol>
    <p role="status" aria-live="polite" className="ds-field-hint">{count} of {rungs.length} hints shown</p>
    <Button variant="secondary" onClick={() => onShown(count + 1)} aria-controls={listId} disabled={disabled || count >= rungs.length}>{count === 0 ? 'Need help?' : count >= rungs.length ? 'All hints shown' : 'Show next hint'}</Button>
  </section>
}

export interface LessonCheckProps {
  lessonId: string
  stepIndex: number
  check: LessonCheckView
  sources: readonly LessonSource[]
  band: LearnBand
  /** True when the server already recorded this step as completed (resume). */
  alreadyDone: boolean
  /** Called once the server confirms a correct answer. */
  onCorrect: () => void
  onHintsChange?: (shown: number) => void
  /** Access to the lesson changed while answering; the screen reloads and hides it. */
  onAccessChanged?: () => void
}

/**
 * F-L7-01/03: the embedded CHECK question. Correctness comes only from the server's check endpoint, which is
 * formative (not graded). The answer is never in the page before a correct pick, wrong options stay labelled as
 * tried, and "Next" stays locked (by the player) until the server says the pick was right.
 */
export function LessonCheck({ lessonId, stepIndex, check, sources, band, alreadyDone, onCorrect, onHintsChange, onAccessChanged }: LessonCheckProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [result, setResult] = useState<LessonCheckResult | null>(null)
  const [tried, setTried] = useState<string[]>([])
  const [hints, setHints] = useState(0)
  const inFlight = useRef(false)
  const name = `lesson-check-${stepIndex}`
  const kids = band === 'kids'
  const solved = result?.correct === true
  const mutation = useMutation({
    mutationFn: (optionId: string) => lessonApi.check(lessonId, { stepIndex, optionId }),
    retry: false,
    onSuccess: (value, optionId) => {
      setResult(value)
      if (value.correct) onCorrect()
      else setTried(previous => previous.includes(optionId) ? previous : [...previous, optionId])
    },
    onError: error => { if (isAccessChangedError(error)) onAccessChanged?.() },
    onSettled: () => { inFlight.current = false },
  })
  const submit = () => {
    if (!selected || inFlight.current || solved) return
    inFlight.current = true
    mutation.mutate(selected)
  }
  const choose = (value: string) => { if (solved) return; setSelected(value); setResult(null); mutation.reset() }
  const showHints = (count: number) => { setHints(count); onHintsChange?.(count) }
  const correctId = solved ? (result?.correctOptionId ?? selected) : null
  return <div className="space-y-5" data-testid="check">
    <fieldset className="space-y-4" aria-describedby={alreadyDone && !solved ? `${name}-done` : undefined}>
      <legend className={cn('mb-3 max-w-prose font-bold', kids ? 'text-[length:var(--ds-h2)]' : 'text-[length:var(--ds-h3)]')}><Spoken id="question" text={check.question} /></legend>
      {alreadyDone && !solved && <p id={`${name}-done`} className="rounded-[var(--radius)] bg-secondary p-3 font-semibold" data-testid="check-already-done">You already got this one right. You can try it again or move on.</p>}
      <ul className={cn('grid gap-3', !kids && check.options.length > 2 && 'sm:grid-cols-2')}>
        {check.options.map(option => {
          const isCorrect = correctId === option.id
          const wasTried = tried.includes(option.id) && !isCorrect
          return <li key={option.id} className="min-w-0" data-option-state={isCorrect ? 'correct' : wasTried ? 'tried' : undefined}>
            <QuestionOptionTile name={name} value={option.id} label={option.text} checked={selected === option.id} onSelect={choose} disabled={solved || mutation.isPending}
              className={cn(kids && 'min-h-24 text-[length:var(--ds-h3)] font-bold', isCorrect && 'border-[var(--success)] bg-[var(--success)]/10', wasTried && 'border-dashed opacity-80')} />
            {isCorrect && <p className="mt-1 text-[length:var(--ds-small)] font-bold text-[var(--success)]">That is the right one</p>}
            {wasTried && <p className="mt-1 text-[length:var(--ds-small)] text-muted-foreground">You tried this one</p>}
          </li>
        })}
      </ul>
    </fieldset>
    {mutation.error && <p role="alert" className="ds-field-error" data-testid="check-error">{lessonErrorMessage(mutation.error, 'That could not be checked. Your choice is still here, so you can try again.')}</p>}
    {result && <AnswerFeedback kind={result.correct ? 'correct' : 'incorrect'} band={band} title={result.correct ? (kids ? 'You got it!' : undefined) : (kids ? 'Try again!' : undefined)} message={<p>{result.feedback}</p>} />}
    {!solved && <div className="flex flex-wrap items-start gap-3">
      <Button onClick={submit} disabled={!selected} loading={mutation.isPending}>{kids ? 'Check!' : 'Check my answer'}</Button>
    </div>}
    {!solved && <CheckHints check={check} sources={sources} band={band} shown={hints} onShown={showHints} disabled={mutation.isPending} />}
  </div>
}
