'use client'

import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, Plus } from 'lucide-react'
import {
  archiveGoal, createGoal, GOAL_KIND_OPTIONS, getGoal, listGoals, updateExam, updateGoal,
  type LearnerGoalItem, type LearnerGoalKind,
} from '@/lib/api/tutor-loop/goals'
import { tutorLoopClient } from '@/lib/api/tutor-loop/client'
import { formatTutorDate, todayCalendarDate } from '@/lib/tutor-loop/date'
import { friendlyError } from '@/components/tutor-loop/start/errors'
import { PlanStage } from '@/components/tutor-loop/start/plan-draft'
import type { MeWorkspace } from './use-profile'

const kindLabel = (kind: LearnerGoalKind) => GOAL_KIND_OPTIONS.find((item) => item.value === kind)?.label ?? kind
const goalsKey = (workspace: MeWorkspace) => ['tutor-goals', workspace] as const

interface GoalFormValues { kind: LearnerGoalKind; title: string; date: string; passMark: string }

/** Add a goal (exam, assignment, test, something to learn) or edit one the learner owns. */
function GoalForm({ workspace, adult, goal, onDone, onCancel }: {
  workspace: MeWorkspace; adult: boolean; goal?: LearnerGoalItem; onDone: (goal: LearnerGoalItem) => void; onCancel: () => void
}) {
  const options = { workspace }
  const [values, setValues] = useState<GoalFormValues>({
    kind: goal?.kind ?? 'EXAM', title: goal?.title ?? '',
    date: (goal?.exam?.date ?? goal?.dueDate) ?? '', passMark: goal?.exam?.passMarkPercent != null ? String(goal.exam.passMarkPercent) : '',
  })
  const [problem, setProblem] = useState<string | null>(null)
  const request = useRef({ id: crypto.randomUUID(), body: '' })
  const kinds = GOAL_KIND_OPTIONS.filter((item) => !(adult && item.teenOnly))
  const isExam = values.kind === 'EXAM'
  const datedKind = values.kind === 'ASSIGNMENT' || values.kind === 'TEST'
  const save = useMutation({
    mutationFn: async () => {
      const date = values.date || null
      const mark = adult && isExam && values.passMark !== '' ? Number(values.passMark) : null
      if (goal) {
        let current = goal
        if (values.title.trim() !== goal.title || (!goal.exam && date !== goal.dueDate)) {
          current = await updateGoal(goal.id, { revision: goal.revision, title: values.title.trim(), ...(!goal.exam ? { dueDate: date } : {}) }, options)
        }
        if (goal.exam) {
          await updateExam(goal.exam.id, { revision: goal.exam.revision, date, ...(adult ? { passMarkPercent: mark } : {}) }, options)
          current = await getGoal(goal.id, options)
        }
        return current
      }
      const body = JSON.stringify(values)
      if (request.current.body && request.current.body !== body) request.current.id = crypto.randomUUID()
      request.current.body = body
      return createGoal({
        clientRequestId: request.current.id, title: values.title.trim(), kind: values.kind,
        ...(datedKind ? { dueDate: date } : {}),
        ...(isExam ? { exam: { date, passMarkPercent: mark } } : {}),
      }, options)
    },
    onSuccess: onDone,
  })
  const submit = () => {
    if (!values.title.trim()) return setProblem('Enter a name for this goal.')
    if (values.date && values.date < todayCalendarDate()) return setProblem('Choose a date that has not passed.')
    if (values.passMark !== '' && !(Number(values.passMark) >= 0 && Number(values.passMark) <= 100)) return setProblem('Pass mark must be between 0 and 100.')
    setProblem(null)
    save.mutate()
  }
  const error = problem ?? (save.error ? friendlyError(save.error, 'That goal could not be saved. Try again. Your entries are still here.').message : null)
  return (
    <form className="flex flex-col gap-4 rounded-[var(--ds-radius)] border border-border bg-card p-4" onSubmit={(event) => { event.preventDefault(); submit() }}>
      <h2 className="font-bold">{goal ? 'Change this goal' : 'Add a goal'}</h2>
      {!goal && (
        <div role="group" aria-label="Goal type" className="flex flex-wrap gap-2">
          {kinds.map((item) => (
            <button key={item.value} type="button" aria-pressed={values.kind === item.value} onClick={() => setValues({ ...values, kind: item.value })}
              className={`rounded-full border-2 px-4 py-2 font-bold ${values.kind === item.value ? 'border-primary bg-[var(--co-surface)]' : 'border-border'}`}>{item.label}</button>
          ))}
        </div>
      )}
      <label className="ds-field">
        <strong>{isExam ? 'Exam' : values.kind === 'LEARNING' || values.kind === 'SCHOOL' ? 'Goal' : 'Name'}</strong>
        <input className="ds-input" value={values.title} maxLength={200} onChange={(event) => setValues({ ...values, title: event.target.value })} />
      </label>
      {values.kind !== 'LEARNING' && values.kind !== 'SCHOOL' && (
        <label className="ds-field">
          <strong>{isExam ? 'Date' : 'Due date'} <span className="font-normal text-muted-foreground">(optional)</span></strong>
          <input className="ds-input" type="date" value={values.date} onChange={(event) => setValues({ ...values, date: event.target.value })} />
        </label>
      )}
      {adult && isExam && (
        <label className="ds-field">
          <strong>Pass mark (%) <span className="font-normal text-muted-foreground">(optional)</span></strong>
          <input className="ds-input" type="number" min={0} max={100} step=".01" value={values.passMark} onChange={(event) => setValues({ ...values, passMark: event.target.value })} />
        </label>
      )}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="ds-button ds-button-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : goal ? 'Save changes' : 'Add goal'}</button>
        <button type="button" className="ds-button ds-button-ghost" onClick={onCancel} disabled={save.isPending}>Cancel</button>
      </div>
    </form>
  )
}

