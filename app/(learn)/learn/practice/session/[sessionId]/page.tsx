import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PracticeSessionScreen } from '@/components/practice/session/practice-session-screen'

export const metadata: Metadata = { title: 'Practice | CoLearner' }
export default async function PracticeSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(sessionId)) notFound()
  return <PracticeSessionScreen sessionId={sessionId} />
}
