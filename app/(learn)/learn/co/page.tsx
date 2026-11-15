import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AskCoPage } from '@/components/tutor-loop/co/ask-co-page'
import { tutorLoopReady } from '@/components/tutor-loop/shell/eligibility'
import { parseTutorContextFromSearchParams } from '@/lib/tutor-loop/open-tutor'

export const metadata: Metadata = { title: 'Ask Co | CoLearner' }

export default async function LearnCoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (!(await tutorLoopReady())) redirect('/learn')
  const { context, mode } = parseTutorContextFromSearchParams(await searchParams)
  return <AskCoPage initialContext={context} initialMode={mode ?? null} />
}
