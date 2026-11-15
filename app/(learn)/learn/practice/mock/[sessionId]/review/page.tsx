import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MockReviewScreen } from '@/components/tutor-loop/practice/mock-review'

export const metadata: Metadata = { title: 'Review mock | CoLearner' }
export default async function MockReviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  if (!/^[A-Za-z0-9-]{8,64}$/.test(sessionId)) notFound()
  return <MockReviewScreen sessionId={sessionId} />
}
