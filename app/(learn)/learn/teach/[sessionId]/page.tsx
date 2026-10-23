import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { TeachSessionScreen } from '@/components/teach-back/teach-view'

export const metadata: Metadata = { title: 'Teach it back | CoLearner' }

export default async function TeachSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(sessionId)) notFound()
  return <TeachSessionScreen sessionId={sessionId} />
}
