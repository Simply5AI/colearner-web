'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { LessonVariant, TeachingLessonSummary } from '@/lib/api/teaching/lessons'
import type { LessonBand } from '@/lib/api/teaching/lesson-schema'
import { IntentKey, teachingErrorText, type PlanStatus } from '@/lib/api/teaching/plans'
import { InlineAlert } from './fields'
import { LessonPreviewPane } from './lesson-preview'
import { useTeachingApis } from './use-teaching-apis'

/**
 * F-T3-05: publishing a lesson is its own explicit step. The dialog shows the learner's view, says who can see it and when,
 * and only announces success after the server answers 200. Publishing a lesson never publishes the plan.
 */
export function LessonPublishDialog({ open, onOpenChange, planId, topicId, variant, draft, published, planStatus, targetBand, onPublished }: {
  open: boolean; onOpenChange: (open: boolean) => void; planId: string; topicId: string; variant: LessonVariant
  draft: { version: number; revision: number; title: string }; published: TeachingLessonSummary | null; planStatus: PlanStatus; targetBand: LessonBand
  onPublished: (changed: boolean) => void
}) {
  const apis = useTeachingApis()
  const intent = useRef(new IntentKey())
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const when = planStatus === 'PUBLISHED'
    ? 'This plan is published, so students in classes it is assigned to can read this lesson as soon as you publish it.'
    : 'This plan is still a draft, so students cannot see the lesson yet. They will once you publish the plan and assign it to a class.'

  async function confirm() {
    setPending(true); setFailure(null)
    try {
      const detail = await apis.lessons.publish(planId, topicId, variant, draft.revision, intent.current.keyFor({ planId, topicId, variant, revision: draft.revision }))
      intent.current.done()
      onPublished(detail.changed !== false)
    } catch (error) { setFailure(teachingErrorText(error)) } finally { setPending(false) }
  }

  return <Dialog open={open} onOpenChange={next => { if (!pending) onOpenChange(next) }}>
    <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl" data-testid="lesson-publish-dialog">
      <DialogHeader><DialogTitle>Publish lesson version {draft.version}?</DialogTitle><DialogDescription>{draft.title}</DialogDescription></DialogHeader>
      <DialogBody>
        <InlineAlert tone="info" testId="publish-when">{when}</InlineAlert>
        {published && <p className="text-sm" data-testid="publish-replaces">It replaces published version {published.version} for learners. Version {published.version} is kept in the history and never changes.</p>}
        <p className="text-sm">A published version cannot be edited. To change it later you write a new version.</p>
        {open && <LessonPreviewPane planId={planId} topicId={topicId} version={draft.version} variant={variant} defaultBand={targetBand} label="What students will see" />}
        {failure && <InlineAlert testId="publish-failure">{failure} Your draft is unchanged; you can try again.</InlineAlert>}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" size="lg" onClick={() => onOpenChange(false)} disabled={pending}>Not yet</Button>
        <Button size="lg" onClick={() => void confirm()} disabled={pending} data-testid="confirm-publish-lesson">{pending ? 'Publishing…' : `Publish version ${draft.version}`}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