type Mode = { kind: 'list' } | { kind: 'add' } | { kind: 'edit'; goal: LearnerGoalItem } | { kind: 'plan'; goal: LearnerGoalItem; existing: boolean }

export function GoalsSection({ workspace, adult, tutorIcon, tutorName }: { workspace: MeWorkspace; adult: boolean; tutorIcon: string; tutorName: string }) {
  const client = useQueryClient()
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const goals = useQuery({ queryKey: goalsKey(workspace), queryFn: () => listGoals(false, { workspace }), retry: false })
  const refresh = () => client.invalidateQueries({ queryKey: goalsKey(workspace) })
  const remove = useMutation({
    mutationFn: (goal: LearnerGoalItem) => archiveGoal(goal.id, goal.revision, { workspace }),
    onSuccess: refresh,
  })
  const draftGoalId = mode.kind === 'plan' && mode.existing ? mode.goal.id : null
  const sources = useQuery({
    queryKey: ['tutor-plan-draft-sources', workspace, draftGoalId],
    queryFn: () => tutorLoopClient.plans({ goalId: draftGoalId, ownership: 'OWN' }, { workspace }),
    enabled: draftGoalId !== null,
    retry: false,
  })
  if (mode.kind === 'plan') {
    const back = () => setMode({ kind: 'list' })
    if (draftGoalId && sources.isPending) return <p role="status">Getting your study materials…</p>
    if (draftGoalId && sources.isError) return <div role="alert" className="space-y-3">
      <p>Your study materials could not load.</p>
      <button type="button" className="ds-button ds-button-secondary" onClick={() => void sources.refetch()}>Try again</button>
      <button type="button" className="ds-button ds-button-ghost" onClick={back}>Back to goals</button>
    </div>
    const materialIds = [...new Set((sources.data?.items ?? []).flatMap((plan) =>
      plan.phases.flatMap((phase) => phase.topics.filter((topic) => !topic.archived).flatMap((topic) => topic.materialIds)),
    ))].slice(0, 6)
    return <PlanStage goal={mode.goal} workspace={workspace} icon={tutorIcon} tutorName={tutorName} materialIds={materialIds}
      onAccepted={() => { back(); void refresh() }} onSkip={back} />
  }
  if (mode.kind === 'add' || mode.kind === 'edit') {
    return <GoalForm workspace={workspace} adult={adult} goal={mode.kind === 'edit' ? mode.goal : undefined}
      onDone={(saved) => { void refresh(); setMode(mode.kind === 'add' ? { kind: 'plan', goal: saved, existing: false } : { kind: 'list' }) }} onCancel={() => setMode({ kind: 'list' })} />
  }
  return (
    <div className="flex flex-col gap-4">
      {goals.isPending && <p role="status" className="text-muted-foreground">Loading your goals…</p>}
      {goals.isError && <p role="alert" className="text-destructive">Your goals could not be loaded. <button type="button" className="underline" onClick={() => void goals.refetch()}>Try again</button></p>}
      {goals.data?.items.length === 0 && <p className="text-muted-foreground">You have no goals yet. Add one and {tutorName} will help you plan it.</p>}
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {goals.data?.items.map((goal) => {
          const date = goal.exam?.date ?? goal.dueDate
          const locked = goal.source === 'ASSIGNED'
          return (
            <li key={goal.id} className="flex flex-col gap-3 rounded-[var(--ds-radius)] border border-border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="text-sm text-muted-foreground">{kindLabel(goal.kind)}</span>
                  <strong className="block">{goal.title}</strong>
                  {date && <span className="text-sm text-muted-foreground">{formatTutorDate(date)}{goal.exam?.passMarkPercent != null ? ` · pass mark ${goal.exam.passMarkPercent}%` : ''}</span>}
                </div>
                {locked && <span className="inline-flex items-center gap-1 text-sm text-muted-foreground"><Lock size={14} aria-hidden /> Set by school</span>}
              </div>
              {!locked && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="ds-button ds-button-secondary" onClick={() => setMode({ kind: 'edit', goal })}>Change my goal</button>
                  <button type="button" className="ds-button ds-button-secondary" onClick={() => setMode({ kind: 'plan', goal, existing: true })}>Ask {tutorName} to redo my plan</button>
                  <button type="button" className="ds-button ds-button-ghost" disabled={remove.isPending} onClick={() => remove.mutate(goal)}>Remove</button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {remove.isError && <p role="alert" className="text-destructive">{friendlyError(remove.error, 'That goal could not be removed. Try again.').message}</p>}
      <button type="button" className="ds-button ds-button-primary self-start" onClick={() => setMode({ kind: 'add' })}><Plus size={16} aria-hidden /> Add a goal</button>
    </div>
  )
}
