import type { HTMLAttributes } from 'react'
import type { AgeBand } from './tokens'
import { cn } from '@/lib/utils'

interface AgeBandScopeProps extends HTMLAttributes<HTMLDivElement> { band: AgeBand }

/** Presentation only. Callers must derive the band from an authorised learner profile. */
export const AgeBandScope = ({ band, className, ...props }: AgeBandScopeProps) => (
  <div {...props} data-age-band={band} className={cn('ds-age-scope', className)} />
)
