'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLearnIdentity } from '@/components/learn/learn-common'
import { isAccessChangedError, lessonApi, lessonDetailSchema, pollDelay, type LessonDetail, type LessonProgress, type ProgressBody } from '@/lib/api/lesson'
import { LearnApiError } from '@/lib/api/learn-request'

export const lessonKeys = {
  root: ['learn'] as const,
  detail: (actor: string, lessonId: string) => ['learn', actor, 'lesson', lessonId] as const,
  start: (actor: string, materialId: string, planItemId: string | null) => ['learn', actor, 'lesson-start', materialId, planItemId] as const,
}

/**
 * Loads a lesson. A queued or running lesson is polled with backoff, so the page survives a refresh and the learner
 * sees it become ready without doing anything. A ready lesson is never refetched behind the learner's back.
 */
export function useLessonDetail(lessonId: string, pollBaseMs = 2000) {
  const { actor } = useLearnIdentity()
  return useQuery({
    queryKey: lessonKeys.detail(actor, lessonId),
    queryFn: () => lessonApi.detail(lessonId),
    enabled: !!actor && !!lessonId,
    retry: false, staleTime: 0, gcTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: false,
    refetchInterval: query => {
      const status = query.state.data?.lesson.status
      return status === 'QUEUED' || status === 'RUNNING' ? pollDelay(query.state.dataUpdateCount, pollBaseMs) : false
    },
  })
}

/** Refreshes the cached lesson after a write whose response is not the detail. */
export function useRefreshLesson(lessonId: string) {
  const { actor } = useLearnIdentity()
  const client = useQueryClient()
  return useCallback(async () => {
    await client.invalidateQueries({ queryKey: lessonKeys.detail(actor, lessonId) })
  }, [client, actor, lessonId])
}

/** Stores a detail returned by the server (complete) when it is valid, otherwise refreshes. */
export function useAdoptLessonDetail(lessonId: string) {
  const { actor } = useLearnIdentity()
  const client = useQueryClient()
  return useCallback(async (value: unknown) => {
    const parsed = lessonDetailSchema.safeParse(value)
    if (parsed.success) client.setQueryData<LessonDetail>(lessonKeys.detail(actor, lessonId), parsed.data)
    else await client.invalidateQueries({ queryKey: lessonKeys.detail(actor, lessonId) })
  }, [client, actor, lessonId])
}

const LESSON_LAST_STEP = 4
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
interface ProgressSync {
  revision: number; ackedCurrent: number; desired: number
  /** Steps the server has recorded as completed. The server refuses a current step past its first unfinished step. */
  acked: Set<number>
  pending: Set<number>; inFlight: boolean; timer: ReturnType<typeof setTimeout> | null
  retries: number; conflicts: number; disposed: boolean; failed: boolean; revoked: boolean
}
/** Only PROGRESS_CONFLICT means "someone else moved the lesson"; STEP_ORDER, CHECK_REQUIRED and the rest are real refusals. */
const isConflict = (error: unknown) => error instanceof LearnApiError && error.status === 409 && (error.code === 'PROGRESS_CONFLICT' || error.code === undefined)

interface UseProgressOptions {
  lessonId: string
  initial: LessonProgress
  /** Loads the server's current progress after a 409 PROGRESS_CONFLICT. */
  loadCurrent: () => Promise<LessonProgress>
  debounceMs?: number
  retryBaseMs?: number
  /** False for a read-only look back at a finished lesson: nothing is written. */
  persist?: boolean
  /** The server refused a write because access to the lesson changed; the screen reloads and hides the lesson. */
  onAccessChanged?: () => void
}

/**
 * Persisted step progress. The learner moves instantly (local state) and writes follow:
 * - one write in flight at a time, always carrying the latest step and the oldest unsaved completion;
 * - the revision is taken from the last acknowledged write, so repeating a failed write sends the same body
 *   and the server (idempotent, monotonic) can never record a step twice;
 * - a 409 PROGRESS_CONFLICT adopts the server's progress, keeps unsaved completions and tries again;
 * - a network failure retries a few times with backoff, then waits for the learner's explicit retry.
 */
