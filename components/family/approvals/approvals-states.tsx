import Link from 'next/link'
import { Button, EmptyState, ErrorState } from '@/components/design-system'
import { ApprovalsError } from '@/lib/api/family-approvals'

/** Denied (not signed in / not a verified guardian), not found, and unavailable-with-retry. */
export function ApprovalsFailure({ error, retry }: { error: Error; retry: () => void }) {
  const failure = error instanceof ApprovalsError ? error : null
  if (failure?.denied) return <ErrorState band="tweens" title="Approvals need a verified guardian" description={failure.message} action={<Link href="/login?callbackUrl=/family/approvals" className="ds-button ds-button-primary">Sign in again</Link>} />
  if (failure?.notFound) return <ErrorState band="tweens" title="This request is unavailable" description={failure.message} action={<Link href="/family/approvals" className="ds-button ds-button-primary">Back to approvals</Link>} />
  return <ErrorState band="tweens" title="Approvals unavailable" description={failure?.message ?? 'Approvals are unavailable right now. Nothing was changed; please try again.'} action={<Button onClick={retry}>Try again</Button>} />
}

export const NothingPending = () => <EmptyState band="tweens" title="Nothing is waiting for you" description="When a teacher or school assigns your child a plan that needs your yes, it will appear here." />
export const NothingInHistory = () => <EmptyState band="tweens" title="No past decisions yet" description="Plans you approve, decline or remove will be listed here with who decided and when." />
