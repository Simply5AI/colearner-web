'use client'

import { useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PlanAssignment, UnassignResult } from '@/lib/api/teaching/assignments'
import { IntentKey, isDenied, isUnavailable, teachingErrorText } from '@/lib/api/teaching/plans'
import { InlineAlert, LoadingBlock, MeasuredTag, NativeSelect } from './fields'
import { dateText, fromDateInput, plural, toDateInput } from './plan-format'
import { teachingKeys, usePlanQuery, useTeachingApis, useTeachingContextData } from './use-teaching-apis'

export interface AssignClassPanelProps {
  planId: string
  defaultClassId?: string
  onAssigned: (assignment: PlanAssignment) => void
}
const skippedWord = { NO_ACCOUNT: 'have no CoLearner account yet', POLICY_BLOCKED: 'are blocked by school settings' } as const

/** Counts only. The roster never names a student, and a minor is never shown as "active" before a guardian approves. */
export function RosterSummary({ roster }: { roster: PlanAssignment['roster'] }) {
  const skipped = roster.skipped.filter(entry => entry.count > 0)
  return <div data-testid="roster-summary" className="space-y-1 text-sm">
    <p><MeasuredTag /> {plural(roster.total, 'student')} on the class roster.</p>
    <ul className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
      <li data-testid="roster-enrolled"><strong>{roster.enrolledActive}</strong> enrolled</li>
      <li data-testid="roster-pending"><strong>{roster.pendingGuardian}</strong> waiting for guardian approval</li>
      {roster.alreadyEnrolled > 0 && <li data-testid="roster-already"><strong>{roster.alreadyEnrolled}</strong> already had this plan</li>}
      {skipped.map(entry => <li key={entry.reason} data-testid={`roster-skipped-${entry.reason.toLowerCase()}`}><strong>{entry.count}</strong> not enrolled: {skippedWord[entry.reason]}</li>)}
    </ul>
    {roster.pendingGuardian > 0 && <p className="text-xs text-muted-foreground">Learners under 18 see the plan only after a guardian approves. Nothing here is live for them before that.</p>}
  </div>
}

