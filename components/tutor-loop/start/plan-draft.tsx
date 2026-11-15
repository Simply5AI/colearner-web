'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import {
  acceptPlanDraft, BASIS_LABELS, cancelPlanDraft, createManualPlan, getGoal, getPlanDraft,
  regeneratePlanDraft, startPlanDraft,
  type LearnerGoalItem, type PlanDraft, type PlanDraftJob, type TutorPlan,
} from '@/lib/api/tutor-loop/goals'
import type { TutorIcon } from '@/lib/api/tutor-loop/profile'
import { formatTutorDate } from '@/lib/tutor-loop/date'
import { friendlyError } from './errors'
import { TutorArt } from './start-frame'

type Workspace = 'school' | 'personal'

/** How long we keep polling before offering the manual path. */
export const DRAFT_PATIENCE_MS = 90_000

export function draftTotals(draft: PlanDraft) {
  const topics = draft.phases.flatMap((phase) => phase.topics)
  const minutes = topics.reduce((sum, topic) => sum + topic.estimateMin, 0)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return { topics: topics.length, minutes, label: hours ? `${hours} h${rest ? ` ${rest} min` : ''}` : `${rest} min` }
}

const secondary = 'ds-button ds-button-secondary'
const primary = 'ds-button ds-button-primary'

interface PlanStageProps {
  goal: LearnerGoalItem
  workspace: Workspace
  icon: TutorIcon | string
  tutorName: string
  materialIds?: string[]
  syllabusText?: string
  onAccepted: (plan: TutorPlan) => void
  /** Offered when the learner would rather carry on without a plan right now. */
  onSkip?: () => void
}

