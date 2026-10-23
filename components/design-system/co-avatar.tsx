import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { CoCharacter, type CoState } from './co-character'
import type { AgeBand } from './tokens'

/** A consistent, quiet frame for Co in chat controls and compact identity slots. */
export function CoAvatar({ band = 'teens', state = 'idle', size = 44, className }: {
  band?: AgeBand; state?: CoState; size?: number; className?: string
}) {
  return <span aria-hidden="true" className={cn('ds-co-avatar', className)} style={{ '--co-avatar-size': `${size}px` } as CSSProperties}>
    <CoCharacter band={band} state={state} size={size} decorative />
  </span>
}
