'use client'

import { cn } from '@/lib/utils'
import { ageTokens, type AgeBand } from './tokens'
import { CoArtwork, type CoVariant } from './co-artwork'

export { coVariants, type CoVariant } from './co-artwork'
export const coStates = ['idle', 'waving', 'listening', 'thinking', 'reading', 'explaining', 'asking', 'hinting', 'encouraging', 'celebrating', 'curious', 'sleepy'] as const
export type CoState = (typeof coStates)[number]

/** Each assistant activity uses one of the four approved Co identities. */
export const coVariantForState: Record<CoState, CoVariant> = {
  idle: 'buddy', waving: 'buddy', listening: 'buddy', thinking: 'spark',
  reading: 'comet', explaining: 'comet', asking: 'spark', hinting: 'spark',
  encouraging: 'sprout', celebrating: 'sprout', curious: 'spark', sleepy: 'buddy',
}

interface CoCharacterProps {
  band?: AgeBand
  state?: CoState
  variant?: CoVariant
  size?: number
  decorative?: boolean
  label?: string
  className?: string
}

export const CoCharacter = ({ band = 'teens', state = 'idle', variant = coVariantForState[state], size, decorative = false, label, className }: CoCharacterProps) => {
  const dimensions = size ?? ageTokens[band].coSize
  const title = label ?? `Co, ${state}`
  return <svg role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : title} aria-hidden={decorative || undefined} focusable="false" viewBox="0 0 200 200" width={dimensions} height={dimensions} data-co-state={state} data-co-band={band} data-co-variant={variant} className={cn('ds-co', className)}>
    {!decorative && <title>{title}</title>}
    <CoArtwork variant={variant} sleepy={state === 'sleepy'} curious={state === 'curious' || state === 'asking'} thinking={state === 'thinking'} celebrating={state === 'celebrating'} waving={state === 'waving'} />
    {state === 'reading' && <g stroke="#A64C16" strokeWidth="2.5" strokeLinejoin="round"><path d="M70 148L100 155L130 148V174L100 181L70 174Z" fill="#FFF4E2" /><path d="M100 155v26m-22-24 14 3m-14 5 14 3m16-8 14-3m-14 11 14-3" fill="none" /></g>}
    {state === 'thinking' && <g className="ds-co-thought" fill="#D97726"><circle cx="151" cy="48" r="3" /><circle cx="163" cy="36" r="4" /><circle cx="151" cy="24" r="5" /></g>}
    {state === 'listening' && <g fill="none" stroke="#C45A18" strokeWidth="3" strokeLinecap="round"><path d="M172 77q9 12 0 24m9-31q14 19 0 38" /></g>}
    {state === 'hinting' && <g stroke="#A86C17" strokeWidth="2.5" fill="#FFD36C"><path d="M28 37c-11 0-14 13-6 20l2 6h8l2-6c8-7 5-20-6-20Z" /><path d="M25 68h6m-3-37v-5m-17 13-5-3m39 3 5-3" fill="none" /></g>}
    {state === 'celebrating' && <g className="ds-co-stars" fill="#F2B94B"><path d="m29 45 4 9 9 4-9 4-4 9-4-9-9-4 9-4Zm139-18 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" /></g>}
  </svg>
}
