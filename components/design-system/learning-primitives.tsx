'use client'

import { useId, type ReactNode } from 'react'
import { CheckCircle2, CircleHelp, Flame, Lightbulb, LockKeyhole, Sparkles, Star, Trophy, Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CoCharacter, type CoState } from './co-character'
import { Button } from './primitives'
import type { AgeBand } from './tokens'

export interface QuestionOptionTileProps {
  name: string
  value: string
  label: string
  checked: boolean
  onSelect?: (value: string) => void
  disabled?: boolean
  picture?: { src: string; alt: string }
  className?: string
}

/** Native radios share a caller-supplied group name; no answer checking occurs here. */
export const QuestionOptionTile = ({ name, value, label, checked, onSelect, disabled, picture, className }: QuestionOptionTileProps) => {
  const id = useId()
  const select = () => onSelect?.(value)
  const unavailable = disabled || !onSelect
  return <label htmlFor={id} data-selected={checked} data-disabled={unavailable} className={cn('ds-question-option', picture && 'ds-question-picture', className)}>
    <input id={id} type="radio" name={name} value={value} aria-label={label} checked={checked} onChange={select} disabled={unavailable} />
    {picture && <picture className="ds-option-picture"><img src={picture.src} alt={picture.alt} width={200} height={140} loading="lazy" className="ds-option-image" /></picture>}
    <span>{label}</span>
  </label>
}

export interface HintLadderProps {
  hints: readonly [ReactNode, ReactNode, ReactNode]
  revealedCount: number
  onReveal?: (nextCount: number) => void
  disabled?: boolean
  className?: string
}
const hintLabels = ['Nudge', 'Hint', 'Similar example'] as const

/** Reveals one supplied rung at a time. Caller owns content policy and progression. */
export const HintLadder = ({ hints, revealedCount, onReveal, disabled, className }: HintLadderProps) => {
  const id = useId()
  const count = Number.isFinite(revealedCount) ? Math.min(3, Math.max(0, Math.floor(revealedCount))) : 0
  const reveal = () => { if (count < 3) onReveal?.(count + 1) }
  return <section aria-label="Guided hints" className={cn('ds-hint-ladder', className)}>
    <ol id={id} className="ds-hint-rungs">
      {hintLabels.slice(0, count).map((label, index) => <li key={label}><h3><Lightbulb aria-hidden="true" size={18} />{label}</h3><div>{hints[index]}</div></li>)}
    </ol>
    <p role="status" aria-live="polite" className="ds-field-hint">{count} of 3 hints shown</p>
    <Button variant="secondary" onClick={reveal} aria-controls={id} disabled={disabled || !onReveal || count === 3}>{count === 0 ? 'Need help?' : count === 3 ? 'All hints shown' : 'Show next hint'}</Button>
  </section>
}

export interface AnswerFeedbackProps {
  kind: 'correct' | 'incorrect' | 'partial'
  message: ReactNode
  title?: string
  action?: ReactNode
  band?: AgeBand
  className?: string
}
const feedbackTitles = { correct: 'Nice work!', incorrect: 'Let’s try again', partial: 'You’re getting there' }

/** Pure feedback presentation: no scoring, correct-answer disclosure or review updates. */
export const AnswerFeedback = ({ kind, message, title, action, band = 'teens', className }: AnswerFeedbackProps) => {
  const Icon = kind === 'correct' ? CheckCircle2 : CircleHelp
  return <div role="status" aria-live="polite" data-feedback-kind={kind} className={cn('ds-answer-feedback', className)}>
    <CoCharacter band={band} state={kind === 'correct' ? 'celebrating' : 'encouraging'} decorative />
    <div className="ds-feedback-content"><h3><Icon size={20} aria-hidden="true" />{title ?? feedbackTitles[kind]}</h3><div>{message}</div>{action}</div>
  </div>
}

export interface RewardBadgeProps {
  kind?: 'sticker' | 'xp' | 'level' | 'streak' | 'league'
  label: string
  locked?: boolean
  className?: string
}
const rewardIcons = { sticker: Star, xp: Sparkles, level: Star, streak: Flame, league: Trophy }
export const RewardBadge = ({ kind = 'sticker', label, locked = false, className }: RewardBadgeProps) => {
  const Icon = locked ? LockKeyhole : rewardIcons[kind]
  return <span className={cn('ds-reward-badge', locked && 'ds-reward-locked', className)}><Icon size={18} aria-hidden="true" />{locked && <span className="sr-only">Locked: </span>}{label}</span>
}

interface ReadAloudActionProps { canReadAloud?: boolean; onReadAloud?: () => void; label?: string }
const ReadAloudAction = ({ canReadAloud = false, onReadAloud, label = 'Read aloud' }: ReadAloudActionProps) => <Button variant="ghost" onClick={onReadAloud} disabled={!canReadAloud || !onReadAloud} aria-label={label} title={!canReadAloud || !onReadAloud ? 'Read aloud is unavailable' : label}><Volume2 size={20} aria-hidden="true" /></Button>

export interface SpeechBubbleProps extends ReadAloudActionProps { children: ReactNode; className?: string }
export const SpeechBubble = ({ children, className, ...voice }: SpeechBubbleProps) => <div className={cn('ds-speech-bubble', className)}><div className="ds-speech-content">{children}</div><ReadAloudAction {...voice} /></div>

export interface ReadAloudTextProps extends ReadAloudActionProps {
  words: readonly string[]
  activeWordIndex?: number | null
  className?: string
}
/** The caller supplies tokenisation and the current word. This component starts no speech. */
export const ReadAloudText = ({ words, activeWordIndex, className, ...voice }: ReadAloudTextProps) => {
  const active = typeof activeWordIndex === 'number' && Number.isInteger(activeWordIndex) && activeWordIndex >= 0 && activeWordIndex < words.length ? activeWordIndex : undefined
  return <div className={cn('ds-read-aloud', className)}><p>{words.map((word, index) => <span key={`${index}:${word}`}>{index > 0 && ' '}{index === active ? <mark aria-current="true">{word}</mark> : word}</span>)}</p><ReadAloudAction {...voice} /></div>
}

export interface CoDockProps {
  band: AgeBand
  state?: CoState
  children?: ReactNode
  onAsk?: () => void
  hidden?: boolean
  onHiddenChange?: (hidden: boolean) => void
  className?: string
}
/** Hide is an adult-only controlled preference; it is never saved by this visual. */
export const CoDock = ({ band, state = 'idle', children, onAsk, hidden = false, onHiddenChange, className }: CoDockProps) => {
  const hide = () => onHiddenChange?.(true)
  const show = () => onHiddenChange?.(false)
  if (band === 'adults' && hidden) return <Button variant="ghost" onClick={show} disabled={!onHiddenChange}>Show Co</Button>
  return <aside aria-label="Co helper" data-co-dock-band={band} className={cn('ds-co-dock', className)}>
    <CoCharacter band={band} state={state} decorative />
    <div className="ds-co-dock-content">{children}<Button variant="secondary" onClick={onAsk} disabled={!onAsk}>Ask Co</Button></div>
    {band === 'adults' && onHiddenChange && <Button variant="ghost" onClick={hide}>Hide Co</Button>}
  </aside>
}
