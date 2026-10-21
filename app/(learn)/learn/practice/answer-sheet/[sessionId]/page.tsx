import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AnswerSheetScreen } from '@/components/practice/answer-sheet-screen'

export const metadata: Metadata = { title: 'Answer sheet | CoLearner' }
/** The answer sheet of a finished session (the server refuses a session that is still running). */
export default async function AnswerSheetPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(sessionId)) notFound()
  return <AnswerSheetScreen sessionId={sessionId} />
}
