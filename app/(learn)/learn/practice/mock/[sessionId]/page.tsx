import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MockSittingScreen } from '@/components/tutor-loop/practice/mock-sitting'

export const metadata: Metadata = { title: 'Mock exam | CoLearner' }
export default async function MockSittingPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  if (!/^[A-Za-z0-9-]{8,64}$/.test(sessionId)) notFound()
  return <MockSittingScreen sessionId={sessionId} />
}
