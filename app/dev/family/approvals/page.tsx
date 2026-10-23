import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ApprovalsHarness } from '@/components/family/approvals/dev/approvals-harness'

/** Local visual qualification only; synthetic fixtures, no real API, and unavailable outside development. */
export default function FamilyApprovalsDevPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <Suspense><ApprovalsHarness /></Suspense>
}