/** TL03: "Making your plan…" then "Here's your plan", with the by-hand path whenever drafting is unavailable. */
export function PlanStage(props: PlanStageProps) {
  const { goal, workspace, icon, tutorName, materialIds, syllabusText, onAccepted, onSkip } = props
  const options = { workspace }
  const [manual, setManual] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [slow, setSlow] = useState(false)
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [revising, setRevising] = useState(false)
  const [note, setNote] = useState('')
  const startId = useRef(crypto.randomUUID())
  const acceptId = useRef(crypto.randomUUID())
  const began = useRef(false)

  const start = useMutation({
    mutationFn: () => startPlanDraft({ clientRequestId: startId.current, goalId: goal.id, materialIds, syllabusText }, options),
    onSuccess: (job) => { setJobId(job.id); setStartedAt(Date.now()); setSlow(false) },
  })
  const poll = useQuery({
    queryKey: ['tutor-plan-draft', jobId],
    queryFn: () => getPlanDraft(jobId!, options),
    enabled: jobId !== null && !manual,
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'QUEUED' || status === 'RUNNING' || status === undefined ? 1500 : false
    },
  })
  const job: PlanDraftJob | undefined = poll.data
  const waiting = start.isPending || (jobId !== null && (!job || job.status === 'QUEUED' || job.status === 'RUNNING'))

  useEffect(() => {
    if (began.current) return
    began.current = true
    start.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!waiting || slow) return
    const timer = window.setTimeout(() => setSlow(true), Math.max(0, DRAFT_PATIENCE_MS - (Date.now() - startedAt)))
    return () => window.clearTimeout(timer)
  }, [waiting, slow, startedAt])

  const regenerate = useMutation({
    mutationFn: (text: string) => regeneratePlanDraft(job!.id, { clientRequestId: crypto.randomUUID(), note: text }, options),
    onSuccess: (next) => { setJobId(next.id); setStartedAt(Date.now()); setSlow(false); setRevising(false); setNote('') },
  })
  const accept = useMutation({
    mutationFn: async () => {
      const fresh = await getGoal(goal.id, options)
      return acceptPlanDraft(job!.id, { clientRequestId: acceptId.current, goalRevision: fresh.revision }, options)
    },
    onSuccess: onAccepted,
  })
  const handBuilt = async () => {
    if (jobId && waiting) await cancelPlanDraft(jobId, options).catch(() => undefined)
    setManual(true)
  }
  const retry = () => {
    startId.current = crypto.randomUUID()
    setJobId(null)
    start.reset()
    start.mutate()
  }

  if (manual) return <ManualPlan goal={goal} workspace={workspace} icon={icon} onAccepted={onAccepted} onBack={() => setManual(false)} />

  const startError = start.error ? friendlyError(start.error) : null
  const failed = startError ?? (job?.status === 'FAILED' ? { message: 'Co could not finish your plan this time.', resting: false } : null)
    ?? (job?.status === 'CANCELLED' ? { message: 'That plan was cancelled.', resting: false } : null)
  if (failed) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center" data-testid="plan-failed">
        <TutorArt icon={icon} size={112} state={failed.resting ? 'resting' : 'concerned'} />
        <h1 className="font-extrabold">{failed.resting ? `${tutorName} is resting` : 'Your plan did not finish'}</h1>
        <p role="alert" className="max-w-[420px] text-muted-foreground">
          {failed.resting ? 'Planning with Co is not available right now. You can make your plan by hand and Co can help later.' : failed.message}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" className={primary} onClick={() => setManual(true)}>Make my plan by hand</button>
          {(!failed.resting || startError?.code !== 'DAILY_PLAN_LIMIT') && <button type="button" className={secondary} onClick={retry}>Try again</button>}
          {onSkip && <button type="button" className="ds-button ds-button-ghost" onClick={onSkip}>Not now</button>}
        </div>
      </div>
    )
  }

  if (waiting || !job?.draft) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center" role="status" aria-live="polite">
        <TutorArt icon={icon} size={128} state="thinking" />
        <h1 className="font-extrabold">Making your plan…</h1>
        {slow && <p className="max-w-[420px] text-muted-foreground">This is taking longer than usual. You can keep waiting or make your plan by hand.</p>}
        {(slow || poll.isError) && <button type="button" className={secondary} onClick={handBuilt}>Make my plan by hand</button>}
      </div>
    )
  }

  const totals = draftTotals(job.draft)
  const acceptError = accept.error ? friendlyError(accept.error, 'Your plan could not be saved. Try again.') : null
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3.5">
        <TutorArt icon={icon} size={72} state="celebrating" />
        <div>
          <h1 className="font-extrabold">Here’s your plan</h1>
          <p className="text-muted-foreground">
            {goal.exam?.title ?? goal.title}{goal.exam?.date ? ` · ${formatTutorDate(goal.exam.date)}` : ''}
          </p>
        </div>
      </div>
      <p className="text-muted-foreground" data-testid="plan-totals">{totals.topics} topics · about {totals.label} of study. {tutorName}’s suggestion, so check it looks right.</p>
      {job.draft.phases.map((phase) => (
        <section key={phase.title} className="rounded-[var(--ds-radius)] border border-border bg-card p-4">
          <h2 className="mb-2 font-bold">{phase.title}</h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {phase.topics.map((topic) => (
              <li key={topic.title} className="flex flex-wrap items-baseline justify-between gap-2">
                <strong>{topic.title}</strong>
                <span className="text-sm text-muted-foreground">{topic.estimateMin} min · {BASIS_LABELS[topic.basis]}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {revising ? (
        <div className="flex flex-col gap-3">
          <label className="ds-field">
            <strong>What should change?</strong>
            <textarea className="ds-input" rows={3} maxLength={600} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          {regenerate.error && <p role="alert" className="text-destructive">{friendlyError(regenerate.error).message}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="button" className={primary} disabled={!note.trim() || regenerate.isPending} onClick={() => regenerate.mutate(note.trim())}>
              {regenerate.isPending ? 'Sending…' : 'Make a new plan'}
            </button>
            <button type="button" className="ds-button ds-button-ghost" onClick={() => setRevising(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          {acceptError && <p role="alert" className="text-destructive">{acceptError.message}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="button" className={primary} disabled={accept.isPending} onClick={() => accept.mutate()}>{accept.isPending ? 'Saving…' : 'Start this plan'}</button>
            <button type="button" className={secondary} onClick={() => setRevising(true)}>Change it first</button>
          </div>
        </>
      )}
    </div>
  )
}

interface ManualRow { key: number; title: string; minutes: number }

/** Non-AI fallback: the learner lists their own topics and Co still saves a real plan. */
export function ManualPlan({ goal, workspace, icon, onAccepted, onBack }: {
  goal: LearnerGoalItem
  workspace: Workspace
  icon: string
  onAccepted: (plan: TutorPlan) => void
  onBack: () => void
}) {
  const [title, setTitle] = useState(`${goal.title} plan`)
  const [rows, setRows] = useState<ManualRow[]>([{ key: 1, title: '', minutes: 30 }])
  const nextKey = useRef(2)
  const requestId = useRef(crypto.randomUUID())
  const filled = rows.filter((row) => row.title.trim())
  const save = useMutation({
    mutationFn: () => createManualPlan({
      clientRequestId: requestId.current,
      goalId: goal.id,
      title,
      phases: [{
        title: goal.title,
        topics: filled.map((row) => ({ title: row.title.trim(), estimateMin: row.minutes, priority: 3, basis: 'MANUAL' as const, materialIds: [] })),
      }],
    }, { workspace }),
    onSuccess: onAccepted,
  })
  const update = (key: number, change: Partial<ManualRow>) => setRows((old) => old.map((row) => (row.key === key ? { ...row, ...change } : row)))
  const error = save.error ? friendlyError(save.error, 'Your plan could not be saved. Try again. What you typed is still here.') : null
  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); if (title.trim() && filled.length) save.mutate() }}>
      <div className="flex items-center gap-3.5">
        <TutorArt icon={icon} size={64} />
        <h1 className="font-extrabold">Make your plan</h1>
      </div>
      <p className="text-muted-foreground">List what you need to cover. You can change it any time.</p>
      <label className="ds-field">
        <strong>Plan name</strong>
        <input className="ds-input" value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} required />
      </label>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {rows.map((row, index) => (
          <li key={row.key} className="flex items-end gap-2">
            <label className="ds-field flex-1">
              <strong>Topic {index + 1}</strong>
              <input className="ds-input" value={row.title} maxLength={120} onChange={(event) => update(row.key, { title: event.target.value })} />
            </label>
            <label className="ds-field w-28">
              <strong>Minutes</strong>
              <input className="ds-input" type="number" min={5} max={240} value={row.minutes} onChange={(event) => update(row.key, { minutes: Number(event.target.value) || 30 })} />
            </label>
            {rows.length > 1 && (
              <button type="button" aria-label={`Remove topic ${index + 1}`} className="grid size-11 place-items-center rounded-full border border-border" onClick={() => setRows((old) => old.filter((item) => item.key !== row.key))}>
                <Trash2 size={16} aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
      {rows.length < 30 && (
        <button type="button" className="ds-button ds-button-ghost self-start text-primary" onClick={() => setRows((old) => [...old, { key: nextKey.current++, title: '', minutes: 30 }])}>
          <Plus size={16} aria-hidden /> Add a topic
        </button>
      )}
      {error && <p role="alert" className="text-destructive">{error.message}</p>}
      <div className="flex items-center justify-between gap-3">
        <button type="button" className="ds-button ds-button-ghost" onClick={onBack} disabled={save.isPending}>Back</button>
        <button type="submit" className={primary} disabled={save.isPending || !title.trim() || filled.length === 0}>{save.isPending ? 'Saving…' : 'Save my plan'}</button>
      </div>
    </form>
  )
}
