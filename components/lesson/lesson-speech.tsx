'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { Square, Volume2 } from 'lucide-react'
import { Button } from '@/components/design-system'
import type { LearnBand } from '@/lib/api/learn'
import type { LocalReadAloud } from '@/lib/hooks/use-read-aloud'
import { cn } from '@/lib/utils'

interface SpeechValue { active: number | null; starts: Record<string, number> }
const SpeechContext = createContext<SpeechValue | null>(null)
export function SpeechProvider({ active, starts, children }: SpeechValue & { children: ReactNode }) {
  return <SpeechContext.Provider value={{ active, starts }}>{children}</SpeechContext.Provider>
}

/**
 * Renders one spoken segment word by word. The word being spoken is marked, so the highlight follows the voice.
 * Words are split exactly as the speech script is, so the index always lines up. No motion is used for the mark.
 */
export function Spoken({ id, text, className }: { id: string; text: string; className?: string }) {
  const speech = useContext(SpeechContext)
  const words = text.split(/\s+/).filter(Boolean)
  const start = speech?.starts[id]
  if (!speech || start === undefined) return <span className={className}>{words.join(' ')}</span>
  return <span className={className} data-spoken={id}>{words.map((word, index) => <span key={index}>{index > 0 && ' '}{start + index === speech.active
    ? <mark aria-current="true" className="rounded-sm bg-secondary px-0.5 text-secondary-foreground outline outline-2 outline-primary">{word}</mark>
    : word}</span>)}</span>
}

/**
 * The read-aloud control. When the device has no local voice the control does not exist at all
 * (never a dead button); a plain note says so. It only starts speech when pressed.
 */
export function ReadAloudControl({ speech, band, note }: { speech: LocalReadAloud; band: LearnBand; note: string }) {
  if (!speech.canReadAloud) {
    return <p data-speech="unavailable" className="text-[length:var(--ds-small)] text-muted-foreground">
      {band === 'kids' ? 'Your device cannot read out loud. You can read along!' : 'Read aloud is not available on this device. The lesson works fine as text.'}
    </p>
  }
  const kids = band === 'kids'
  return <div className="flex flex-wrap items-center gap-3" data-speech="available">
    {speech.speaking
      ? <Button variant="secondary" onClick={speech.onStop} className={cn(kids && 'min-w-44 text-[length:var(--ds-h3)]')}><Square size={kids ? 24 : 18} aria-hidden="true" />{kids ? 'Stop' : 'Stop reading'}</Button>
      : <Button variant={kids ? 'primary' : 'secondary'} onClick={speech.onReadAloud} className={cn(kids && 'min-w-44 text-[length:var(--ds-h3)]')}><Volume2 size={kids ? 28 : 18} aria-hidden="true" />{kids ? 'Read to me' : 'Listen'}</Button>}
    <span className="text-[length:var(--ds-caption)] text-muted-foreground">{note}</span>
  </div>
}
