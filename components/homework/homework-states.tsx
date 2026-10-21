'use client'

import Link from 'next/link'
import { Button, EmptyState, ErrorState } from '@/components/design-system'
import { LearnFrame } from '@/components/learn/learn-common'
import type { LearnBand } from '@/lib/api/learn'
import { homeworkRoutes } from '@/lib/api/co'

/** The address named no usable homework session. */
export function HomeworkBadId({ band }: { band: LearnBand }) {
  return <LearnFrame band={band} label="Homework help not found">
    <div data-state="no-session"><EmptyState band={band} title="We could not find that homework help" description="Start a new problem from the homework help page." action={<Link href={homeworkRoutes.home} className="ds-button ds-button-primary">Back to homework help</Link>} /></div>
  </LearnFrame>
}

/** The server does not know this session for this learner (no difference is made between "removed" and "not yours"). */
export function HomeworkNotFound({ band }: { band: LearnBand }) {
  return <LearnFrame band={band} label="Homework help not found">
    <div data-state="not-found"><ErrorState band={band} title="We could not find that homework help" description="It may have been removed, or it may belong to someone else." action={<Link href={homeworkRoutes.home} className="ds-button ds-button-primary">Back to homework help</Link>} /></div>
  </LearnFrame>
}

/** A short note when a re-read fails in the middle of a session: the page keeps what it has and tries again by itself. */
export function ConnectionNote() {
  return <p role="status" data-testid="connection-note" className="ds-card !p-3 text-[length:var(--ds-small)]">We could not reach Co just now. Your work is saved, and we will keep trying.</p>
}

export function RetryButton({ onClick }: { onClick: () => void }) { return <Button onClick={onClick}>Try again</Button> }
