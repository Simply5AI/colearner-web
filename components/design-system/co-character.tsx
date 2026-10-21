'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'
import { ageTokens, type AgeBand } from './tokens'

export const coStates = ['idle', 'waving', 'listening', 'thinking', 'reading', 'explaining', 'asking', 'hinting', 'encouraging', 'celebrating', 'curious', 'sleepy'] as const
export type CoState = (typeof coStates)[number]

interface CoCharacterProps {
  band?: AgeBand
  state?: CoState
  size?: number
  decorative?: boolean
  label?: string
  className?: string
}

/** Original co-placeholder.svg shapes, with static expressive poses and gentle CSS motion. */
export const CoCharacter = ({ band = 'teens', state = 'idle', size, decorative = false, label, className }: CoCharacterProps) => {
  const id = useId().replace(/:/g, '')
  const dimensions = size ?? ageTokens[band].coSize
  const title = label ?? `Co, ${state}`
  if (band === 'adults') {
    return <span role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : title} aria-hidden={decorative || undefined} data-co-state={state} data-co-band={band} className={cn('ds-co ds-co-dot', className)} style={{ width: dimensions, height: dimensions }} />
  }
  const raised = state === 'celebrating' || state === 'waving' || state === 'hinting'
  const open = state === 'encouraging'
  const sleepy = state === 'sleepy'
  const leftArm = raised ? 'M46 112 Q24 102 26 80' : open ? 'M46 112 Q24 104 16 112' : 'M46 112 q-16 -4 -20 10'
  const rightArm = state === 'celebrating' ? 'M154 112 Q176 102 174 80' : state === 'explaining' ? 'M154 112 Q174 104 184 98' : open ? 'M154 112 Q176 104 184 112' : 'M154 112 q16 -4 20 10'
  const viewBox = band === 'teens' ? '44 44 112 112' : band === 'tweens' ? '8 20 184 148' : '0 0 200 200'
  return (
    <svg role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : title} aria-hidden={decorative || undefined} focusable="false" viewBox={viewBox} width={dimensions} height={dimensions} data-co-state={state} data-co-band={band} className={cn('ds-co', className)}>
      {!decorative && <title>{title}</title>}
      <defs>
        <radialGradient id={`${id}-body`} cx="45%" cy="40%" r="60%"><stop offset="0" stopColor="#ffc6a5" /><stop offset=".45" stopColor="#e8813e" /><stop offset="1" stopColor="#c4621a" /></radialGradient>
        <radialGradient id={`${id}-glow`}><stop offset=".55" stopColor="#f6a06b" stopOpacity=".45" /><stop offset="1" stopColor="#f6a06b" stopOpacity="0" /></radialGradient>
      </defs>
      <circle cx="100" cy="96" r="92" fill={`url(#${id}-glow)`} />
      {band === 'kids' && <ellipse cx="100" cy="182" rx="34" ry="6" fill="#201e1d" opacity=".12" />}
      <g className="ds-co-body" opacity={sleepy ? .72 : 1}>
        <path className={state === 'waving' ? 'ds-co-wave' : undefined} d={leftArm} stroke="#d67f48" strokeWidth="12" strokeLinecap="round" fill="none" />
        <path d={rightArm} stroke="#d67f48" strokeWidth="12" strokeLinecap="round" fill="none" />
        <path d="M100 30 C138 30 158 70 158 108 C158 142 132 164 100 164 C68 164 42 142 42 108 C42 70 62 30 100 30 Z" fill={`url(#${id}-body)`} />
        {sleepy ? <g fill="none" stroke="#201e1d" strokeWidth="5" strokeLinecap="round"><path d="M72 98q8 7 16 0" /><path d="M112 98q8 7 16 0" /></g> : <g>
          <ellipse cx="80" cy={state === 'thinking' ? 90 : 98} rx="9" ry={state === 'curious' || state === 'listening' ? 15 : 12} fill="#201e1d" />
          <ellipse cx="120" cy={state === 'thinking' ? 90 : 98} rx="9" ry={state === 'curious' || state === 'listening' ? 15 : 12} fill="#201e1d" />
          <circle cx="83" cy={state === 'thinking' ? 86 : 94} r="3" fill="#fff" /><circle cx="123" cy={state === 'thinking' ? 86 : 94} r="3" fill="#fff" />
        </g>}
        {state === 'asking' || state === 'curious' ? <ellipse cx="100" cy="125" rx="6" ry="8" fill="#201e1d" /> : <path d="M86 124 q14 12 28 0" stroke="#201e1d" strokeWidth="5" strokeLinecap="round" fill="none" />}
        {state === 'reading' && <g stroke="#93420c" strokeWidth="3"><path d="M70 128L100 134L130 128V156L100 162L70 156Z" fill="#fff4eb" /><path d="M100 134v28" /><path d="M78 138l14 3m-14 5l14 3m16-8l14-3m-14 11l14-3" /></g>}
      </g>
      {state === 'thinking' && <g className="ds-co-thought" fill="#93420c"><circle cx="160" cy="48" r="4" /><circle cx="170" cy="35" r="5" /><circle cx="155" cy="22" r="6" /></g>}
      {state === 'listening' && <g fill="none" stroke="#93420c" strokeWidth="4" strokeLinecap="round"><path d="M170 85q12 15 0 30m10-40q20 25 0 50" /></g>}
      {state === 'asking' && <text x="155" y="50" fontSize="32" fontWeight="800" fill="#93420c" aria-hidden="true">?</text>}
      {state === 'hinting' && <g stroke="#93420c" strokeWidth="3" fill="#ffdf82"><path d="M29 44c-12 0-16 15-7 22l2 7h10l2-7c9-7 5-22-7-22Z" /><path d="M25 79h8m-4-43v-7m-20 16-6-4m46 4 6-4" /></g>}
      {state === 'celebrating' && <g className="ds-co-stars" fill="#93420c"><path d="m30 36 3 8 8 3-8 3-3 8-3-8-8-3 8-3Zm139-14 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" /></g>}
    </svg>
  )
}
