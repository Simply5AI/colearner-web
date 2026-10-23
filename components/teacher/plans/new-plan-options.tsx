'use client'

import { useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FileText, Library, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { bandAudience, bandLabel } from '@/lib/api/teaching/lesson-schema'
import {
  IntentKey, bandSchema, checkOutline, defaultBandForGrade, isUnavailable, teachingErrorText,
  type Band, type CreatePlanInput, type NewPlanSource, type TeachingPlanDetail,
} from '@/lib/api/teaching/plans'
import { cn } from '@/lib/utils'
import { FieldHint, InlineAlert, LoadingBlock, NativeSelect, UnavailableNote } from './fields'
import { teachingKeys, useTeachingApis, useTeachingContextData } from './use-teaching-apis'

export interface NewPlanOptionsProps {
  onCreated: (plan: TeachingPlanDetail) => void
  defaultClassId?: string
}
type Way = 'SCRATCH' | 'SOURCE'
type Source = 'CURRICULUM' | 'OUTLINE'

/**
 * T2 / F-T2-03 / F-T8-03: three ways to start a plan. Co drafting is shown disabled with the server's reason. The title, class,
 * subject, band and outline stay on screen when a request fails, and a retry reuses one Idempotency-Key so it never makes a second plan.
 */
export function NewPlanOptions({ onCreated, defaultClassId }: NewPlanOptionsProps) {
  const apis = useTeachingApis()
  const client = useQueryClient()
  const context = useTeachingContextData()
  const uid = useId()
  const intent = useRef(new IntentKey())
  const [way, setWay] = useState<Way>('SCRATCH')
  const [source, setSource] = useState<Source>('OUTLINE')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [classChoice, setClassChoice] = useState<string | null>(defaultClassId ?? null)
  const [subjectChoice, setSubjectChoice] = useState<string | null>(null)
  const [bandChoice, setBandChoice] = useState<Band | null>(null)
  const [outline, setOutline] = useState('')
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [outlineError, setOutlineError] = useState<string | null>(null)

  const classes = useMemo(() => context.data?.classes ?? [], [context.data])
  const selectedClass = classes.find(entry => entry.classId === classChoice) ?? classes.find(entry => entry.classId === defaultClassId) ?? classes[0]
  const subject = selectedClass?.subjects.find(entry => entry.subject === subjectChoice) ?? selectedClass?.subjects[0]
  const suggested = selectedClass ? defaultBandForGrade(selectedClass.grade) : '10-13'
  const band: Band = bandChoice ?? suggested

  if (context.isPending) return <LoadingBlock label="Loading your classes" />
  if (context.error) return <div data-testid="new-plan-error"><InlineAlert>{isUnavailable(context.error) ? 'The teaching workspace is unavailable right now. Try again in a moment.' : teachingErrorText(context.error)}</InlineAlert><Button className="mt-3" variant="outline" onClick={() => void context.refetch()}>Retry</Button></div>
  const features = context.data.features
  if (classes.length === 0 || !selectedClass || !subject) {
    return <div data-testid="new-plan-no-class" className="rounded-xl border border-dashed border-border p-4 text-sm">
      <p className="font-semibold">No class and subject is assigned to you yet.</p>
      <p className="mt-1 text-muted-foreground">Plans belong to a class and subject you teach. Ask your school administrator to assign you, then come back.</p>
    </div>
  }

  const draftState = features.aiDrafting.draftPlan
  const coReason = draftState.status === 'UNAVAILABLE' ? draftState.reason : 'Co drafting for teachers is not available yet.'
  const curriculumReason = !features.curriculumSource.available
    ? (features.curriculumSource.reason ?? 'The school curriculum is not loaded yet.')
    : subject.curriculumStatus === 'NOT_LOADED' ? 'The school curriculum is not loaded for this subject yet.'
      : subject.curriculumStatus === 'UNMAPPED' || !subject.curriculumSubjectId ? 'This subject is not linked to a school curriculum subject for this class.' : null
  const curriculumOk = curriculumReason === null
  const effectiveSource: Source = source === 'CURRICULUM' && !curriculumOk ? 'OUTLINE' : source

  function buildSource(): NewPlanSource {
    if (way === 'SCRATCH') return { kind: 'SCRATCH' }
    if (effectiveSource === 'CURRICULUM' && subject?.curriculumSubjectId) return { kind: 'CURRICULUM', curriculumSubjectId: subject.curriculumSubjectId }
    return { kind: 'OUTLINE', text: outline }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending || !selectedClass || !subject) return
    const name = title.trim()
    if (!name) { setFailure('Give the plan a title.'); return }
    if (name.length > 200) { setFailure('The title can be at most 200 characters.'); return }
    const chosen = buildSource()
    if (chosen.kind === 'OUTLINE') {
      const problem = checkOutline(chosen.text)
      if (problem) { setOutlineError(`Line ${problem.line}: ${problem.message}`); setFailure(null); return }
    }
    setOutlineError(null)
    setFailure(null)
    const body: CreatePlanInput = {
      title: name, ...(description.trim() ? { description: description.trim() } : {}),
      classId: selectedClass.classId, subject: subject.subject, targetBand: bandSchema.parse(band), source: chosen,
    }
    setPending(true)
    try {
      const plan = await apis.plans.create(body, intent.current.keyFor(body))
      intent.current.done()
      void client.invalidateQueries({ queryKey: teachingKeys.plans(apis.schoolId) })
      client.setQueryData(teachingKeys.plan(apis.schoolId, plan.id), plan)
      onCreated(plan)
    } catch (error) {
      setFailure(teachingErrorText(error))
    } finally {
      setPending(false)
    }
  }

  const tile = (active: boolean) => cn('flex min-h-24 cursor-pointer flex-col gap-1 rounded-xl border p-3 text-start transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50', active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50')
  const mismatch = band !== suggested

  return <form onSubmit={e => void submit(e)} className="space-y-5" aria-busy={pending} data-testid="new-plan-form" noValidate>
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-semibold">How do you want to start?</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={tile(way === 'SCRATCH')} data-testid="tile-scratch">
          <input type="radio" name={`${uid}-way`} className="sr-only" checked={way === 'SCRATCH'} onChange={() => setWay('SCRATCH')} />
          <span className="flex items-center gap-2 font-semibold"><FileText aria-hidden="true" className="size-4" />From scratch</span>
          <span className="text-xs text-muted-foreground">Start with an empty plan and add phases and topics yourself.</span>
        </label>
        <label className={tile(way === 'SOURCE')} data-testid="tile-source">
          <input type="radio" name={`${uid}-way`} className="sr-only" checked={way === 'SOURCE'} onChange={() => setWay('SOURCE')} />
          <span className="flex items-center gap-2 font-semibold"><Library aria-hidden="true" className="size-4" />From the school curriculum or an outline</span>
          <span className="text-xs text-muted-foreground">Use the loaded curriculum, or type an outline. You review everything before publishing.</span>
        </label>
        <div className={cn(tile(false), 'cursor-not-allowed border-dashed opacity-80')} data-testid="tile-co" aria-disabled="true">
          <span className="flex items-center gap-2 font-semibold"><Sparkles aria-hidden="true" className="size-4" />Let Co draft it</span>
          <span className="text-xs font-semibold" data-testid="co-unavailable">Unavailable</span>
          <span className="text-xs text-muted-foreground" data-testid="co-reason">{coReason}</span>
        </div>
      </div>
    </fieldset>

    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${uid}-title`}>Plan title</Label>
        <Input id={`${uid}-title`} value={title} onChange={e => setTitle(e.target.value)} maxLength={200} required aria-required="true" placeholder="For example, Grade 6 Fractions" autoComplete="off" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${uid}-description`}>Description (optional)</Label>
        <Textarea id={`${uid}-description`} value={description} onChange={e => setDescription(e.target.value)} rows={2} maxLength={2000} />
      </div>
      <NativeSelect label="Class" value={selectedClass.classId} onChange={e => { setClassChoice(e.target.value); setSubjectChoice(null); setBandChoice(null) }} data-testid="field-class">
        {classes.map(entry => <option key={entry.classId} value={entry.classId}>{entry.label}</option>)}
      </NativeSelect>
      <NativeSelect label="Subject" value={subject.subject} onChange={e => setSubjectChoice(e.target.value)} data-testid="field-subject">
        {selectedClass.subjects.map(entry => <option key={entry.subject} value={entry.subject}>{entry.subject}</option>)}
      </NativeSelect>
      <div className="space-y-2 sm:col-span-2">
        <NativeSelect label="Target age band" value={band} onChange={e => setBandChoice(bandSchema.parse(e.target.value))} data-testid="field-band"
          hint={`Lessons are written and checked for this band. Class ${selectedClass.grade} usually suits ${bandLabel[suggested]} (${bandAudience[suggested]}).`}>
          {(['6-9', '10-13', '14-17'] as const).map(entry => <option key={entry} value={entry}>{bandLabel[entry]} ({bandAudience[entry]})</option>)}
        </NativeSelect>
        <div data-testid="band-preview" className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
          <p><span className="font-semibold">{selectedClass.label}</span> has {selectedClass.rosterCount} {selectedClass.rosterCount === 1 ? 'student' : 'students'} on its roster.</p>
          {mismatch
            ? <p className="mt-1" data-testid="band-mismatch">You chose {bandLabel[band]}, but Class {selectedClass.grade} usually suits {bandLabel[suggested]}. This is only a note: nothing is blocked, and you can change the band later.</p>
            : <p className="mt-1">This matches the usual band for Class {selectedClass.grade}.</p>}
          <p className="mt-1 text-muted-foreground">How many learners fall in each band is counted from linked profiles and shown on the plan after it is created.</p>
        </div>
      </div>
    </div>

    {way === 'SOURCE' && <fieldset className="space-y-3 rounded-xl border border-border p-4" data-testid="source-options">
      <legend className="px-1 text-sm font-semibold">Where should the outline come from?</legend>
      <label className="flex items-start gap-2 text-sm">
        <input type="radio" name={`${uid}-source`} checked={effectiveSource === 'CURRICULUM'} disabled={!curriculumOk} onChange={() => setSource('CURRICULUM')} className="mt-1" data-testid="source-curriculum" />
        <span><span className="font-semibold">The school curriculum for {subject.subject}</span>
          {curriculumOk ? <span className="block text-xs text-muted-foreground">{subject.curriculumStatus === 'PARTIAL' ? 'Only part of this subject is loaded. Nothing is invented.' : 'Chapters become phases and topics become plan topics.'}</span>
            : <span className="block text-xs text-muted-foreground" data-testid="curriculum-reason">Unavailable. {curriculumReason}</span>}</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="radio" name={`${uid}-source`} checked={effectiveSource === 'OUTLINE'} onChange={() => setSource('OUTLINE')} className="mt-1" data-testid="source-outline" />
        <span><span className="font-semibold">A typed outline</span><span className="block text-xs text-muted-foreground">One phase per line, then indent its topics (or start them with a dash).</span></span>
      </label>
      {effectiveSource === 'OUTLINE' && <div className="space-y-1.5">
        <Label htmlFor={`${uid}-outline`}>Outline</Label>
        <Textarea id={`${uid}-outline`} value={outline} onChange={e => { setOutline(e.target.value); setOutlineError(null) }} rows={8} maxLength={8000} spellCheck
          aria-invalid={outlineError ? true : undefined} aria-describedby={`${uid}-outline-hint`} placeholder={'Fractions\n  - Parts of a whole\n  - Adding fractions\nDecimals\n  - Tenths and hundredths'} className="font-mono" />
        <FieldHint id={`${uid}-outline-hint`}>Up to 20 phases, 200 topics and 8000 characters. Uploading a syllabus file is not available yet: {features.syllabusUpload.reason}</FieldHint>
        {outlineError && <p role="alert" data-testid="outline-error" className="text-xs font-semibold text-destructive">{outlineError}</p>}
      </div>}
      {!curriculumOk && <UnavailableNote reason={features.syllabusUpload.reason} label="Syllabus upload is unavailable" />}
    </fieldset>}

    {failure && <InlineAlert testId="new-plan-failure">{failure}</InlineAlert>}
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" size="lg" disabled={pending} data-testid="create-plan">{pending ? 'Creating…' : 'Create plan'}</Button>
      <p className="text-xs text-muted-foreground">Every plan starts as a draft. Students cannot see it until you publish and assign it.</p>
    </div>
  </form>
}
