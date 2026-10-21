import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { FamilyConversationsHarness } from '@/components/family/dev/conversation-harness'

/** Local visual qualification only; synthetic fixtures, no real API, and unavailable outside development. */
export default function FamilyConversationsDevPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <Suspense><FamilyConversationsHarness /></Suspense>
}
