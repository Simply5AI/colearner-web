'use client'

import { Square, Star, Timer, Volume2 } from 'lucide-react'
import { Button } from '@/components/design-system'
import type { LearnBand } from '@/lib/api/learn'
import type { PracticeMode } from '@/lib/api/practice'
import { useLocalReadAloud } from '@/lib/hooks/use-read-aloud'
import { cn } from '@/lib/utils'
import { modeLabel, modeRule, starsLabel } from './hub-model'

/** Effort stars, 0 to 3. The count is also spoken and written, never conveyed by the fill alone. */
export function StarRow({ stars, size = 20, className }: { stars: number | null; size?: number; className?: string }) {
  const filled = stars ?? 0
  return <span role="img" aria-label={starsLabel(stars)} data-stars={stars ?? 'none'} className={cn('inline-flex items-center gap-0.5 text-[var(--brand-orange,#cf5d0b)]', className)}>
    {[0, 1, 2].map(index => <Star key={index} size={size} aria-hidden="true" className={index < filled ? 'fill-current' : 'opacity-40'} />)}
  </span>
}

/** Recall (practice, review) versus the timed mock test, in words and an icon, so they are never confused. */
export function ModeTag({ mode, band, showRule = true }: { mode: PracticeMode; band: LearnBand; showRule?: boolean }) {
  const exam = mode === 'EXAM'
  return <p data-mode={mode} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[length:var(--ds-small)]">
    <span className={cn('ds-pill font-bold', exam && 'border border-dashed border-destructive text-destructive')}>{exam && <Timer size={16} aria-hidden="true" />}{modeLabel(mode, band)}</span>
    {showRule && <span className="text-muted-foreground">{modeRule(mode, band)}</span>}
  </p>
}

/**
 * A read-aloud button for a short kids line. Only offered when the device has a local voice (the B08 rule: no text
 * leaves the device, nothing autoplays); otherwise nothing is rendered, never a dead button.
 */
export function PracticeReadAloud({ text, label = 'Read to me' }: { text: string; label?: string }) {
  const speech = useLocalReadAloud(text, { rate: 0.85 })
  if (!speech.canReadAloud) return null
  return speech.speaking
    ? <Button variant="secondary" onClick={speech.onStop} aria-label="Stop reading"><Square size={24} aria-hidden="true" />Stop</Button>
    : <Button variant="secondary" onClick={speech.onReadAloud} aria-label={label}><Volume2 size={24} aria-hidden="true" />{label}</Button>
}
