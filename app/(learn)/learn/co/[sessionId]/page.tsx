import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { AskCoPage } from '@/components/tutor-loop/co/ask-co-page'
import { tutorLoopReady } from '@/components/tutor-loop/shell/eligibility'
import { isValidTutorId, parseTutorContextFromSearchParams } from '@/lib/tutor-loop/open-tutor'

export const metadata: Metadata = { title: 'Ask Co | CoLearner' }

export default async function LearnCoSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { sessionId } = await params
  if (!isValidTutorId(sessionId)) notFound()
  if (!(await tutorLoopReady())) redirect('/learn')
  const { context } = parseTutorContextFromSearchParams(await searchParams)
  return <AskCoPage initialSessionId={sessionId} initialContext={context} />
}
