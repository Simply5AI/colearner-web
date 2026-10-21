'use client'

import { useId } from 'react'
import { Spoken } from '../session/practice-speech'
import { cn } from '@/lib/utils'
import type { Draft } from './answers'
import { minimumSelection } from './answers'
import { multiChoiceState, singleChoiceState, type TileState } from './marks'
import { MarkBadge, bandMinHeight, bandText, tileStateClass, type QuestionProps } from './question-shared'
import type { McqQuestion, MultiSelectQuestion, TrueFalseQuestion } from '../session/practice-types'

interface TileProps {
  type: 'radio' | 'checkbox'
  name: string
  value: string
  segment: string
  label: string
  checked: boolean
  disabled: boolean
  state: TileState
  onChange: () => void
  band: QuestionProps<McqQuestion, Draft>['band']
}
/** One answer tile: a real radio or checkbox inside a label, with a written mark (never colour alone) for a result. */
function Tile({ type, name, value, segment, label, checked, disabled, state, onChange, band }: TileProps) {
  const id = useId()
  const markId = `${id}-mark`
  const marked = state === 'correct' || state === 'wrong' || state === 'tried' || state === 'missed'
  return <li className="min-w-0" data-option-state={marked ? state : undefined} data-choice={value}>
    <label htmlFor={id} data-selected={checked} data-disabled={disabled} className={cn('ds-question-option', bandMinHeight(band), bandText(band), tileStateClass(state))}>
      <input id={id} type={type} name={name} value={value} checked={checked} onChange={onChange} disabled={disabled} aria-describedby={marked ? markId : undefined} />
      <span className="min-w-0 flex-1"><Spoken id={segment} text={label} /></span>
    </label>
    <MarkBadge state={state} id={markId} />
  </li>
}

/** MCQ and TRUE_FALSE: one choice. Big tiles for kids, two columns for four options on wider screens. */
export function ChoiceQuestion({ question, draft, onDraft, band, locked, marks, tried, idPrefix, promptId, instructionId }: QuestionProps<McqQuestion | TrueFalseQuestion, Draft>) {
  const options = question.kind === 'MCQ' ? question.options : [{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }]
  const picked = question.kind === 'MCQ' ? (draft.kind === 'MCQ' ? draft.optionId : null) : (draft.kind === 'TRUE_FALSE' && draft.value !== null ? String(draft.value) : null)
  const choose = (id: string) => {
    if (locked) return
    onDraft(question.kind === 'MCQ' ? { kind: 'MCQ', optionId: id } : { kind: 'TRUE_FALSE', value: id === 'true' })
  }
  return <div role="radiogroup" aria-labelledby={promptId} aria-describedby={instructionId} data-testid="question-options">
    <ul className={cn('grid gap-3', question.kind === 'TRUE_FALSE' ? 'grid-cols-2' : options.length > 3 && band !== 'kids' && 'sm:grid-cols-2')}>
      {options.map(option => <Tile key={option.id} type="radio" name={`${idPrefix}-choice`} value={option.id} segment={`opt:${option.id}`} label={option.text}
        checked={picked === option.id} disabled={locked} state={singleChoiceState(option.id, picked, marks, tried)} onChange={() => choose(option.id)} band={band} />)}
    </ul>
  </div>
}

/** MULTI_SELECT: checkbox tiles; the count of picks is announced politely by the checked state itself. */
export function MultiSelectQuestion({ question, draft, onDraft, band, locked, marks, idPrefix, promptId, instructionId }: QuestionProps<MultiSelectQuestion, Draft>) {
  const picked = draft.kind === 'MULTI_SELECT' ? draft.optionIds : []
  const toggle = (id: string) => {
    if (locked) return
    onDraft({ kind: 'MULTI_SELECT', optionIds: picked.includes(id) ? picked.filter(entry => entry !== id) : [...picked, id] })
  }
  const needed = minimumSelection(question)
  return <div role="group" aria-labelledby={promptId} aria-describedby={instructionId} data-testid="question-options">
    <ul className={cn('grid gap-3', question.options.length > 3 && band !== 'kids' && 'sm:grid-cols-2')}>
      {question.options.map(option => <Tile key={option.id} type="checkbox" name={`${idPrefix}-multi`} value={option.id} segment={`opt:${option.id}`} label={option.text}
        checked={picked.includes(option.id)} disabled={locked} state={multiChoiceState(option.id, picked, marks)} onChange={() => toggle(option.id)} band={band} />)}
    </ul>
    <p className="mt-3 text-[length:var(--ds-small)] text-muted-foreground" data-testid="multi-count">{picked.length} chosen{needed > 1 ? ` · pick at least ${needed}` : ''}</p>
  </div>
}
