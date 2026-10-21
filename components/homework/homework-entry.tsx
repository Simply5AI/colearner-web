'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, History } from 'lucide-react'
import { Button, Skeleton } from '@/components/design-system'
import { LearnFrame, useLearnIdentity } from '@/components/learn/learn-common'
import type { LearnBand } from '@/lib/api/learn'
import { homeworkApi, homeworkRoutes, type CoContextInfo, type HomeworkListItem } from '@/lib/api/co'
import { forgetActionId, idKeys, stableActionId } from './homework-ids'
import { useHomeworkHistory } from './homework-hooks'
import { problemLimit, sessionDate } from './homework-model'
import { AiLabel, CharCount, CoSays, ParentNotice } from './homework-parts'
import { cn } from '@/lib/utils'

const DRAFT_KEY = 'colearner:homework:draft'
/** The server's reason when it sends one; otherwise the truthful default (there is no photo reading yet). */
export const PHOTO_FALLBACK_REASON = 'Taking a photo of a problem is not available yet. Type the problem instead.'

function readDraft(): string {
  try { return window.sessionStorage.getItem(DRAFT_KEY) ?? '' } catch { return '' }
}
function writeDraft(value: string) {
  try { if (value) window.sessionStorage.setItem(DRAFT_KEY, value); else window.sessionStorage.removeItem(DRAFT_KEY) } catch { /* the draft then lives on this page only */ }
}

/** The photo card is always disabled: the platform has no reading of pictures. The server's reason is shown as visible text. */
export function SnapCard({ band, reason }: { band: LearnBand; reason: string | null }) {
  const reasonId = useId()
  return <section aria-label="Snap the problem" data-testid="snap-card" data-action-state="unavailable" className="ds-card grid content-start gap-3">
    <span className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground"><Camera size={28} aria-hidden="true" /></span>
    <h2 className="font-extrabold">Snap the problem</h2>
    <p className="text-muted-foreground">Worksheet, textbook or whiteboard</p>
    <Button variant="secondary" disabled aria-disabled="true" aria-describedby={reasonId} className={cn('justify-self-start', band === 'kids' && 'text-[length:var(--ds-h3)]')}><Camera size={band === 'kids' ? 28 : 18} aria-hidden="true" />Snap the problem</Button>
    <p id={reasonId} data-testid="snap-reason" className="text-[length:var(--ds-small)] text-muted-foreground">{reason ?? PHOTO_FALLBACK_REASON}</p>
  </section>
}

/** A short, neutral line for where an earlier session ended (no scores). */
export function phaseWords(row: HomeworkListItem): string {
  switch (row.phase) {
    case 'DONE': return row.finalVerdict === 'on_track' ? 'Worked out' : 'Finished'
    case 'ABANDONED': return 'Closed'
    case 'CAPTURE': case 'RESTATE': return 'Just started'
    case 'FINAL': case 'CHECKED': return 'Almost there'
    default: return row.stepNumber > 0 ? `On step ${row.stepNumber}` : 'In progress'
  }
}

export interface HistoryViewProps {
  rows: HomeworkListItem[]
  loading: boolean
  error: Error | null
  hasMore: boolean
  loadingMore: boolean
  onMore: () => void
  onRetry: () => void
}
/** Earlier homework help sessions, newest first, from the learner's own history. Each opens where it was left. */
export function EarlierSessions({ band, history }: { band: LearnBand; history: HistoryViewProps }) {
  const rows = history.rows
  return <section aria-labelledby="earlier-title" data-testid="earlier-sessions" className="space-y-3">
    <h2 id="earlier-title" className="flex items-center gap-2"><History size={band === 'kids' ? 28 : 20} aria-hidden="true" />Earlier homework help</h2>
    {history.loading && <div data-state="loading" role="status" aria-label="Loading earlier homework help" className="space-y-2"><span className="sr-only">Loading earlier homework help</span><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>}
    {!history.loading && history.error && <div role="alert" data-state="history-error" className="ds-card flex flex-wrap items-center gap-3">
      <p className="flex-1">{history.error.message}</p><Button variant="secondary" onClick={history.onRetry}>Try again</Button>
    </div>}
    {!history.loading && !history.error && rows.length === 0 && <p data-state="history-empty" className="text-muted-foreground">{band === 'kids' ? 'Nothing here yet. Your homework help will show up here.' : 'No earlier homework help yet. It will appear here after your first one.'}</p>}
    {rows.length > 0 && <ul className="grid gap-3">
      {rows.map(row => {
        const date = sessionDate(row.startedAt)
        const status = phaseWords(row)
        return <li key={row.id} className="ds-card flex flex-wrap items-center gap-3" data-testid="earlier-session" data-phase={row.phase}>
          <div className="min-w-0 flex-1">
            <p dir="auto" className="break-words font-bold">{row.problemPreview || 'Homework help'}</p>
            <p className="text-[length:var(--ds-small)] text-muted-foreground">{[date, status].filter(Boolean).join(' · ')}</p>
          </div>
          <Link href={homeworkRoutes.session(row.id)} className="ds-button ds-button-secondary">{row.phase === 'DONE' || row.phase === 'ABANDONED' ? 'Look' : 'Carry on'}<span className="sr-only"> {row.problemPreview || 'homework help'}</span></Link>
        </li>
      })}
    </ul>}
    {history.hasMore && !history.loading && <Button variant="ghost" onClick={history.onMore} loading={history.loadingMore}>Show more</Button>}
  </section>
}