export function useLessonProgress({ lessonId, initial, loadCurrent, debounceMs = 450, retryBaseMs = 1000, persist = true, onAccessChanged }: UseProgressOptions) {
  const [current, setCurrent] = useState(initial.currentStep)
  const [completed, setCompleted] = useState<number[]>(initial.completedSteps)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const sync = useRef<ProgressSync>({ revision: initial.revision, ackedCurrent: initial.currentStep, desired: initial.currentStep, acked: new Set(initial.completedSteps), pending: new Set(), inFlight: false, timer: null, retries: 0, conflicts: 0, disposed: false, failed: false, revoked: false })
  const loadRef = useRef(loadCurrent)
  loadRef.current = loadCurrent
  const accessRef = useRef(onAccessChanged)
  accessRef.current = onAccessChanged

  const flush = useCallback(async (): Promise<void> => {
    const s = sync.current
    if (s.inFlight || s.disposed || s.revoked) return
    if (s.timer) { clearTimeout(s.timer); s.timer = null }
    const completedStep = s.pending.size > 0 ? Math.min(...s.pending) : undefined
    if (completedStep === undefined && s.desired === s.ackedCurrent) { setStatus(previous => previous === 'saving' ? 'saved' : previous); return }
    s.inFlight = true
    setStatus('saving')
    // The platform answers 409 STEP_ORDER when the current step is past the first step it has not recorded as done.
    // Several completions can queue up while a write is in flight or the network is down, and one write records only
    // the oldest of them, so the current step is held back to what the server will accept and the rest follows.
    const known = new Set(s.acked)
    if (completedStep !== undefined) known.add(completedStep)
    let frontier = 0
    while (frontier < LESSON_LAST_STEP && known.has(frontier)) frontier += 1
    const body: ProgressBody = { currentStep: Math.min(s.desired, frontier), revision: s.revision, ...(completedStep !== undefined ? { completedStep } : {}) }
    try {
      const saved = await lessonApi.progress(lessonId, body)
      s.inFlight = false; s.retries = 0; s.conflicts = 0; s.failed = false
      s.revision = saved.revision; s.ackedCurrent = body.currentStep
      if (completedStep !== undefined) { s.pending.delete(completedStep); s.acked.add(completedStep) }
      for (const step of saved.completedSteps) { s.pending.delete(step); s.acked.add(step) }
      if (s.disposed) return
      if (s.pending.size > 0) return flush()
      if (s.desired !== s.ackedCurrent) {
        // Held back by the server's first unfinished step with nothing left to record: another write cannot move it, so it is reported rather than repeated.
        if (body.currentStep >= frontier && body.currentStep < s.desired) { s.failed = true; setStatus('error'); return }
        return flush()
      }
      setStatus('saved')
    } catch (error) {
      s.inFlight = false
      if (s.disposed) return
      if (isAccessChangedError(error)) { s.revoked = true; s.disposed = true; accessRef.current?.(); return }
      if (isConflict(error) && s.conflicts < 3) {
        s.conflicts += 1
        try {
          const server = await loadRef.current()
          s.revision = server.revision; s.ackedCurrent = server.currentStep
          for (const step of server.completedSteps) { s.pending.delete(step); s.acked.add(step) }
          setCompleted(previous => [...new Set([...previous, ...server.completedSteps])].sort())
          return flush()
        } catch { /* falls through to the error state below */ }
      }
      s.failed = true
      setStatus('error')
      if (s.retries < 3) {
        s.retries += 1
        s.timer = setTimeout(() => { s.timer = null; void flush() }, retryBaseMs * 2 ** (s.retries - 1))
      }
    }
  }, [lessonId, retryBaseMs])

  /** Moves to a step now; optionally records a step as completed. Writes are debounced unless a completion is pending. */
  const go = useCallback((step: number, completeStep?: number) => {
    const s = sync.current
    s.desired = step
    setCurrent(step)
    if (completeStep !== undefined) setCompleted(previous => previous.includes(completeStep) ? previous : [...previous, completeStep].sort())
    if (!persist) { s.ackedCurrent = step; return }
    if (completeStep !== undefined) s.pending.add(completeStep)
    if (s.timer) clearTimeout(s.timer)
    s.timer = setTimeout(() => { s.timer = null; void flush() }, completeStep !== undefined ? 0 : debounceMs)
  }, [flush, debounceMs, persist])

  /** Explicit retry after a failed save. */
  const retry = useCallback(() => { sync.current.retries = 0; sync.current.conflicts = 0; sync.current.failed = false; void flush() }, [flush])

  /** Resolves true when nothing is left to save, false if saving failed, so completing always follows settled progress. */
  const settle = useCallback(async () => {
    const s = sync.current
    for (let attempt = 0; attempt < 200; attempt++) {
      if (s.pending.size === 0 && s.desired === s.ackedCurrent && !s.inFlight) return true
      if (s.inFlight) { await new Promise(resolve => setTimeout(resolve, 25)); continue }
      s.failed = false
      await flush()
      if (s.failed) return false
    }
    return false
  }, [flush])

  useEffect(() => {
    const s = sync.current
    s.disposed = false
    return () => {
      // A best-effort final write when the learner leaves; the timer must not outlive the page.
      if (s.timer) { clearTimeout(s.timer); s.timer = null }
      const unsaved = s.pending.size > 0 || s.desired !== s.ackedCurrent
      if (unsaved && !s.inFlight) { s.disposed = false; void flush().finally(() => { s.disposed = true }) } else s.disposed = true
    }
  }, [flush])

  return { current, completed, status, go, retry, settle }
}
