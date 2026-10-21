'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { LearnLoadError, LearnSkeleton, useLearnIdentity } from '@/components/learn/learn-common'
import type { LearnBand } from '@/lib/api/learn'
import { LearnApiError } from '@/lib/api/learn-request'
import { isAccessChanged, isLessonId, isPlanItemId, lessonApi, lessonBand, type LessonDetail } from '@/lib/api/lesson'
import { LessonCompleteCard } from './lesson-complete'
import { lessonKeys, useLessonDetail, useRefreshLesson } from './lesson-hooks'
import { LessonPlayer, type LessonPlayerProps } from './lesson-player'
import { LessonAccessChanged, LessonCancelled, LessonFailed, LessonGenerating, LessonNoMaterial, LessonStartError } from './lesson-states'

const HOME = '/learn/home'
const lessonStartHref = (materialId: string) => `/learn/lesson/new?materialId=${encodeURIComponent(materialId)}`

export interface LessonViewProps {
  detail: LessonDetail
  onExit: () => void
  retry: { run: () => void; pending: boolean; error: Error | null }
  cancel: { run: () => void; pending: boolean; error: Error | null }
  timing?: LessonPlayerProps['timing']
}

/** Chooses what the learner sees for a lesson record: generating, failed, hidden, the player, or the finished card. */
export function LessonView({ detail, onExit, retry, cancel, timing }: LessonViewProps) {
  const [reviewing, setReviewing] = useState(false)
  const band: LearnBand = lessonBand(detail.lesson.band)
  const { status, failure, materialId } = detail.lesson
  if (status === 'QUEUED' || status === 'RUNNING') return <LessonGenerating band={band} status={status} onCancel={cancel.run} cancelling={cancel.pending} error={cancel.error} />
  if (status === 'FAILED') return failure?.code === 'LESSON_ACCESS_CHANGED'
    ? <LessonAccessChanged band={band} />
    : <LessonFailed band={band} failure={failure} onRetry={retry.run} retrying={retry.pending} error={retry.error} startHref={lessonStartHref(materialId)} />
  if (status === 'CANCELLED') return <LessonCancelled band={band} startHref={lessonStartHref(materialId)} />
  // READY: the text is shown only while access is current. A hidden lesson shows nothing of its content.
  if (isAccessChanged(detail) || detail.content === null) return <LessonAccessChanged band={band} />
  const finished = detail.progress.completedAt !== null
  if (finished && !reviewing) return <LessonCompleteCard detail={detail} content={detail.content} band={band} onReview={() => setReviewing(true)} />
  return <LessonPlayer key={`${detail.lesson.id}:${reviewing}`} detail={detail} content={detail.content} band={band} onExit={onExit} review={finished} timing={timing} />
}

/** F-L7-01: the lesson page. Loads the lesson (and polls while it is being made), then shows the right view. */
export function LessonScreen({ lessonId, pollBaseMs, timing, onLessonChanged }: { lessonId: string; pollBaseMs?: number; timing?: LessonPlayerProps['timing']; /** Replaces the default move to another lesson id (the dev harness stays on its own page). */ onLessonChanged?: (lessonId: string) => void }) {
  const router = useRouter()
  const { band: identityBand } = useLearnIdentity()
  const query = useLessonDetail(lessonId, pollBaseMs)
  const refresh = useRefreshLesson(lessonId)
  // A retry makes the NEXT VERSION of the lesson; when it has a new id the learner moves to it.
  const retry = useMutation({
    mutationFn: () => lessonApi.retry(lessonId), retry: false,
    onSuccess: async ({ lesson }) => {
      if (lesson.id !== lessonId && isLessonId(lesson.id)) { if (onLessonChanged) onLessonChanged(lesson.id); else router.replace(`/learn/lesson/${encodeURIComponent(lesson.id)}`) }
      else await refresh()
    },
  })
  const cancel = useMutation({ mutationFn: () => lessonApi.cancel(lessonId), retry: false, onSuccess: refresh })
  // A double press sends one request: the guard is a ref because state updates land after both clicks.
  const busy = useRef({ retry: false, cancel: false })
  const once = (key: 'retry' | 'cancel', run: { mutate: (variables: void, options: { onSettled: () => void }) => void }) => () => {
    if (busy.current[key]) return
    busy.current[key] = true
    run.mutate(undefined, { onSettled: () => { busy.current[key] = false } })
  }
  const fallbackBand: LearnBand = identityBand ?? 'teens'
  if (query.isPending) return <LearnSkeleton band={fallbackBand} label="Opening your lesson" rows={2} />
  if (query.error) return <LearnLoadError error={query.error} retry={() => void query.refetch()} band={fallbackBand} backHref="/learn/library" backLabel="Back to my library" />
  return <LessonView detail={query.data} onExit={() => router.push(HOME)}
    retry={{ run: once('retry', retry), pending: retry.isPending, error: retry.error }}
    cancel={{ run: once('cancel', cancel), pending: cancel.isPending, error: cancel.error }} timing={timing} />
}

/**
 * /learn/lesson/new: asks the server for the lesson for this material (idempotent get-or-create, so a refresh or a
 * repeated visit returns the same lesson), then moves on to the lesson page, which shows progress while it is made.
 * It is a query rather than a mutation run from an effect: a query is de-duplicated, so React's development
 * double-mount (and a fast refresh) cannot lose the answer or send the request twice.
 */
export function LessonStartScreen({ materialId, planItemId, onStarted }: { materialId: string | null; planItemId?: string | null; /** Replaces the default move to the lesson page (the dev harness stays on its own page). */ onStarted?: (lessonId: string) => void }) {
  const router = useRouter()
  const { actor, band: identityBand } = useLearnIdentity()
  const band: LearnBand = identityBand ?? 'teens'
  const valid = isLessonId(materialId) ? materialId : null
  // The platform accepts a plan item id only as a uuid (strict body); anything else is dropped rather than sent.
  const item = isPlanItemId(planItemId) ? planItemId : null
  const query = useQuery({
    queryKey: lessonKeys.start(actor, valid ?? '', item),
    queryFn: async () => {
      try { return await lessonApi.create({ materialId: valid!, ...(item ? { planItemId: item } : {}) }) }
      catch (error) {
        // A plan item that is not this learner's (404 "Plan item unavailable") must not block a lesson on the material itself.
        if (item && error instanceof LearnApiError && error.status === 404) return lessonApi.create({ materialId: valid! })
        throw error
      }
    },
    enabled: !!actor && !!valid,
    retry: false, staleTime: 5000, gcTime: 10000, refetchOnWindowFocus: false,
  })
  const moved = useRef<string | null>(null)
  const lessonId = query.data?.lesson.id
  useEffect(() => {
    if (!lessonId || !isLessonId(lessonId) || moved.current === lessonId) return
    moved.current = lessonId
    if (onStarted) onStarted(lessonId); else router.replace(`/learn/lesson/${encodeURIComponent(lessonId)}`)
  }, [lessonId, onStarted, router])
  if (!valid) return <LessonNoMaterial band={band} />
  if (query.error && !query.isFetching) return <LessonStartError error={query.error} band={band} retry={() => void query.refetch()} />
  return <LearnSkeleton band={band} label="Getting your lesson ready" rows={2} />
}
