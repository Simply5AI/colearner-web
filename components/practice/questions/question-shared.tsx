'use client'

import { Check, CircleDot, RotateCcw, X } from 'lucide-react'
import type { LearnBand } from '@/lib/api/learn'
import { cn } from '@/lib/utils'
import type { Draft } from './answers'
import { markText, type ItemMarks, type TileState } from './marks'
import type { QuestionView } from '../session/practice-types'

/** What every question renderer receives. The renderer edits the draft; the item decides when it is sent and what the server said. */
export interface QuestionProps<Q extends QuestionView, D extends Draft> {
  question: Q
  draft: D
  onDraft: (draft: D) => void
  band: LearnBand
  /** True while the answer is being sent, waiting to be re-sent, or already received: the controls stay readable but cannot change. */
  locked: boolean
  /** The server's verdict on the last answer (never in EXAM, never before an answer). */
  marks: ItemMarks | null
  /** Option ids already tried and not right (single-choice kinds only), kept across retries. */
  tried: readonly string[]
  /** Polite screen-reader announcement (matching and ordering changes). */
  announce: (message: string) => void
  /** Unique per question; used for ids and radio group names. */
  idPrefix: string
  /** Id of the heading that names the question, so groups are named by it. */
  promptId: string
  instructionId: string
}

const stateClass: Record<TileState, string> = {
  idle: '',
  selected: '',
  correct: 'border-[var(--success)] bg-[var(--success)]/10 !opacity-100',
  wrong: 'border-dashed border-muted-foreground bg-muted !opacity-100',
  tried: 'border-dashed border-muted-foreground bg-muted !opacity-100',
  missed: 'border-[var(--success)] border-dashed bg-[var(--success)]/5 !opacity-100',
}

export const tileStateClass = (state: TileState) => stateClass[state]

/** A visible word plus an icon for a result state, so a mark never depends on colour. */
export function MarkBadge({ state, id, extra, className }: { state: TileState; id?: string; extra?: string | null; className?: string }) {
  const text = markText(state)
  if (!text) return null
  const Icon = state === 'correct' ? Check : state === 'missed' ? CircleDot : state === 'wrong' ? X : RotateCcw
  return <span id={id} data-mark={state} className={cn('mt-1 inline-flex items-center gap-1 text-[length:var(--ds-small)] font-bold', state === 'correct' || state === 'missed' ? 'text-[var(--success)]' : 'text-muted-foreground', className)}>
    <Icon size={16} aria-hidden="true" />{text}{extra ? <span className="font-semibold">. {extra}</span> : null}
  </span>
}

/** Band-aware sizes shared by the renderers. The design system already sets the minimum target (64 / 48 / 44) on buttons, selects and inputs. */
export const bandText = (band: LearnBand) => band === 'kids' ? 'text-[length:var(--ds-h3)] font-bold' : band === 'tweens' ? 'text-[length:var(--ds-body)] font-semibold' : 'text-[length:var(--ds-body)]'
export const bandMinHeight = (band: LearnBand) => band === 'kids' ? 'min-h-16' : band === 'tweens' ? 'min-h-12' : 'min-h-11'
