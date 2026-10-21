'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'
import { shortAnswerMax, type Draft } from './answers'
import type { QuestionProps } from './question-shared'
import type { ShortAnswerQuestion } from '../session/practice-types'

/** SHORT_ANSWER: a textarea with a live character count. Never longer than `maxChars`; the count is announced only when the limit is close. */
export function ShortAnswerQuestionView({ question, draft, onDraft, band, locked, instructionId, promptId }: QuestionProps<ShortAnswerQuestion, Draft>) {
  const max = shortAnswerMax(question)
  const value = draft.kind === 'SHORT_ANSWER' ? draft.text : ''
  const countId = useId()
  const remaining = max - value.length
  const close = remaining <= Math.max(20, Math.floor(max * 0.1))
  return <div data-testid="question-short-answer" className="space-y-2">
    <textarea aria-labelledby={promptId} aria-describedby={`${instructionId} ${countId}`} value={value} readOnly={locked} maxLength={max} rows={band === 'teens' ? 6 : 5}
      placeholder="Write your answer here…" spellCheck onChange={event => { if (!locked) onDraft({ kind: 'SHORT_ANSWER', text: event.target.value.slice(0, max) }) }}
      className={cn('ds-input min-h-40 resize-y leading-relaxed', locked && 'bg-muted')} />
    <p id={countId} className="flex flex-wrap items-center justify-between gap-2 text-[length:var(--ds-small)] text-muted-foreground">
      <span data-testid="char-count">{value.length} / {max} characters</span>
      <span role="status" aria-live="polite" className={close ? 'font-bold text-foreground' : 'sr-only'}>{close ? `${Math.max(0, remaining)} characters left` : ''}</span>
    </p>
  </div>
}
