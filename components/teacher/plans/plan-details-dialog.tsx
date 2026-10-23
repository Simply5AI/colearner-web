'use client'

import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { bandAudience, bandLabel, lessonBands } from '@/lib/api/teaching/lesson-schema'
import { bandSchema, isRevisionConflict, teachingErrorText, type Band, type TeachingPlanDetail } from '@/lib/api/teaching/plans'
import { InlineAlert, NativeSelect } from './fields'
import { plural } from './plan-format'
import { useSetPlan, useTeachingApis } from './use-teaching-apis'

/** F-T2-06: the plan's title, description and target band, with the roster's real band counts and the mismatch note. */
export function PlanDetailsDialog({ open, onOpenChange, plan, onConflict }: { open: boolean; onOpenChange: (open: boolean) => void; plan: TeachingPlanDetail; onConflict: () => void }) {
  const apis = useTeachingApis()
  const setPlan = useSetPlan()
  const uid = useId()
  const [title, setTitle] = useState(plan.title)
  const [description, setDescription] = useState(plan.description ?? '')
  const [band, setBand] = useState<Band>(plan.scope.targetBand)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const eligibility = plan.eligibility
  const known = lessonBands.reduce((total, entry) => total + eligibility.rosterByBand[entry], 0)

  async function save() {
    const name = title.trim()
    if (!name) { setFailure('Give the plan a title.'); return }
    setPending(true); setFailure(null)
    try {
      const body: { expectedRevision: number; title?: string; description?: string; targetBand?: Band } = { expectedRevision: plan.revision }
      if (name !== plan.title && !plan.frozen) body.title = name
      if (description.trim() !== (plan.description ?? '')) body.description = description.trim()
      if (band !== plan.scope.targetBand) body.targetBand = band
      setPlan(await apis.plans.update(plan.id, body)); onOpenChange(false)
    } catch (error) {
      if (isRevisionConflict(error)) { onConflict(); onOpenChange(false) } else setFailure(teachingErrorText(error))
    } finally { setPending(false) }
  }
  return <Dialog open={open} onOpenChange={next => { if (!pending) onOpenChange(next) }}>
    <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl" data-testid="plan-details-dialog">
      <DialogHeader><DialogTitle>Plan details</DialogTitle><DialogDescription>{plan.scope.classLabel} · {plan.scope.subject}{plan.scope.curriculumLabel ? ` · ${plan.scope.curriculumLabel}` : ''}</DialogDescription></DialogHeader>
      <DialogBody>
        <div className="space-y-1.5"><Label htmlFor={`${uid}-t`}>Title</Label><Input id={`${uid}-t`} value={title} onChange={e => setTitle(e.target.value)} maxLength={200} disabled={plan.frozen} aria-describedby={plan.frozen ? `${uid}-frozen` : undefined} />
          {plan.frozen && <p id={`${uid}-frozen`} className="text-xs text-muted-foreground">A published plan keeps its title.</p>}</div>
        <div className="space-y-1.5"><Label htmlFor={`${uid}-d`}>Description</Label><Textarea id={`${uid}-d`} rows={3} value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} /></div>
        <NativeSelect label="Target age band" value={band} onChange={e => setBand(bandSchema.parse(e.target.value))} data-testid="details-band">
          {lessonBands.map(entry => <option key={entry} value={entry}>{bandLabel[entry]} ({bandAudience[entry]})</option>)}
        </NativeSelect>
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm" data-testid="eligibility">
          <p className="font-semibold">Who is in the class</p>
          <ul className="grid gap-x-4 sm:grid-cols-2">{lessonBands.map(entry => <li key={entry}>{bandLabel[entry]}: <strong>{eligibility.rosterByBand[entry]}</strong></li>)}<li>Age not known: <strong>{eligibility.unknownBand}</strong></li></ul>
          <p className="mt-1 text-xs text-muted-foreground">Counted from linked profiles: {plural(known, 'student')} with a known age band. No individual ages are shown. Usual band for this grade: {bandLabel[eligibility.defaultBandForGrade]}.</p>
          {band !== eligibility.targetBand && <p className="mt-1 text-xs" data-testid="details-band-note">The count of learners outside the band updates after you save.</p>}
          {eligibility.note && <p className="mt-1" data-testid="eligibility-note">{eligibility.note}</p>}
          {eligibility.outsideTarget > 0 && <p className="mt-1 text-xs">{plural(eligibility.outsideTarget, 'student')} {eligibility.outsideTarget === 1 ? 'is' : 'are'} outside the current target band. This is a note only; nothing is blocked.</p>}
        </div>
        {failure && <InlineAlert testId="details-failure">{failure}</InlineAlert>}
      </DialogBody>
      <DialogFooter><Button variant="outline" size="lg" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button><Button size="lg" onClick={() => void save()} disabled={pending} data-testid="save-details">{pending ? 'Saving…' : 'Save details'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
