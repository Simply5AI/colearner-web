'use client'
import Link from 'next/link'
import { useApprovalSummary } from './use-approvals'

/** Entry point on /family. The count is a convenience: if it cannot load, the link still works. */
export function ApprovalsEntry() {
  const summary = useApprovalSummary()
  const count = summary.data?.pendingCount ?? 0
  return <Link href="/family/approvals" className="ds-button ds-button-secondary" data-testid="approvals-entry">
    Requests and approvals{count > 0 && <span data-testid="approvals-badge" className="ms-2 rounded-full bg-primary px-2 text-sm text-primary-foreground" aria-label={`${count} waiting for you`}>{count}</span>}
  </Link>
}
