'use client'

import { useRef, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { IntentKey, teachingErrorInfo, teachingErrorText, type PlanTreeNode, type TeachingPlanDetail } from '@/lib/api/teaching/plans'
import { InlineAlert } from './fields'
import { plural } from './plan-format'
import { countTopics, flatten } from './tree-model'
import { useSetPlan, useTeachingApis } from './use-teaching-apis'

const lessonWord = { NONE: 'no lesson', DRAFT: 'lesson draft (not published)', PUBLISHED: 'lesson published' } as const

function Review({ tree }: { tree: PlanTreeNode[] }) {
  return <ol className="space-y-2 text-sm" aria-label="Phases and topics" data-testid="review-tree">{tree.map(phase => <li key={phase.id}>
    <p className="font-semibold">{phase.title || 'Untitled phase'}</p>
    {phase.children.length === 0 ? <p className="ps-4 text-muted-foreground">No topics</p>
      : <ul className="ms-4 list-disc ps-4">{flatten(phase.children).map(topic => <li key={topic.id} className="break-words">{topic.title || 'Untitled topic'} <span className="text-xs text-muted-foreground">· {plural(topic.counts.materials, 'material')}, {lessonWord[topic.counts.lesson]}</span></li>)}</ul>}
  </li>)}</ol>
}

/**
 * F-T2-02 / F-T2-04: review before publishing. Lists the phases and topics, then every readiness issue from the server.
 * An ERROR blocks publishing. The success message appears only after the server answers 200.
 */
export function PublishReviewDialog({ open, onOpenChange, plan, onPublished, onAssign }: {
  open: boolean; onOpenChange: (open: boolean) => void; plan: TeachingPlanDetail; onPublished: (plan: TeachingPlanDetail) => void; onAssign: () => void
}) {
  const apis = useTeachingApis()
  const setPlan = useSetPlan()
  const intent = useRef(new IntentKey())
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [done, setDone] = useState<TeachingPlanDetail | null>(null)
  const errors = plan.readiness.issues.filter(issue => issue.severity === 'ERROR')
  const warnings = plan.readiness.issues.filter(issue => issue.severity === 'WARNING')
  const titleOf = (nodeId: string | null) => nodeId ? flatten(plan.tree).find(node => node.id === nodeId)?.title : null

  async function publish() {
    setPending(true); setFailure(null)
    try {
      const published = await apis.plans.publish(plan.id, plan.revision, intent.current.keyFor({ id: plan.id, revision: plan.revision }))
      intent.current.done(); setPlan(published); setDone(published); onPublished(published)
    } catch (error) {
      const info = teachingErrorInfo(error)
      setFailure(info.status === 422 || info.code === 'PLAN_NOT_READY' ? 'The platform found something that must be fixed first. Close this and check the plan again.' : teachingErrorText(error))
    } finally { setPending(false) }
  }

  const issueList = (list: typeof errors, tone: 'error' | 'warning') => list.length > 0 && <div data-testid={`issues-${tone}`} className="space-y-1">
    <p className="text-sm font-semibold">{tone === 'error' ? `Fix before publishing (${list.length})` : `Worth a look (${list.length})`}</p>
    <ul className="space-y-1 text-sm">{list.map(issue => <li key={`${issue.code}:${issue.nodeId}`}><InlineAlert tone={tone === 'error' ? 'error' : 'warning'}>{titleOf(issue.nodeId) ? <strong>{titleOf(issue.nodeId)}: </strong> : null}{issue.message}</InlineAlert></li>)}</ul>
  </div>

  return <Dialog open={open} onOpenChange={next => { if (!pending) { onOpenChange(next); if (!next) setDone(null) } }}>
    <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl" data-testid="publish-dialog">
      {done ? <>
        <DialogHeader><DialogTitle>Plan published</DialogTitle><DialogDescription>{done.title}</DialogDescription></DialogHeader>
        <DialogBody>
          <p className="flex items-start gap-2 text-sm" role="status" data-testid="publish-success"><CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />The plan is published and its structure is now fixed. Students cannot see it until you assign it to a class.</p>
        </DialogBody>
        <DialogFooter><Button variant="outline" size="lg" onClick={() => { onOpenChange(false); setDone(null) }}>Done</Button><Button size="lg" onClick={() => { onOpenChange(false); setDone(null); onAssign() }} data-testid="assign-after-publish">Assign to class</Button></DialogFooter>
      </> : <>
        <DialogHeader><DialogTitle>Review before publishing</DialogTitle><DialogDescription>{plan.title} · {plural(countTopics(plan.tree), 'topic')}</DialogDescription></DialogHeader>
        <DialogBody>
          <Review tree={plan.tree} />
          {issueList(errors, 'error')}{issueList(warnings, 'warning')}
          {plan.readiness.issues.length === 0 && <p className="text-sm" data-testid="no-issues">Nothing needs fixing.</p>}
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <p className="font-semibold">What publishing does</p>
            <ul className="list-disc ps-5">
              <li>Fixes the phases and topics so students see what you published. You can still add material, write lessons and set due dates.</li>
              <li>Makes draft material available. Lesson drafts stay hidden until you publish each lesson.</li>
              <li>Students see the plan only after you assign it to a class.</li>
            </ul>
          </div>
          {failure && <InlineAlert testId="publish-error">{failure} The plan is unchanged.</InlineAlert>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)} disabled={pending}>Keep editing</Button>
          <Button size="lg" onClick={() => void publish()} disabled={pending || !plan.readiness.publishable || errors.length > 0} data-testid="confirm-publish">{pending ? 'Publishing…' : 'Publish plan'}</Button>
        </DialogFooter>
      </>}
    </DialogContent>
  </Dialog>
}