function AssignmentRow({ planId, assignment, onChanged }: { planId: string; assignment: PlanAssignment; onChanged: (message: string) => void }) {
  const apis = useTeachingApis()
  const [pending, setPending] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [due, setDue] = useState(toDateInput(assignment.dueAt))
  const own = assignment.source === 'TEACHER'
  const roster = assignment.roster

  async function act<T>(name: string, action: () => Promise<T>, done: (result: T) => string) {
    setPending(name); setFailure(null)
    try { const result = await action(); onChanged(done(result)); return true } catch (error) { setFailure(teachingErrorText(error)); return false } finally { setPending(null) }
  }
  return <li className="space-y-3 rounded-xl border border-border p-4" data-testid="assignment-row" data-source={assignment.source}>
    <div className="flex flex-wrap items-center gap-2">
      <p className="font-bold">{assignment.classLabel}</p>
      <span className="rounded-full border border-border px-2 text-xs font-semibold">{own ? 'Assigned by you' : 'Assigned by your school administrator'}</span>
      <span className="text-xs text-muted-foreground">{assignment.dueAt ? `Due ${dateText(assignment.dueAt)}` : 'No due date'}</span>
    </div>
    <RosterSummary roster={roster} />
    {!own && <p className="text-xs text-muted-foreground" data-testid="assignment-readonly">Your school administrator created this assignment, so only they can change or remove it.</p>}
    {own && <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1"><label htmlFor={`due-${assignment.id}`} className="block text-xs font-medium">Due date</label><Input id={`due-${assignment.id}`} type="date" value={due} onChange={e => setDue(e.target.value)} className="h-9 w-44" disabled={pending !== null} /></div>
        <Button variant="outline" size="lg" disabled={pending !== null || due === toDateInput(assignment.dueAt)} onClick={() => void act('due', () => apis.assignments.setDueAt(planId, assignment.id, fromDateInput(due)), () => 'Due date updated.')}>{due ? 'Save date' : 'Clear date'}</Button>
        <Button variant="outline" size="lg" disabled={pending !== null} onClick={() => void act('sync', () => apis.assignments.sync(planId, assignment.id), next => `Checked the roster: ${plural(next.roster.enrolledActive + next.roster.pendingGuardian, 'learner')} now enrolled or waiting.`)} data-testid="sync-assignment"><RefreshCw aria-hidden="true" />{pending === 'sync' ? 'Checking…' : 'Add new students'}</Button>
        <Button variant="destructive" size="lg" disabled={pending !== null} onClick={() => setConfirm(true)} data-testid="unassign">Unassign</Button>
      </div>
      {confirm && <div role="alertdialog" aria-label={`Unassign ${assignment.classLabel}`} data-testid="unassign-confirm" className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
        <p className="font-semibold">Unassign this plan from {assignment.classLabel}?</p>
        <ul className="list-disc space-y-1 ps-5">
          <li data-testid="unassign-revoked"><strong>Revoked:</strong> {plural(roster.pendingGuardian, 'learner')} waiting for guardian approval, and any of the {roster.enrolledActive} enrolled {roster.enrolledActive === 1 ? 'learner' : 'learners'} who have not started anything.</li>
          <li data-testid="unassign-retained"><strong>Kept:</strong> enrolled learners who have started learning keep their work and stay enrolled. Learners who joined with a code or through another class are not touched.</li>
        </ul>
        <p className="text-xs text-muted-foreground">Nothing is deleted. The exact numbers are shown right after.</p>
        <div className="flex gap-2">
          <Button variant="destructive" size="lg" disabled={pending !== null} data-testid="confirm-unassign" onClick={() => void act('remove', () => apis.assignments.unassign(planId, assignment.id), (result: UnassignResult) => result.removed ? `Unassigned. ${plural(result.revoked, 'enrolment')} revoked and ${result.retained} kept because learners had started.` : 'This class was already unassigned.').then(ok => { if (ok) setConfirm(false) })}>{pending === 'remove' ? 'Unassigning…' : 'Unassign'}</Button>
          <Button variant="outline" size="lg" onClick={() => setConfirm(false)}>Keep it assigned</Button>
        </div>
      </div>}
    </div>}
    {failure && <InlineAlert testId="assignment-failure">{failure}</InlineAlert>}
  </li>
}

/**
 * Section 6.10: assign an own PUBLISHED plan to a class the teacher actively teaches for that subject. The server decides who
 * may do what; this panel shows its answers, including every refusal reason. A retry of the same request reuses one key.
 */
