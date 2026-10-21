'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { EmptyState, ErrorState } from '@/components/design-system'
import { LearnFrame, LearnLoadError, LearnSkeleton, useLearnIdentity } from '@/components/learn/learn-common'
import type { LearnBand } from '@/lib/api/learn'
import { practiceRoutes } from '@/lib/api/practice'
import { PracticePlayer } from './practice-player'
import { useSessionState } from './session-hooks'
import type { PollTiming } from './session-hooks'
import { isSessionId } from './session-api'
import type { PracticeSessionState } from './practice-types'

const hubHref = practiceRoutes.hub
export const summaryHref = practiceRoutes.summary

export function SessionEnded({ band, reason, sessionId }: { band: LearnBand; reason: 'expired' | 'abandoned' | 'completed'; sessionId: string }) {
  const kids = band === 'kids'
  if (reason === 'abandoned') {
    return <LearnFrame band={band} label="Practice closed">
      <div data-state="abandoned"><EmptyState band={band} title="This practice was closed" description="You can start a new one from the practice page." action={<Link href={hubHref} className="ds-button ds-button-primary">Back to practice</Link>} /></div>
    </LearnFrame>
  }
  return <LearnFrame band={band} label={reason === 'expired' ? 'Time is up' : 'Practice finished'}>
    <div data-state={reason}><ErrorState band={band} title={reason === 'expired' ? (kids ? 'Time is up!' : 'The time is up') : 'This practice is finished'}
      description={reason === 'expired' ? 'The time for this test is over. The answers you saved are kept, and you can see how it went.' : 'You have already finished this one.'}
      action={<div className="flex flex-wrap justify-center gap-3">
        <Link href={summaryHref(sessionId)} className="ds-button ds-button-primary">See how it went</Link>
        <Link href={hubHref} className="ds-button ds-button-secondary">Back to practice</Link>
      </div>} /></div>
  </LearnFrame>
}

export function SessionBadId({ band }: { band: LearnBand }) {
  return <LearnFrame band={band} label="Practice not found"><div data-state="no-session"><EmptyState band={band} title="We could not find that practice" description="Start a new one from the practice page." action={<Link href={hubHref} className="ds-button ds-button-primary">Back to practice</Link>} /></div></LearnFrame>
}

export interface PracticeSessionScreenProps {
  sessionId: string
  /** Replaces the default move to the summary (the dev harness stays on its own page). */
  onFinished?: (sessionId: string) => void
  /** Replaces the default move back to the practice hub. */
  onExit?: () => void
  pollTiming?: PollTiming
}

/** /learn/practice/session/[sessionId]: loads the session from the server (so a refresh resumes), then plays it. */
export function PracticeSessionScreen({ sessionId, onFinished, onExit, pollTiming }: PracticeSessionScreenProps) {
  const router = useRouter()
  const { band: identityBand } = useLearnIdentity()
  const fallback: LearnBand = identityBand ?? 'teens'
  const valid = isSessionId(sessionId)
  const query = useSessionState(valid ? sessionId : '')
  const { refetch } = query
  const [ended, setEnded] = useState<'expired' | 'completed' | null>(null)
  const finished = useCallback((id: string) => { if (onFinished) onFinished(id); else router.push(summaryHref(id)) }, [onFinished, router])
  const exit = useCallback(() => { if (onExit) onExit(); else router.push(hubHref) }, [onExit, router])
  const refresh = useCallback(async (): Promise<PracticeSessionState | null> => { const result = await refetch(); return result.data ?? null }, [refetch])

  // A session the server already completed goes straight to its summary, once.
  const status = query.data?.session.status
  const moved = useRef(false)
  useEffect(() => {
    if (status !== 'COMPLETED' || moved.current) return
    moved.current = true
    if (onFinished) onFinished(sessionId); else router.replace(summaryHref(sessionId))
  }, [onFinished, router, sessionId, status])

  if (!valid) return <SessionBadId band={fallback} />
  if (query.isPending) return <LearnSkeleton band={fallback} label="Opening your practice" rows={2} />
  // A failed re-read in the middle of practising keeps the player and its data; only a first load can fail the page.
  if (query.error && !query.data) return <LearnLoadError error={query.error} retry={() => void query.refetch()} band={fallback} backHref={hubHref} backLabel="Back to practice" />
  const band = fallback
  if (status === 'COMPLETED') return <LearnSkeleton band={band} label="Opening your summary" rows={1} />
  if (status === 'EXPIRED' || ended === 'expired') return <SessionEnded band={band} reason="expired" sessionId={sessionId} />
  if (status === 'ABANDONED') return <SessionEnded band={band} reason="abandoned" sessionId={sessionId} />
  if (ended === 'completed') return <SessionEnded band={band} reason="completed" sessionId={sessionId} />
  return <PracticePlayer key={sessionId} sessionId={sessionId} band={band} state={query.data!} syncKey={query.dataUpdatedAt} refresh={refresh}
    onFinished={finished} onExit={exit} onEnded={setEnded} pollTiming={pollTiming} />
}

