'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Spoken } from '../session/practice-speech'
import { cn } from '@/lib/utils'
import type { Draft } from './answers'
import { positionState } from './marks'
import { MarkBadge, bandMinHeight, bandText, tileStateClass, type QuestionProps } from './question-shared'
import type { OrderingQuestion } from '../session/practice-types'

/** Moves one entry to a new position (clamped). Pure, so the keyboard and drag paths share it. */
export function moveItem(order: readonly string[], id: string, to: number): string[] {
  const from = order.indexOf(id)
  if (from < 0) return [...order]
  const target = Math.max(0, Math.min(order.length - 1, to))
  if (target === from) return [...order]
  const next = order.filter(entry => entry !== id)
  next.splice(target, 0, id)
  return next
}

/**
 * ORDERING. "Move up" and "Move down" buttons are the primary control (keyboard, touch, screen reader); every move is
 * announced ("Roots moved to position 1 of 4") and focus stays on the same button. Pointer drag onto another row is an extra.
 */
export function OrderingQuestionView({ question, draft, onDraft, band, locked, marks, announce, promptId, instructionId }: QuestionProps<OrderingQuestion, Draft>) {
  const order = draft.kind === 'ORDERING' ? draft.order : question.items.map(item => item.id)
  const text = (id: string) => question.items.find(item => item.id === id)?.text ?? ''
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const refocus = useRef<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  useEffect(() => {
    if (!refocus.current) return
    buttons.current.get(refocus.current)?.focus()
    refocus.current = null
  }, [order])

  const place = (id: string, to: number, focusKey?: string) => {
    if (locked) return
    const next = moveItem(order, id, to)
    if (next.join('|') === order.join('|')) return
    refocus.current = focusKey ?? null
    onDraft({ kind: 'ORDERING', order: next })
    announce(`${text(id)} moved to position ${next.indexOf(id) + 1} of ${next.length}.`)
  }
  const last = order.length - 1
  return <div data-testid="question-ordering" data-draggable-list role="group" aria-labelledby={promptId} aria-describedby={instructionId} className="space-y-3">
    <ol className="grid gap-3">
      {order.map((id, position) => {
        const state = positionState(id, position, marks)
        const marked = state === 'correct' || state === 'wrong' || state === 'tried'
        const rightId = marks?.revealed?.kind === 'ORDERING' ? marks.revealed.order[position] : undefined
        const rightText = state === 'wrong' && rightId ? text(rightId) : null
        const button = 'ds-button ds-button-secondary !px-3 aria-disabled:cursor-not-allowed aria-disabled:opacity-40'
        return <li key={id} data-item={id} data-position={position + 1} data-option-state={marked ? state : undefined}
          draggable={!locked} onDragStart={event => { event.dataTransfer.setData('text/plain', id); event.dataTransfer.effectAllowed = 'move'; setDragId(id) }} onDragEnd={() => setDragId(null)}
          onDragOver={event => { if (!locked) { event.preventDefault(); event.dataTransfer.dropEffect = 'move' } }}
          onDrop={event => { event.preventDefault(); const moved = event.dataTransfer.getData('text/plain') || dragId; setDragId(null); if (moved) place(moved, position) }}
          className={cn('ds-question-option flex-wrap', bandMinHeight(band), bandText(band), tileStateClass(state), dragId === id && 'opacity-60')}>
          <span aria-hidden="true" className="grid size-9 flex-none place-items-center rounded-full bg-primary font-extrabold text-primary-foreground">{position + 1}</span>
          <span className="min-w-0 flex-1"><Spoken id={`item:${id}`} text={text(id)} />
            <MarkBadge state={state} extra={rightText ? `This spot is for ${rightText}` : null} />
          </span>
          {!locked && <span className="flex flex-none items-center gap-2">
            <button type="button" ref={node => { if (node) buttons.current.set(`${id}:up`, node); else buttons.current.delete(`${id}:up`) }} className={button}
              aria-disabled={position === 0 || undefined} aria-label={`Move ${text(id)} up (position ${position + 1} of ${order.length})`}
              onClick={() => place(id, position - 1, `${id}:up`)}><ArrowUp size={20} aria-hidden="true" /></button>
            <button type="button" ref={node => { if (node) buttons.current.set(`${id}:down`, node); else buttons.current.delete(`${id}:down`) }} className={button}
              aria-disabled={position === last || undefined} aria-label={`Move ${text(id)} down (position ${position + 1} of ${order.length})`}
              onClick={() => place(id, position + 1, `${id}:down`)}><ArrowDown size={20} aria-hidden="true" /></button>
          </span>}
        </li>
      })}
    </ol>
    {!locked && <p className="text-[length:var(--ds-small)] text-muted-foreground">Use the arrow buttons to move an item. You can also drag it with a mouse.</p>}
  </div>
}
