'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Archive, ArrowLeft, Pencil, Rocket, Undo2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  IntentKey, isDenied, isRevisionConflict, isUnavailable, teachingErrorInfo, teachingErrorText, toTreeDto, type TeachingPlanDetail,
} from '@/lib/api/teaching/plans'
import { AssignClassPanel } from './assign-class-panel'
import { InlineAlert, LoadingBlock, MeasuredTag } from './fields'
import { PlanDetailsDialog } from './plan-details-dialog'
import { bandText, dateText, plural } from './plan-format'
import { PlanStatusChip } from './plan-status-chip'
import { PlanTreePane, type TreeChange } from './plan-tree-pane'
import { PublishReviewDialog } from './publish-review-dialog'
import { TopicWorkspacePane } from './topic-workspace'
import { findNode } from './tree-model'
import { teachingKeys, usePlanQuery, useSetPlan, useTeachingApis } from './use-teaching-apis'

const visibilityText = {
  NOT_PUBLISHED: 'Not published: students cannot see this plan.',
  PUBLISHED_NOT_ASSIGNED: 'Published, but not assigned to a class yet: students cannot see it until you assign it.',
  ASSIGNED_PENDING_APPROVAL: 'Assigned. Students appear once their guardians approve.',
  ASSIGNED: 'Assigned: students in the class can see this plan.',
} as const

export interface PlanWorkspaceProps {
  planId: string
  initialTopicId?: string | null
  /** Open the Assign to class panel on arrival (`?assign=1`). */
  assignOpen?: boolean
  /** Where selecting a topic points the address bar. Defaults to `/teacher/plans/:id?topic=`. The dev harness overrides it. */
  topicUrl?: (topicId: string) => string
}