export interface EntryViewProps {
  band: LearnBand
  context: CoContextInfo | null
  problem: string
  onProblem: (value: string) => void
  onSubmit: () => void
  pending: boolean
  error: Error | null
  history: HistoryViewProps
}
/** Pure presentation of /learn/homework: the typed problem, the (disabled) photo card, the parent notice and earlier sessions. */
export function HomeworkEntryView({ band, context, problem, onProblem, onSubmit, pending, error, history }: EntryViewProps) {
  const kids = band === 'kids'
  const limit = problemLimit[band]
  const id = useId()
  const countId = useId()
  const submit = (event: FormEvent) => { event.preventDefault(); if (problem.trim() && !pending) onSubmit() }
  const line = kids ? 'Type your homework problem. I will help you work it out, one step at a time.' : 'Type the problem and I will guide you through it, one step at a time. You find the answer.'
  return <LearnFrame band={band} label="Homework help">
    <div className="space-y-2">
      <h1>Homework help</h1>
      <p className="text-muted-foreground">Co guides you one step at a time. You find the answer.</p>
    </div>
    <CoSays band={band} pose="curious" readText={line}><p>{line}</p></CoSays>
    <div className="flex flex-wrap items-center gap-3"><AiLabel /></div>
    <ParentNotice band={band} mode={context?.parentVisibility.mode} />
    <div className="grid gap-4 md:grid-cols-2">
      <SnapCard band={band} reason={context?.photo.reason ?? null} />
      <form onSubmit={submit} className="ds-card grid content-start gap-3" aria-labelledby={`${id}-type`} data-testid="type-card">
        <h2 id={`${id}-type`} className="font-extrabold">Or type it</h2>
        <div className="ds-field">
          <label htmlFor={id}>{kids ? 'Your problem' : 'The problem'}</label>
          <textarea id={id} dir="auto" value={problem} rows={kids ? 4 : 5} maxLength={limit} disabled={pending} spellCheck aria-describedby={countId} data-testid="problem-input"
            placeholder={kids ? 'Type your problem here' : 'Type or paste the problem here'} onChange={event => onProblem(event.target.value.slice(0, limit))} className="ds-input min-h-32 resize-y leading-relaxed" />
          <CharCount id={countId} value={problem} limit={limit} />
        </div>
        <Button type="submit" loading={pending} disabled={!problem.trim()} className={cn('justify-self-start', kids && 'text-[length:var(--ds-h3)]')} data-testid="help-me">Help me with this</Button>
        {error && <p role="alert" data-testid="create-error" className="ds-field-error">{error.message}</p>}
      </form>
    </div>
    <EarlierSessions band={band} history={history} />
  </LearnFrame>
}

export interface HomeworkEntryScreenProps {
  /** Replaces the default router move (the dev harness stays on its own page). */
  navigate?: (href: string) => void
}
/** /learn/homework: types a problem, creates the session once (idempotent client id) and moves to it. */
export function HomeworkEntryScreen({ navigate }: HomeworkEntryScreenProps) {
  const router = useRouter()
  const { band: identityBand } = useLearnIdentity()
  // The platform has no homework-wide context call (`GET co/context` needs a lessonId or materialId and answers 400 without one), so
  // the entry page uses the identity band, the truthful photo default and the band's parent notice. The session page shows the
  // server's own parent-visibility snapshot and hint cap.
  const history = useHomeworkHistory()
  const band: LearnBand = identityBand ?? 'teens'
  const [problem, setProblem] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const busy = useRef(false)
  // The draft survives a refresh and a failed send (storage may be blocked: then it lives on this page only).
  useEffect(() => { setProblem(readDraft()) }, [])
  const change = (value: string) => { setProblem(value); writeDraft(value) }

  const submit = async () => {
    if (busy.current) return
    busy.current = true
    setPending(true); setError(null)
    const text = problem.trim()
    try {
      const created = await homeworkApi.create({ problem: text, clientSessionId: stableActionId(idKeys.create, text) })
      forgetActionId(idKeys.create); writeDraft('')
      const href = homeworkRoutes.session(created.id)
      // Stay locked after a good send: the move to the session is on its way and a second press must not start another.
      if (navigate) navigate(href); else router.push(href)
      return
    } catch (failure) {
      setError(failure instanceof Error ? failure : new Error('Something went wrong. Please try again.'))
    }
    busy.current = false
    setPending(false)
  }
  const pages = history.data?.pages ?? []
  return <HomeworkEntryView band={band} context={null} problem={problem} onProblem={change} onSubmit={() => void submit()} pending={pending} error={error}
    history={{
      rows: pages.flatMap(page => page.items), loading: history.isPending && history.fetchStatus !== 'idle', error: history.error,
      hasMore: !!history.hasNextPage, loadingMore: history.isFetchingNextPage, onMore: () => void history.fetchNextPage(), onRetry: () => void history.refetch(),
    }} />
}
