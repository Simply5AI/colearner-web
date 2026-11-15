import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PracticeSetScreen } from '@/components/tutor-loop/practice/practice-session'

export const metadata: Metadata = { title: 'Practice | CoLearner' }
export default async function TutorPracticeSetPage({ params, searchParams }: { params: Promise<{ sessionId: string }>; searchParams: Promise<{ count?: string }> }) {
  const { sessionId } = await params
  if (!/^[A-Za-z0-9-]{8,64}$/.test(sessionId)) notFound()
  const count = Number((await searchParams).count)
  // The set size comes from the server's question set; when unknown the screen ends when the server has no next item.
  return <PracticeSetScreen sessionId={sessionId} total={Number.isInteger(count) && count >= 1 && count <= 40 ? count : null} />
}
