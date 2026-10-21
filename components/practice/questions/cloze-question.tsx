'use client'

import { Fragment } from 'react'
import { Spoken } from '../session/practice-speech'
import { cn } from '@/lib/utils'
import { CLOZE_TEXT_MAX, clozeBlanks, type Draft } from './answers'
import { blankState } from './marks'
import { MarkBadge, bandMinHeight, tileStateClass, type QuestionProps } from './question-shared'
import type { ClozeQuestion } from '../session/practice-types'

/** CLOZE: the sentence with its blanks inline. A blank with options is a select (works with every keyboard, screen reader and touch); a free blank is a text field of at most 80 characters. */
export function ClozeQuestionView({ question, draft, onDraft, band, locked, marks, instructionId }: QuestionProps<ClozeQuestion, Draft>) {
  const values = draft.kind === 'CLOZE' ? draft.values : {}
  const blanks = clozeBlanks(question)
  const set = (id: string, value: string) => { if (!locked) onDraft({ kind: 'CLOZE', values: { ...values, [id]: value } }) }
  const kids = band === 'kids'
  return <div data-testid="question-cloze" className="space-y-3">
    <p className={cn('flex flex-wrap items-center gap-x-2 gap-y-3 leading-loose', kids ? 'text-[length:var(--ds-h2)] font-bold' : 'text-[length:var(--ds-h3)]')} aria-describedby={instructionId}>
      {question.parts.map((part, index) => {
        if (part.type === 'text') return <Fragment key={index}><Spoken id={`part:${index}`} text={part.text} /></Fragment>
        const blankIndex = blanks.findIndex(blank => blank.id === part.id)
        const label = `Blank ${blankIndex + 1} of ${blanks.length}`
        const value = values[part.id] ?? ''
        const state = blankState(part.id, value, marks)
        const markId = `${part.id}-mark`
        const marked = state === 'correct' || state === 'wrong' || state === 'tried'
        const field = cn('ds-input !w-auto min-w-36 max-w-full border-dashed', bandMinHeight(band), tileStateClass(state), kids && 'text-[length:var(--ds-h3)] font-bold')
        const accepted = marks?.revealed?.kind === 'CLOZE' ? marks.revealed.accepted[part.id] : undefined
        const answerText = accepted?.[0] ? (part.options?.find(option => option.id === accepted[0])?.text ?? accepted[0]) : null
        return <span key={index} className="inline-flex flex-col items-start" data-blank={part.id} data-option-state={marked ? state : undefined}>
          {part.options
            ? <select aria-label={label} aria-describedby={marked ? markId : undefined} value={value} disabled={locked} onChange={event => set(part.id, event.target.value)} className={field}>
              <option value="">{kids ? 'Pick one' : 'Choose…'}</option>
              {part.options.map(option => <option key={option.id} value={option.id}>{option.text}</option>)}
            </select>
            : <input type="text" aria-label={label} aria-describedby={marked ? markId : undefined} value={value} readOnly={locked} maxLength={CLOZE_TEXT_MAX} autoComplete="off" autoCapitalize="off" spellCheck={false}
              onChange={event => set(part.id, event.target.value.slice(0, CLOZE_TEXT_MAX))} className={field} />}
          <MarkBadge state={state} id={markId} extra={state === 'wrong' && answerText ? `The answer is ${answerText}` : null} />
        </span>
      })}
    </p>
  </div>
}