export function AssignClassPanel({ planId, defaultClassId, onAssigned }: AssignClassPanelProps) {
  const apis = useTeachingApis()
  const client = useQueryClient()
  const plan = usePlanQuery(planId)
  const context = useTeachingContextData()
  const list = useQuery({ queryKey: teachingKeys.assignments(apis.schoolId, planId), queryFn: () => apis.assignments.list(planId), retry: false, staleTime: 0, refetchOnWindowFocus: false })
  const intent = useRef(new IntentKey())
  const [classChoice, setClassChoice] = useState<string | null>(null)
  const [due, setDue] = useState('')
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [latest, setLatest] = useState<PlanAssignment | null>(null)

  const assignedIds = useMemo(() => new Set((list.data ?? []).map(entry => entry.classId)), [list.data])
  const subject = plan.data?.scope.subject
  const eligible = useMemo(() => (context.data?.classes ?? []).filter(entry => entry.subjects.some(item => item.subject === subject) && !assignedIds.has(entry.classId)), [context.data, subject, assignedIds])

  const failed = plan.error ?? list.error ?? context.error
  if (plan.isPending || list.isPending || context.isPending) {
    if (!failed) return <LoadingBlock label="Loading assignments" />
  }
  if (failed) {
    return isDenied(failed)
      ? <InlineAlert testId="assign-denied">This plan was not found, or you no longer have access to assign it.</InlineAlert>
      : <div className="space-y-3" data-testid="assign-error"><InlineAlert>{isUnavailable(failed) ? 'Assignments are unavailable right now. Nothing was changed; try again.' : teachingErrorText(failed)}</InlineAlert>
        <Button variant="outline" onClick={() => { void plan.refetch(); void list.refetch(); void context.refetch() }}>Retry</Button></div>
  }
  const detail = plan.data!
  const features = context.data!.features
  const chosen = eligible.find(entry => entry.classId === classChoice) ?? eligible.find(entry => entry.classId === defaultClassId) ?? eligible.find(entry => entry.classId === detail.scope.classId) ?? eligible[0]
  const refresh = () => { void client.invalidateQueries({ queryKey: teachingKeys.assignments(apis.schoolId, planId) }); void client.invalidateQueries({ queryKey: teachingKeys.plan(apis.schoolId, planId) }); void client.invalidateQueries({ queryKey: teachingKeys.plans(apis.schoolId) }) }

  async function assign() {
    if (!chosen || pending) return
    const body = { classId: chosen.classId, dueAt: fromDateInput(due) }
    setPending(true); setFailure(null); setNotice(null)
    try {
      const created = await apis.assignments.create(planId, body, intent.current.keyFor(body))
      intent.current.done(); setLatest(created); setDue('')
      setNotice(created.changed === false ? `${created.classLabel} already had this plan. Nothing was changed.` : `Assigned to ${created.classLabel}.`)
      refresh(); onAssigned(created)
    } catch (error) { setFailure(teachingErrorText(error)) } finally { setPending(false) }
  }

  const blocked = detail.status !== 'PUBLISHED'
    ? 'Publish the plan before assigning it to a class. Students never see a draft.'
    : !features.studentAssignment.available ? (features.studentAssignment.reason ?? 'Assigning plans to a class is not available for your school yet.') : null

  return <section aria-label="Assign to class" className="space-y-4" data-testid="assign-panel">
    {blocked && <InlineAlert tone="info" testId="assign-blocked">{blocked}</InlineAlert>}
    {!blocked && (eligible.length === 0
      ? <InlineAlert tone="info" testId="assign-no-class">{assignedIds.size > 0 ? 'This plan is assigned to every class you teach this subject in.' : `You do not teach ${subject} to any other class, so there is no class to assign this plan to.`}</InlineAlert>
      : <form className="space-y-3 rounded-xl border border-border p-4" onSubmit={e => { e.preventDefault(); void assign() }} aria-busy={pending} data-testid="assign-form">
        <div className="grid gap-3 sm:grid-cols-2">
          <NativeSelect label="Class" value={chosen?.classId ?? ''} onChange={e => setClassChoice(e.target.value)} data-testid="assign-class" hint={`Classes you teach ${subject} to.`}>{eligible.map(entry => <option key={entry.classId} value={entry.classId}>{entry.label}</option>)}</NativeSelect>
          <div className="space-y-1.5"><label htmlFor="assign-due" className="block text-sm font-medium">Due date (optional)</label><Input id="assign-due" type="date" value={due} onChange={e => setDue(e.target.value)} className="h-9" /></div>
        </div>
        {chosen && <p className="flex items-center gap-2 text-sm"><Users aria-hidden="true" className="size-4" /><MeasuredTag /> {plural(chosen.rosterCount, 'student')} on this class roster. Learners under 18 start as waiting for guardian approval.</p>}
        <Button type="submit" size="lg" disabled={pending || !chosen} data-testid="assign-submit">{pending ? 'Assigning…' : 'Assign to class'}</Button>
      </form>)}
    {failure && <InlineAlert testId="assign-failure">{failure} Nothing was assigned twice; you can try again.</InlineAlert>}
    <p role="status" aria-live="polite" data-testid="assign-notice" className={notice ? 'text-sm font-medium' : 'sr-only'}>{notice ?? ''}</p>
    {latest && <div data-testid="assign-latest" className="rounded-xl border border-primary/30 bg-primary/5 p-4"><p className="mb-2 font-semibold">{latest.classLabel}</p><RosterSummary roster={latest.roster} /></div>}

    <section aria-label="Current assignments" className="space-y-2">
      <h3 className="text-sm font-bold">Assigned classes</h3>
      {(list.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground" data-testid="assign-empty">This plan is not assigned to any class yet.</p>
        : <ul className="space-y-3">{(list.data ?? []).map(entry => <AssignmentRow key={entry.id} planId={planId} assignment={entry} onChanged={message => { setNotice(message); setLatest(null); refresh() }} />)}</ul>}
    </section>
  </section>
}
