import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MockResultScreen } from '@/components/tutor-loop/practice/mock-result'

export const metadata: Metadata = { title: 'Mock result | CoLearner' }
export default async function MockResultPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  if (!/^[A-Za-z0-9-]{8,64}$/.test(sessionId)) notFound()
  return <MockResultScreen sessionId={sessionId} />
}
