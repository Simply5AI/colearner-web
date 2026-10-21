'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LearnLoadError, LearnSkeleton, useLearnIdentity } from '@/components/learn/learn-common'
import { LessonFocusFrame } from '@/components/lesson/lesson-focus-frame'
import { bandFromApi, type LearnBand } from '@/lib/api/learn'
import { coErrorCode, homeworkApi, homeworkRoutes, isCoId, type HomeworkDetail } from '@/lib/api/co'
import { forgetActionId, idKeys, stableActionId } from './homework-ids'
import { useAction, useHomeworkSession, type PollTiming } from './homework-hooks'
import { deriveView } from './homework-model'
import { useAnnouncer } from './homework-parts'
import { ConnectionNote, HomeworkBadId, HomeworkNotFound } from './homework-states'
import { CloseButton, HomeworkSessionView, type HomeworkActions } from './homework-view'

const HOME = '/learn/home'

export interface HomeworkSessionScreenProps {
  sessionId: string
  /** Replaces the default router move (the dev harness stays on its own page). */
  navigate?: (href: string) => void
  pollTiming?: PollTiming
}

/** What is said aloud (to a screen reader) when Co's side of the conversation changes. */
function announcementFor(detail: HomeworkDetail, view: ReturnType<typeof deriveView>): { key: string; text: string } | null {
  if (view.safety) return { key: `safety:${view.safety.id}`, text: 'Safety check. Your homework help is paused.' }
  if (view.failed) return { key: `failed:${view.failed.id}`, text: 'Co could not finish that. You can try again.' }
  if (view.pending) return { key: `pending:${view.pending.id}`, text: 'Co is thinking.' }
  const { phase } = detail.session
  const last = view.hints[view.hints.length - 1]
  if (phase === 'RESTATE' && detail.restatement) return { key: 'restate', text: `Co says: ${detail.restatement} Is that right?` }
  if (phase === 'STEPS' && view.step) {
    if (last) return { key: `hint:${view.step.number}:${last.level}`, text: `Hint ${last.level}: ${last.text}` }
    return { key: `step:${view.step.number}`, text: `Step ${view.step.number}. ${view.step.prompt}` }
  }
  if (phase === 'FINAL' && !detail.final?.verdict) return { key: 'final', text: 'Your turn. Type your own answer.' }
  if (detail.final?.verdict) {
    const text = detail.final.verdict === 'on_track' ? 'You did it! Your answer is on track.' : detail.final.verdict === 'not_yet' ? 'Not quite yet. Check the last step again.' : 'Co could not tell what you meant.'
    return { key: `verdict:${detail.final.answer}:${detail.final.verdict}`, text }
  }
  return null
}

/**
 * /learn/homework/[sessionId]: loads the session from the server (so a refresh resumes at the right phase and step), polls
 * with backoff while Co is working, and runs the transitions. Every send carries a client id kept in sessionStorage and reused
 * on retry, so a lost reply never makes a second step, hint or check.
 */
export function HomeworkSessionScreen({ sessionId, navigate, pollTiming }: HomeworkSessionScreenProps) {
  const router = useRouter()
  const { band: identityBand } = useLearnIdentity()
  const valid = isCoId(sessionId)
  const query = useHomeworkSession(valid ? sessionId : '', pollTiming)
  const { refetch } = query
  const sync = useCallback(() => refetch(), [refetch])
  const action = useAction(sync)
  const { announcement, announce } = useAnnouncer()
  const go = useCallback((href: string) => { if (navigate) navigate(href); else router.push(href) }, [navigate, router])
  const data = query.data
  const stepNumber = data?.session.stepNumber ?? 0

  const view = useMemo(() => data ? deriveView(data) : null, [data])

  const [exhausted, setExhausted] = useState(false)
  useEffect(() => { if (coErrorCode(action.error) === 'FINAL_ATTEMPTS_EXHAUSTED') setExhausted(true) }, [action.error])

  const announced = useRef<string | null>(null)
  useEffect(() => {
    if (!data || !view) return
    const next = announcementFor(data, view)
    if (!next || announced.current === next.key) return
    announced.current = next.key
    announce(next.text)
  }, [data, view, announce])

  const actions: HomeworkActions = {
    confirmRestatement: confirmed => action.run('restatement', async () => {
      const key = idKeys.restatement(sessionId, confirmed)
      await homeworkApi.restatement(sessionId, { clientTurnId: stableActionId(key, String(confirmed)), confirmed })
      forgetActionId(key)
    }),
    submitStep: text => action.run('step', async () => {
      const key = idKeys.step(sessionId, stepNumber)
      await homeworkApi.step(sessionId, { clientTurnId: stableActionId(key, text), learnerResponse: text })
      forgetActionId(key)
    }),
    requestHint: level => action.run('hint', async () => {
      const key = idKeys.hint(sessionId, level)
      await homeworkApi.hint(sessionId, { clientTurnId: stableActionId(key, ''), level })
      forgetActionId(key)
    }),
    goToFinal: () => action.run('final-phase', () => homeworkApi.finalPhase(sessionId)),
    submitFinal: text => action.run('final', async () => {
      const key = idKeys.final(sessionId)
      await homeworkApi.final(sessionId, { clientTurnId: stableActionId(key, text), answerText: text })
      forgetActionId(key)
    }),
    // After "Not quite" the session is back in CAPTURE: the new text replaces the problem and Co restates it again.
    submitProblem: problem => action.run('problem', async () => {
      const key = idKeys.problem(sessionId)
      await homeworkApi.updateProblem(sessionId, { clientTurnId: stableActionId(key, problem), problem })
      forgetActionId(key)
    }),
    finish: () => action.run('finish', () => homeworkApi.finish(sessionId)),
    // The homework retry endpoint (the shared turn retry refuses a homework conversation). It retries the newest failed turn.
    retryFailed: () => action.run('retry', async () => { if (view?.failed) await homeworkApi.retry(sessionId) }),
    refresh: () => { void refetch() },
    newProblem: () => go(homeworkRoutes.home),
    goHome: () => go(HOME),
    leave: () => go(homeworkRoutes.home),
  }

  const fallback: LearnBand = identityBand ?? 'teens'
  if (!valid) return <HomeworkBadId band={fallback} />
  if (query.isPending) return <LearnSkeleton band={fallback} label="Opening your homework help" rows={2} />
  if (query.error && !data) {
    const status = (query.error as { status?: number }).status
    if (coErrorCode(query.error) === 'SESSION_NOT_FOUND' || status === 404) return <HomeworkNotFound band={fallback} />
    return <LearnLoadError error={query.error} retry={() => void query.refetch()} band={fallback} backHref={homeworkRoutes.home} backLabel="Back to homework help" />
  }
  if (!data || !view) return <LearnSkeleton band={fallback} label="Opening your homework help" rows={2} />
  const band: LearnBand = data.session.band ? bandFromApi(data.session.band) : fallback
  const status = { pending: action.pending, kind: action.kind, error: action.error, errorKind: action.errorKind }
  return <LessonFocusFrame band={band} label="Homework help">
    <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-5 px-4 pb-8 pt-3 sm:px-7" data-testid="homework-player" data-band={band}>
      <header className="flex items-center gap-3">
        <CloseButton onClick={actions.leave} />
        <h1 className="flex-1 font-extrabold">Homework help</h1>
      </header>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="homework-announcer">{announcement}</div>
      {query.error && <ConnectionNote />}
      <HomeworkSessionView detail={data} view={view} band={band} actions={actions} status={status} triesExhausted={exhausted} />
    </div>
  </LessonFocusFrame>
}
