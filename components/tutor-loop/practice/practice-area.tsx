'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { PracticeHub, type PracticeTab } from './practice-hub'

function Body() {
  const p = useSearchParams()
  const topicId = p.get('topicId')
  return <PracticeHub initialTab={p.get('tab') === 'exam' ? ('exam' as PracticeTab) : 'today'} initialTopicId={topicId && /^[A-Za-z0-9-]{8,64}$/.test(topicId) ? topicId : null} />
}

/** `/learn/practice?tab=exam&goalId=&topicId=` for eligible learners (goalId is read by the shared goal filter). */
export function TutorPracticeArea() {
  return <Suspense fallback={null}><Body /></Suspense>
}