/** T3: the two-pane plan editor (tree on the left, the selected topic on the right) with the plan's lifecycle controls. */
export function PlanWorkspace({ planId, initialTopicId = null, assignOpen = false, topicUrl }: PlanWorkspaceProps) {
  const router = useRouter()
  const apis = useTeachingApis()
  const client = useQueryClient()
  const setPlan = useSetPlan()
  const query = usePlanQuery(planId)
  const [selected, setSelected] = useState<string | null>(initialTopicId)
  const [busy, setBusy] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [failure, setFailure] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [assigning, setAssigning] = useState(assignOpen)
  const [confirm, setConfirm] = useState<'unpublish' | 'archive' | null>(null)
  const [lifecycleBusy, setLifecycleBusy] = useState(false)
  const intents = useRef({ unpublish: new IntentKey(), archive: new IntentKey() })

  if (query.isPending) return <LoadingBlock label="Loading the plan" />
  if (query.error) {
    return isDenied(query.error)
      ? <div className="space-y-3" data-testid="plan-denied"><InlineAlert>This plan was not found, or you no longer have access to it.</InlineAlert><Button asChild variant="outline" size="lg"><Link href="/teacher/plans"><ArrowLeft aria-hidden="true" />Back to plans</Link></Button></div>
      : <div className="space-y-3" data-testid="plan-error"><InlineAlert>{isUnavailable(query.error) ? 'The teaching workspace is unavailable right now. Your plan is safe; try again.' : teachingErrorText(query.error)}</InlineAlert><Button variant="outline" onClick={() => void query.refetch()}>Retry</Button></div>
  }
  const plan: TeachingPlanDetail = query.data
  const editable = plan.status === 'DRAFT'
  const planKey = teachingKeys.plan(apis.schoolId, planId)
  const selectedNode = selected ? findNode(plan.tree, selected) : null
  const lockedReason = plan.status === 'PUBLISHED'
    ? 'This plan is published, so its phases and topics are fixed. Students see exactly what you published. You can still add material, write lessons and set due dates. To restructure it, take it back to a draft (possible only while no student is enrolled).'
    : plan.status === 'ARCHIVED' ? 'This plan is archived and read-only.' : null

  const select = (id: string) => {
    setSelected(id)
    router.replace(topicUrl ? topicUrl(id) : `/teacher/plans/${encodeURIComponent(planId)}?topic=${encodeURIComponent(id)}`, { scroll: false })
  }
  const reload = () => { setConflict(false); setFailure(null); void query.refetch() }
  const handleFailure = (error: unknown, restored?: string) => {
    if (isRevisionConflict(error)) { setConflict(true); setFailure(null) } else setFailure(`${teachingErrorText(error)}${restored ? ` ${restored}` : ''}`)
  }

  async function applyTree(change: TreeChange) {
    if (busy) return
    const previous = plan
    client.setQueryData(planKey, { ...plan, tree: change.tree })
    setBusy(true); setFailure(null)
    try {
      const saved = await apis.plans.putTree(planId, { expectedRevision: plan.revision, tree: toTreeDto(change.tree), ...(change.confirmRemoveNodeIds && change.confirmRemoveNodeIds.length > 0 ? { confirmRemoveNodeIds: change.confirmRemoveNodeIds } : {}) })
      setPlan(saved)
      setAnnounce(`${change.announce ?? 'Saved'} The change is saved.`)
      // Select a newly added node only once the platform has saved it: the topic workspace is fetched from the server and a node
      // that is still only in the optimistic tree would be a 404 that stays cached.
      if (change.selectId) setSelected(change.selectId)
      else if (selected && !findNode(saved.tree, selected)) setSelected(null)
      if (change.selectId) router.replace(topicUrl ? topicUrl(change.selectId) : `/teacher/plans/${encodeURIComponent(planId)}?topic=${encodeURIComponent(change.selectId)}`, { scroll: false })
    } catch (error) {
      client.setQueryData(planKey, previous)
      setAnnounce('The change could not be saved and was undone.')
      handleFailure(error, 'Your previous order was restored.')
    } finally { setBusy(false) }
  }

  async function lifecycle(kind: 'unpublish' | 'archive') {
    setLifecycleBusy(true); setFailure(null)
    try {
      const body = { id: plan.id, revision: plan.revision }
      const result = kind === 'unpublish' ? await apis.plans.unpublish(plan.id, plan.revision, intents.current.unpublish.keyFor(body)) : await apis.plans.archive(plan.id, plan.revision, intents.current.archive.keyFor(body))
      intents.current[kind].done(); setPlan(result); setConfirm(null)
      setAnnounce(kind === 'unpublish' ? 'The plan is a draft again.' : 'The plan is archived.')
    } catch (error) {
      const info = teachingErrorInfo(error)
      if (info.code === 'PLAN_IN_USE' || (info.status === 409 && info.code === null)) setFailure('Students are enrolled, so this plan cannot be taken back to a draft or archived. Unassign the classes first; learners who have started keep their work, so it may stay in use.')
      else handleFailure(error)
      setConfirm(null)
    } finally { setLifecycleBusy(false) }
  }

  return <div className="space-y-5" data-testid="plan-workspace" data-plan-status={plan.status}>
    <Button asChild variant="ghost" size="lg" className="-ms-2"><Link href="/teacher/plans"><ArrowLeft aria-hidden="true" className="rtl:rotate-180" />All plans</Link></Button>
    <header className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2"><h2 className="break-words text-xl font-extrabold" data-testid="plan-title">{plan.title}</h2><PlanStatusChip status={plan.status} /></div>
          <ul aria-label="Plan scope" className="flex flex-wrap gap-2 text-xs" data-testid="plan-chips">
            {[plan.scope.classLabel, plan.scope.subject, plan.scope.curriculumLabel, bandText(plan.scope.targetBand)].filter(Boolean).map(chip => <li key={chip} className="rounded-full border border-border px-2 py-0.5">{chip}</li>)}
            <li className="rounded-full border border-border px-2 py-0.5">Written by you</li>
          </ul>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="lg" onClick={() => setDetailsOpen(true)} data-testid="edit-details"><Pencil aria-hidden="true" />Details</Button>
          {plan.status === 'DRAFT' && <Button size="lg" onClick={() => setReviewOpen(true)} data-testid="review-publish"><Rocket aria-hidden="true" />Review and publish</Button>}
          {plan.status === 'PUBLISHED' && <Button size="lg" onClick={() => setAssigning(true)} data-testid="open-assign"><Users aria-hidden="true" />Assign to class</Button>}
          {plan.status === 'PUBLISHED' && <Button variant="outline" size="lg" onClick={() => setConfirm('unpublish')} data-testid="unpublish"><Undo2 aria-hidden="true" />Back to draft</Button>}
          {plan.status !== 'ARCHIVED' && <Button variant="outline" size="lg" onClick={() => setConfirm('archive')} data-testid="archive"><Archive aria-hidden="true" />Archive</Button>}
        </div>
      </div>
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        <div><dt className="inline text-muted-foreground">Students </dt><dd className="inline"><MeasuredTag /> {plan.students.enrolledActive} of {plural(plan.students.roster, 'student')}{plan.students.pendingGuardian > 0 ? `, ${plan.students.pendingGuardian} waiting for approval` : ''}</dd></div>
        <div><dt className="inline text-muted-foreground">Progress </dt><dd className="inline"><MeasuredTag /> {plan.averageProgress === null ? 'Not enough data yet' : `${Math.round(plan.averageProgress)}% average`}</dd></div>
        <div><dt className="inline text-muted-foreground">Updated </dt><dd className="inline">{dateText(plan.updatedAt)}{plan.publishedAt ? ` · published ${dateText(plan.publishedAt)}` : ''}</dd></div>
      </dl>
      <p className="text-sm" data-testid="student-visibility" data-state={plan.studentVisibility.state}>{visibilityText[plan.studentVisibility.state]}</p>
    </header>

    {conflict && <InlineAlert tone="warning" testId="plan-conflict"><p className="font-semibold">This plan changed somewhere else, for example in another tab.</p><Button className="mt-2" variant="outline" size="lg" onClick={reload}>Reload the latest</Button></InlineAlert>}
    {failure && <InlineAlert testId="plan-failure">{failure}</InlineAlert>}
    <p role="status" aria-live="polite" className="sr-only" data-testid="tree-announce">{announce}</p>

    <div className="grid gap-5 lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
      <div className="min-w-0 rounded-xl border border-border bg-card p-3">
        <h3 className="mb-2 text-sm font-bold">Phases and topics</h3>
        <PlanTreePane tree={plan.tree} selectedId={selected} onSelect={select} editable={editable} lockedReason={lockedReason} busy={busy} onChange={change => void applyTree(change)} />
      </div>
      <div className="min-w-0 rounded-xl border border-border bg-card p-4" data-testid="topic-pane-host">
        {selectedNode && selectedNode.kind !== 'module'
          ? <TopicWorkspacePane key={selectedNode.id} planId={planId} topicId={selectedNode.id} targetBand={plan.scope.targetBand} />
          : selectedNode ? <div data-testid="phase-pane" className="space-y-2"><h2 className="break-words text-xl font-extrabold">{selectedNode.title}</h2><p className="text-sm text-muted-foreground">This is a phase with {plural(selectedNode.children.length, 'topic')}. Choose a topic to add material, write a lesson or set a due date.</p></div>
            : <p className="text-sm text-muted-foreground" data-testid="no-topic-selected">{plan.tree.length === 0 ? 'Add a phase and a topic to start building this plan.' : 'Choose a topic on the left to add material, write a lesson or set a due date.'}</p>}
      </div>
    </div>

    <PublishReviewDialog open={reviewOpen} onOpenChange={setReviewOpen} plan={plan} onPublished={() => setAnnounce('The plan is published.')} onAssign={() => setAssigning(true)} />
    {detailsOpen && <PlanDetailsDialog key={plan.revision} open onOpenChange={setDetailsOpen} plan={plan} onConflict={() => setConflict(true)} />}
    <Dialog open={assigning} onOpenChange={setAssigning}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl" data-testid="assign-dialog">
        <DialogHeader><DialogTitle>Assign to class</DialogTitle><DialogDescription>Students see the plan once it is assigned. Learners under 18 also need a guardian to approve.</DialogDescription></DialogHeader>
        <DialogBody>{assigning && <AssignClassPanel planId={planId} onAssigned={() => setAnnounce('The plan is assigned.')} />}</DialogBody>
      </DialogContent>
    </Dialog>
    <Dialog open={confirm !== null} onOpenChange={open => { if (!open && !lifecycleBusy) setConfirm(null) }}>
      <DialogContent data-testid="lifecycle-dialog">
        <DialogHeader><DialogTitle>{confirm === 'archive' ? 'Archive this plan?' : 'Take this plan back to a draft?'}</DialogTitle>
          <DialogDescription>{confirm === 'archive' ? 'Archived plans are hidden from students and become read-only. This is refused while any student is enrolled.' : 'The plan stops being visible to students and its structure can be edited again. This is refused while any student is enrolled or any class is assigned.'}</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" size="lg" onClick={() => setConfirm(null)} disabled={lifecycleBusy}>Cancel</Button><Button variant={confirm === 'archive' ? 'destructive' : 'default'} size="lg" disabled={lifecycleBusy} data-testid="confirm-lifecycle" onClick={() => confirm && void lifecycle(confirm)}>{lifecycleBusy ? 'Working…' : confirm === 'archive' ? 'Archive plan' : 'Back to draft'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
}
