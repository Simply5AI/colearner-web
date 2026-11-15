'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Button, ErrorState, Skeleton } from '@/components/design-system'
import { LessonWorkspace } from '@/components/lesson/lesson-workspace'
import { isTutorNotEnabled, isTutorLoopApiError, isTutorResting } from '@/lib/api/tutor-loop/client'
import { generationFailureCopy, newRequestId, tutorPracticeApi } from '@/lib/api/tutor-loop/practice'
import { ShortLessonScreen } from './short-lesson'

/** Version select: a four-card TUTOR lesson opens the short lesson; anything else (404, flag off) keeps the five-card lesson unchanged. */
export function LessonVersionSwitch({ lessonId }: { lessonId: string }) {
  const probe = useQuery({ queryKey: ['tutor-lesson', 'probe', lessonId], queryFn: () => tutorPracticeApi.shortLesson(lessonId), retry: false, staleTime: 30_000 })
  if (probe.isPending) return <div className="mx-auto max-w-2xl p-6" aria-busy="true"><Skeleton className="h-48" /></div>
  if (probe.data) return <ShortLessonScreen lessonId={lessonId} />
  if (isTutorLoopApiError(probe.error) && (probe.error.status === 404 || probe.error.status === 400 || isTutorNotEnabled(probe.error))) return <LessonWorkspace lessonId={lessonId} />
  return <div className="mx-auto max-w-2xl p-6"><ErrorState title="This lesson did not load" description="Try again." action={<Button onClick={() => probe.refetch()}>Try again</Button>} /></div>
}

/** `/learn/lesson/new?format=short&materialId&topicId`: makes the four-card lesson once, then opens it. */
export function ShortLessonStarter({ materialId, topicId }: { materialId: string; topicId: string }) {
  const router = useRouter()
  const id = useRef(newRequestId())
  const m = useMutation({
    mutationFn: () => tutorPracticeApi.createShortLesson({ clientRequestId: id.current, topicId, materialId }),
    onSuccess: (l) => router.replace(`/learn/lesson/${encodeURIComponent(l.id)}`),
  })
  // AI is unavailable (503 AI_UNAVAILABLE): nothing was made or charged, so open the existing five-card lesson flow instead.
  useEffect(() => {
    if (m.isError && isTutorResting(m.error)) router.replace(`/learn/lesson/new?materialId=${encodeURIComponent(materialId)}`)
  }, [m.isError, m.error, router, materialId])
  const started = useRef(false)
  useEffect(() => { if (!started.current) { started.current = true; m.mutate() } }, [m])
  if (m.isError && !isTutorResting(m.error)) return <div className="mx-auto max-w-2xl p-6"><ErrorState title="Your tutor is resting" description={generationFailureCopy('AI_UNAVAILABLE')} action={<Button onClick={() => m.mutate()}>Try again</Button>} /></div>
  return <div role="status" className="mx-auto max-w-2xl p-6">Getting your short lesson ready…</div>
}
