import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SummaryScreen } from '@/components/practice/summary-screen'

export const metadata: Metadata = { title: 'Practice summary | CoLearner' }
/** L11. The summary of a finished session. */
export default async function PracticeSummaryPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(sessionId)) notFound()
  return <SummaryScreen sessionId={sessionId} />
}
