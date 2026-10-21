import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { HomeworkSessionScreen } from '@/components/homework/homework-session-screen'

export const metadata: Metadata = { title: 'Homework help | CoLearner' }

export default async function HomeworkSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(sessionId)) notFound()
  return <HomeworkSessionScreen sessionId={sessionId} />
}
