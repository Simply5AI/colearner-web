'use client'

import Link from 'next/link'
import { Button, CoCharacter } from '@/components/design-system'
import type { LearnBand } from '@/lib/api/learn'
import { cn } from '@/lib/utils'
import type { Problem } from './co-model'

const stateClass = 'flex flex-col items-center gap-3 rounded-[var(--radius)] border border-border bg-card p-5 text-center'

/** Loading the context: Co thinks while the server answers. */
export function CoLoading({ band }: { band: LearnBand }) {
  return <div role="status" aria-live="polite" data-testid="co-loading" className={cn(stateClass, 'border-dashed')}>
    <CoCharacter band={band} state="thinking" size={band === 'kids' ? 120 : 80} decorative />
    <p className="font-bold">Opening Ask Co</p>
  </div>
}

/** A failed load or start: denied, policy, not ready, limit, session ended, or a plain error with retry. */
export function CoProblemState({ problem, band, onRetry, backHref }: { problem: Problem; band: LearnBand; onRetry?: () => void; backHref?: string | null }) {
  return <div role={problem.kind === 'error' ? 'alert' : 'status'} data-testid="co-problem" data-problem={problem.kind} className={stateClass}>
    <CoCharacter band={band} state="encouraging" size={band === 'kids' ? 120 : 80} decorative />
    <h3 className="text-[length:var(--ds-h3)] font-bold">{problem.title}</h3>
    <p className="max-w-prose text-muted-foreground">{problem.message}</p>
    <div className="flex flex-wrap justify-center gap-3">
      {problem.retryable && onRetry && <Button onClick={onRetry}>Try again</Button>}
      {backHref && <Link href={backHref} className="ds-button ds-button-secondary">Go to my library</Link>}
    </div>
  </div>
}

/**
 * The server says Ask Co cannot answer here (switched off, school or family settings, material not ready). Its reason is
 * shown as given. With no material context there is nothing to ground a chat in, so the learner is pointed to the library
 * instead of being offered an ungrounded chat.
 */
export function CoUnavailableState({ reason, band, hasMaterial, libraryHref }: { reason: string | null; band: LearnBand; hasMaterial: boolean; libraryHref: string }) {
  return <div role="status" data-testid="co-unavailable" className={stateClass}>
    <CoCharacter band={band} state="encouraging" size={band === 'kids' ? 120 : 80} decorative />
    <h3 className="text-[length:var(--ds-h3)] font-bold">{hasMaterial ? 'Ask Co is not available right now' : 'Pick something to ask about'}</h3>
    <p className="max-w-prose text-muted-foreground">{reason ?? (hasMaterial ? 'Ask Co is not available for this material yet.' : 'Co answers from your own material. Open a page or a lesson in your library, then ask Co about it.')}</p>
    {!hasMaterial && <Link href={libraryHref} className="ds-button ds-button-primary">Go to my library</Link>}
  </div>
}
