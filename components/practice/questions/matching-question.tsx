'use client'

import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/design-system'
import { Spoken } from '../session/practice-speech'
import { cn } from '@/lib/utils'
import type { Draft } from './answers'
import { pairState } from './marks'
import { MarkBadge, bandMinHeight, bandText, tileStateClass, type QuestionProps } from './question-shared'
import type { MatchingQuestion } from '../session/practice-types'

/**
 * Sets left -> right. A right item belongs to one left only, so choosing one that is already matched moves it and
 * says so; nothing is silently dropped. Returns the new pairs and a sentence for the live region.
 */
export function matchPair(question: MatchingQuestion, pairs: Record<string, string>, leftId: string, rightId: string): { pairs: Record<string, string>; message: string } {
  const left = question.left.find(item => item.id === leftId)
  const right = question.right.find(item => item.id === rightId)
  if (!left || !right) return { pairs, message: '' }
  const next = { ...pairs }
  let message = `${left.text} matched with ${right.text}.`
  const holder = Object.keys(next).find(key => key !== leftId && next[key] === rightId)
  if (holder) { delete next[holder]; message += ` ${question.left.find(item => item.id === holder)?.text ?? 'Another item'} needs a new match.` }
  next[leftId] = rightId
  return { pairs: next, message }
}

/**
 * MATCHING. Every control is a real button or select, so it works with a keyboard and a screen reader:
 * - kids: tap an item, then tap the one that goes with it (tap-pair);
 * - tweens and teens: one select per item on the left.
 * Pointer drag is an extra for the same result: drag an answer onto an item. Touch and assistive tech use the tap or select path.
 */
export function MatchingQuestionView(props: QuestionProps<MatchingQuestion, Draft>) {
  return props.band === 'kids' ? <TapPair {...props} /> : <SelectPairs {...props} />
}

const rightOf = (draft: Draft) => draft.kind === 'MATCHING' ? draft.pairs : {}

function useDrag() {
  const [dragging, setDragging] = useState<string | null>(null)
  return { dragging, setDragging }
}

/** Dragged answers (right items) can be dropped on a left item. */
function dropProps(onDrop: (rightId: string) => void, enabled: boolean) {
  if (!enabled) return {}
  return {
    onDragOver: (event: React.DragEvent) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' },
    onDrop: (event: React.DragEvent) => { event.preventDefault(); const id = event.dataTransfer.getData('text/plain'); if (id) onDrop(id) },
  }
}
const dragProps = (rightId: string, enabled: boolean, drag: ReturnType<typeof useDrag>) => enabled ? {
  draggable: true,
  onDragStart: (event: React.DragEvent) => { event.dataTransfer.setData('text/plain', rightId); event.dataTransfer.effectAllowed = 'move'; drag.setDragging(rightId) },
  onDragEnd: () => drag.setDragging(null),
} : {}

function SelectPairs({ question, draft, onDraft, band, locked, marks, announce, instructionId, promptId }: QuestionProps<MatchingQuestion, Draft>) {
  const pairs = rightOf(draft)
  const drag = useDrag()
  const set = (leftId: string, rightId: string) => {
    if (locked) return
    if (!rightId) { const next = { ...pairs }; delete next[leftId]; onDraft({ kind: 'MATCHING', pairs: next }); return }
    const result = matchPair(question, pairs, leftId, rightId)
    onDraft({ kind: 'MATCHING', pairs: result.pairs })
    if (result.message) announce(result.message)
  }
  const used = new Set(Object.values(pairs))
  return <div data-testid="question-matching" data-mode="select" role="group" aria-labelledby={promptId} aria-describedby={instructionId} className="space-y-4">
    <ul className="grid gap-3">
      {question.left.map(left => {
        const value = pairs[left.id] ?? ''
        const state = pairState(left.id, pairs[left.id], marks)
        const labelId = `match-${left.id}`
        const markId = `${labelId}-mark`
        const marked = state === 'correct' || state === 'wrong' || state === 'tried'
        const answerId = marks?.revealed?.kind === 'MATCHING' ? marks.revealed.pairs[left.id] : undefined
        const answerText = state === 'wrong' && answerId ? question.right.find(item => item.id === answerId)?.text : null
        return <li key={left.id} data-option-state={marked ? state : undefined} data-left={left.id} {...dropProps(rightId => set(left.id, rightId), !locked)}
          className={cn('grid items-center gap-3 rounded-[var(--radius)] border-2 border-border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]', tileStateClass(state), drag.dragging && !locked && 'border-primary')}>
          <span id={labelId} className={bandText(band)}><Spoken id={`left:${left.id}`} text={left.text} /></span>
          <div className="min-w-0">
            <select aria-labelledby={labelId} aria-describedby={marked ? markId : undefined} value={value} disabled={locked} onChange={event => set(left.id, event.target.value)} className={cn('ds-input', bandMinHeight(band))}>
              <option value="">Choose a match…</option>
              {question.right.map(right => <option key={right.id} value={right.id}>{right.text}{used.has(right.id) && right.id !== value ? ' (already used)' : ''}</option>)}
            </select>
            <MarkBadge state={state} id={markId} extra={answerText ? `The match is ${answerText}` : null} />
          </div>
        </li>
      })}
    </ul>
    {!locked && <div aria-hidden="true" data-testid="match-bank" className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-[length:var(--ds-small)] text-muted-foreground">
      <span>Or drag an answer onto an item:</span>
      {question.right.map(right => <span key={right.id} {...dragProps(right.id, true, drag)} data-draggable={right.id}
        className={cn('ds-pill cursor-grab select-none border border-border', used.has(right.id) && 'opacity-60')}>{right.text}</span>)}
    </div>}
  </div>
}

function TapPair({ question, draft, onDraft, band, locked, marks, announce, instructionId, promptId }: QuestionProps<MatchingQuestion, Draft>) {
  const pairs = rightOf(draft)
  const [active, setActive] = useState<{ side: 'left' | 'right'; id: string } | null>(null)
  const drag = useDrag()
  const rightText = (id: string | undefined) => question.right.find(item => item.id === id)?.text
  const leftHolding = (rightId: string) => question.left.find(left => pairs[left.id] === rightId)
  const pair = (leftId: string, rightId: string) => {
    const result = matchPair(question, pairs, leftId, rightId)
    onDraft({ kind: 'MATCHING', pairs: result.pairs })
    if (result.message) announce(result.message)
    setActive(null)
  }
  const press = (side: 'left' | 'right', id: string) => {
    if (locked) return
    if (!active) { setActive({ side, id }); return }
    if (active.side === side) { setActive(active.id === id ? null : { side, id }); return }
    pair(side === 'right' ? active.id : id, side === 'right' ? id : active.id)
  }
  const reset = () => { if (!locked) { onDraft({ kind: 'MATCHING', pairs: {} }); setActive(null); announce('All matches cleared.') } }
  const number = (leftId: string) => question.left.findIndex(left => left.id === leftId) + 1
  return <div data-testid="question-matching" data-mode="tap" role="group" aria-labelledby={promptId} aria-describedby={instructionId} className="space-y-4">
    <p className="text-[length:var(--ds-small)] text-muted-foreground" role="status">{active ? 'Now tap the one that goes with it.' : 'Tap one, then tap its match.'}</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <ul className="grid content-start gap-3" aria-label="Items">
        {question.left.map(left => {
          const state = pairState(left.id, pairs[left.id], marks)
          const matched = rightText(pairs[left.id])
          const on = active?.side === 'left' && active.id === left.id
          const marked = state === 'correct' || state === 'wrong' || state === 'tried'
          return <li key={left.id} data-option-state={marked ? state : undefined} data-left={left.id} {...dropProps(rightId => pair(left.id, rightId), !locked)}>
            <button type="button" aria-pressed={on} aria-disabled={locked || undefined} onClick={() => press('left', left.id)}
              className={cn('ds-question-option w-full min-h-16 text-start', bandText(band), on && 'border-primary bg-secondary ring-2 ring-primary', tileStateClass(state))}>
              <span aria-hidden="true" className="grid size-9 flex-none place-items-center rounded-full bg-primary text-primary-foreground font-extrabold">{number(left.id)}</span>
              <span className="min-w-0 flex-1"><Spoken id={`left:${left.id}`} text={left.text} />
                <span className="block text-[length:var(--ds-small)] font-semibold text-muted-foreground">{matched ? `Matched with ${matched}` : 'Not matched yet'}</span></span>
            </button>
            <MarkBadge state={state} />
          </li>
        })}
      </ul>
      <ul className="grid content-start gap-3" aria-label="Answers">
        {question.right.map(right => {
          const holder = leftHolding(right.id)
          const on = active?.side === 'right' && active.id === right.id
          return <li key={right.id} data-right={right.id}>
            <button type="button" aria-pressed={on} aria-disabled={locked || undefined} onClick={() => press('right', right.id)} {...dragProps(right.id, !locked, drag)}
              className={cn('ds-question-option w-full min-h-16 text-start', bandText(band), on && 'border-primary bg-secondary ring-2 ring-primary', holder && !on && 'bg-muted')}>
              {holder && <span aria-hidden="true" className="grid size-9 flex-none place-items-center rounded-full bg-primary text-primary-foreground font-extrabold">{number(holder.id)}</span>}
              <span className="min-w-0 flex-1"><Spoken id={`right:${right.id}`} text={right.text} />
                {holder && <span className="block text-[length:var(--ds-small)] font-semibold text-muted-foreground">Matched with {holder.text}</span>}</span>
            </button>
          </li>
        })}
      </ul>
    </div>
    {!locked && Object.keys(pairs).length > 0 && <Button variant="ghost" onClick={reset}><RotateCcw size={18} aria-hidden="true" />Start matching again</Button>}
  </div>
}
