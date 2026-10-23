'use client'

import { useEffect, useId, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  describePath, emptyCheck, limits, newBlock, newId, newStep, stepKindLabel, stepKinds, withKind,
  type LessonBlockType, type LessonStep, type StepKind, type TeacherLessonContent, type ValidationIssue,
} from '@/lib/api/teaching/lesson-schema'
import { cn } from '@/lib/utils'
import { InlineAlert, NativeSelect } from './fields'
import { BlockFrame } from './lesson-block-editors'

export interface LessonMaterialOption { id: string; title: string }
export interface LessonEditorProps {
  content: TeacherLessonContent
  onChange: (update: (current: TeacherLessonContent) => TeacherLessonContent) => void
  materials: LessonMaterialOption[]
  issues: ValidationIssue[]
  disabled?: boolean
  /** Lets the lint panel jump to a step. */
  focusStep?: number | null
}
const move = <T,>(items: T[], index: number, delta: -1 | 1) => {
  const target = index + delta
  if (target < 0 || target >= items.length) return items
  const next = [...items]; const [item] = next.splice(index, 1); next.splice(target, 0, item!)
  return next
}
const addableBlocks: LessonBlockType[] = ['TEXT', 'LIST', 'TABLE', 'KEY_TERMS']
const blockName = { TEXT: 'Text', LIST: 'List', TABLE: 'Table', KEY_TERMS: 'Key terms' } as const

function StepForm({ step, index, onUpdate, materials }: { step: LessonStep; index: number; onUpdate: (update: (step: LessonStep) => LessonStep) => void; materials: LessonMaterialOption[] }) {
  const uid = useId()
  const [sourceChoice, setSourceChoice] = useState('')
  const isCheck = step.kind === 'CHECK'
  const maxBlocks = isCheck ? limits.checkBlocks : limits.blocks
  const used = new Set(step.sources.map(source => source.materialId))
  const available = materials.filter(material => !used.has(material.id))
  return <div className="space-y-4" data-testid="step-form">
    <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
      <NativeSelect label="Step type" value={step.kind} onChange={e => onUpdate(current => withKind(current, e.target.value as StepKind))}>
        {stepKinds.map(kind => <option key={kind} value={kind}>{stepKindLabel[kind]}</option>)}
      </NativeSelect>
      <div className="space-y-1.5">
        <label htmlFor={`${uid}-title`} className="block text-sm font-medium">Step title</label>
        <Input id={`${uid}-title`} value={step.title} maxLength={limits.titleStep + 20} onChange={e => onUpdate(current => ({ ...current, title: e.target.value }))} />
        <p className="text-[11px] text-muted-foreground">{step.title.length}/{limits.titleStep}</p>
      </div>
    </div>
    <div className="space-y-1.5">
      <label htmlFor={`${uid}-co`} className="block text-sm font-medium">Friendly line (optional)</label>
      <Input id={`${uid}-co`} value={step.coLine ?? ''} maxLength={limits.coLine + 20} onChange={e => onUpdate(current => ({ ...current, coLine: e.target.value }))} aria-describedby={`${uid}-co-hint`} />
      <p id={`${uid}-co-hint`} className="text-[11px] text-muted-foreground">Your own words, shown next to Co&rsquo;s picture. Leave it empty to show no line.</p>
    </div>

    <div className="space-y-2">
      <h5 className="text-sm font-bold">Content {isCheck ? `(up to ${limits.checkBlocks} blocks)` : `(1 to ${limits.blocks} blocks)`}</h5>
      {step.blocks.map((block, blockIndex) => <BlockFrame key={blockIndex} block={block} index={blockIndex} total={step.blocks.length} id={`${uid}-b${blockIndex}`}
        onChange={next => onUpdate(current => ({ ...current, blocks: current.blocks.map((entry, at) => at === blockIndex ? next : entry) }))}
        onMove={delta => onUpdate(current => ({ ...current, blocks: move(current.blocks, blockIndex, delta) }))}
        onRemove={() => onUpdate(current => ({ ...current, blocks: current.blocks.filter((_, at) => at !== blockIndex) }))} />)}
      {step.blocks.length < maxBlocks && <div className="flex flex-wrap gap-2" role="group" aria-label="Add a block">
        {addableBlocks.map(type => <Button key={type} variant="outline" size="lg" onClick={() => onUpdate(current => ({ ...current, blocks: [...current.blocks, newBlock(type)] }))}><Plus aria-hidden="true" />{blockName[type]}</Button>)}
      </div>}
    </div>

    {isCheck && step.check && <fieldset className="space-y-3 rounded-lg border border-border p-3" data-testid="check-editor">
      <legend className="px-1 text-sm font-bold">Question</legend>
      <div className="space-y-1.5"><label htmlFor={`${uid}-q`} className="block text-sm font-medium">Question</label><Textarea id={`${uid}-q`} rows={2} value={step.check.question} onChange={e => onUpdate(current => ({ ...current, check: { ...(current.check ?? emptyCheck()), question: e.target.value } }))} /></div>
      <p className="text-xs text-muted-foreground">Add 2 to 4 answers and mark the correct one. Learners never see which is correct until they choose it, and the feedback you write appears after they answer.</p>
      {step.check.options.map((option, optionIndex) => <div key={option.id} className="space-y-1.5 rounded-lg border border-border p-2" data-testid="check-option">
        <div className="flex items-center gap-2">
          <input type="radio" name={`${uid}-correct`} aria-label={`Answer ${optionIndex + 1} is correct`} checked={step.check!.correctOptionId === option.id}
            onChange={() => onUpdate(current => ({ ...current, check: { ...current.check!, correctOptionId: option.id } }))} />
          <label className="sr-only" htmlFor={`${uid}-o${optionIndex}`}>Answer {optionIndex + 1}</label>
          <Input id={`${uid}-o${optionIndex}`} placeholder={`Answer ${optionIndex + 1}`} value={option.text} onChange={e => onUpdate(current => ({ ...current, check: { ...current.check!, options: current.check!.options.map(entry => entry.id === option.id ? { ...entry, text: e.target.value } : entry) } }))} />
          <Button variant="ghost" size="icon" aria-label={`Remove answer ${optionIndex + 1}`} disabled={step.check!.options.length <= limits.minOptions}
            onClick={() => onUpdate(current => { const options = current.check!.options.filter(entry => entry.id !== option.id); return { ...current, check: { ...current.check!, options, correctOptionId: options.some(entry => entry.id === current.check!.correctOptionId) ? current.check!.correctOptionId : options[0]!.id } } })}><Trash2 aria-hidden="true" /></Button>
        </div>
        <label className="sr-only" htmlFor={`${uid}-f${optionIndex}`}>Feedback for answer {optionIndex + 1}</label>
        <Input id={`${uid}-f${optionIndex}`} placeholder="Feedback shown after this answer" value={option.feedback} onChange={e => onUpdate(current => ({ ...current, check: { ...current.check!, options: current.check!.options.map(entry => entry.id === option.id ? { ...entry, feedback: e.target.value } : entry) } }))} />
      </div>)}
      <Button variant="outline" size="lg" disabled={step.check.options.length >= limits.options} onClick={() => onUpdate(current => ({ ...current, check: { ...current.check!, options: [...current.check!.options, { id: newId(), text: '', feedback: '' }] } }))}><Plus aria-hidden="true" />Answer</Button>
      <div className="space-y-1.5"><label htmlFor={`${uid}-hint`} className="block text-sm font-medium">Hint (optional)</label><Input id={`${uid}-hint`} value={step.check.hint ?? ''} onChange={e => onUpdate(current => ({ ...current, check: { ...current.check!, hint: e.target.value } }))} /></div>
    </fieldset>}

    <div className="space-y-2" data-testid="step-sources">
      <h5 className="text-sm font-bold">Sources (up to {limits.sources})</h5>
      <p className="text-xs text-muted-foreground">Point to material in this topic. Learners see these as links once the material is published.</p>
      {step.sources.length > 0 && <ul className="flex flex-wrap gap-2">{step.sources.map(source => <li key={source.materialId} className="flex items-center gap-1 rounded-full border border-border ps-2 text-sm">
        <span>{source.label}</span><Button variant="ghost" size="icon-sm" aria-label={`Remove source ${source.label}`} onClick={() => onUpdate(current => ({ ...current, sources: current.sources.filter(entry => entry.materialId !== source.materialId) }))}><Trash2 aria-hidden="true" /></Button></li>)}</ul>}
      {step.sources.length < limits.sources && (available.length === 0
        ? <p className="text-xs text-muted-foreground">{materials.length === 0 ? 'Add material to this topic first.' : 'All material in this topic is already a source.'}</p>
        : <div className="flex flex-wrap items-end gap-2"><div className="min-w-48 flex-1"><NativeSelect label="Add a source" value={sourceChoice} onChange={e => setSourceChoice(e.target.value)}><option value="">Choose material</option>{available.map(material => <option key={material.id} value={material.id}>{material.title}</option>)}</NativeSelect></div>
          <Button variant="outline" size="lg" disabled={!sourceChoice} onClick={() => { const material = available.find(entry => entry.id === sourceChoice); if (material) { onUpdate(current => ({ ...current, sources: [...current.sources, { materialId: material.id, label: material.title.slice(0, limits.label) }] })); setSourceChoice('') } }}>Add source</Button></div>)}
    </div>
    <p className="sr-only">Editing step {index + 1}</p>
  </div>
}

/** The step-by-step lesson form (F-T3-03). All text is plain text; nothing here can inject HTML or a link into a lesson. */
export function LessonEditor({ content, onChange, materials, issues, disabled, focusStep }: LessonEditorProps) {
  const [selected, setSelected] = useState(content.steps[0]?.id ?? '')
  useEffect(() => { if (focusStep !== null && focusStep !== undefined && content.steps[focusStep]) setSelected(content.steps[focusStep]!.id) }, [focusStep, content.steps])
  const index = Math.max(0, content.steps.findIndex(step => step.id === selected))
  const step = content.steps[index]
  const updateStep = (id: string, update: (step: LessonStep) => LessonStep) => onChange(current => ({ ...current, steps: current.steps.map(entry => entry.id === id ? update(entry) : entry) }))
  const addStep = (kind: StepKind) => { const created = newStep(kind); onChange(current => ({ ...current, steps: [...current.steps, created] })); setSelected(created.id) }
  const [newKind, setNewKind] = useState<StepKind>('EXPLAIN')

  return <fieldset disabled={disabled} className="space-y-5 border-0 p-0" data-testid="lesson-editor">
    <div className="grid gap-3">
      <div className="space-y-1.5">
        <label htmlFor="lesson-title" className="block text-sm font-medium">Lesson title</label>
        <Input id="lesson-title" value={content.title} maxLength={limits.titleLesson + 20} onChange={e => onChange(current => ({ ...current, title: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium" id="lesson-objectives-label">What learners will be able to do (1 to {limits.objectives})</p>
        {content.objectives.map((objective, at) => <div key={at} className="flex gap-2">
          <Input aria-label={`Objective ${at + 1}`} value={objective} maxLength={limits.objective + 20} onChange={e => onChange(current => ({ ...current, objectives: current.objectives.map((entry, i) => i === at ? e.target.value : entry) }))} />
          <Button variant="ghost" size="icon" aria-label={`Remove objective ${at + 1}`} disabled={content.objectives.length <= 1} onClick={() => onChange(current => ({ ...current, objectives: current.objectives.filter((_, i) => i !== at) }))}><Trash2 aria-hidden="true" /></Button>
        </div>)}
        <Button variant="outline" size="lg" disabled={content.objectives.length >= limits.objectives} onClick={() => onChange(current => ({ ...current, objectives: [...current.objectives, ''] }))}><Plus aria-hidden="true" />Objective</Button>
      </div>
    </div>

    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <nav aria-label="Lesson steps" className="space-y-2">
        <ol className="space-y-1" data-testid="step-list">{content.steps.map((entry, at) => <li key={entry.id} className={cn('flex items-center gap-1 rounded-lg border p-1', entry.id === step?.id ? 'border-primary bg-primary/5' : 'border-border')}>
          <button type="button" className="min-w-0 flex-1 rounded px-1.5 py-1 text-start focus-visible:outline-2 focus-visible:outline-ring" aria-current={entry.id === step?.id ? 'step' : undefined} onClick={() => setSelected(entry.id)} data-testid="step-select">
            <span className="block text-[11px] text-muted-foreground">Step {at + 1} · {stepKindLabel[entry.kind]}</span><span className="block break-words text-sm font-medium">{entry.title || 'Untitled step'}</span>
          </button>
          <Button variant="ghost" size="icon" aria-label={`Move step ${at + 1} up`} disabled={at === 0} onClick={() => onChange(current => ({ ...current, steps: move(current.steps, at, -1) }))}><ArrowUp aria-hidden="true" /></Button>
          <Button variant="ghost" size="icon" aria-label={`Move step ${at + 1} down`} disabled={at === content.steps.length - 1} onClick={() => onChange(current => ({ ...current, steps: move(current.steps, at, 1) }))}><ArrowDown aria-hidden="true" /></Button>
          <Button variant="ghost" size="icon" aria-label={`Remove step ${at + 1}`} disabled={content.steps.length <= 1} onClick={() => { onChange(current => ({ ...current, steps: current.steps.filter(item => item.id !== entry.id) })); if (entry.id === step?.id) setSelected(content.steps[Math.max(0, at - 1)]?.id ?? '') }}><Trash2 aria-hidden="true" /></Button>
        </li>)}</ol>
        {content.steps.length < limits.steps && <div className="flex items-end gap-2"><div className="min-w-0 flex-1"><NativeSelect label="New step" value={newKind} onChange={e => setNewKind(e.target.value as StepKind)}>{stepKinds.map(kind => <option key={kind} value={kind}>{stepKindLabel[kind]}</option>)}</NativeSelect></div><Button variant="outline" size="lg" onClick={() => addStep(newKind)} data-testid="add-step"><Plus aria-hidden="true" />Add</Button></div>}
        <p className="text-[11px] text-muted-foreground">{content.steps.length} of {limits.steps} steps</p>
      </nav>
      <div className="min-w-0 rounded-xl border border-border p-4">{step ? <StepForm key={step.id} step={step} index={index} materials={materials} onUpdate={update => updateStep(step.id, update)} /> : null}</div>
    </div>

    <div className="space-y-2">
      <h4 className="text-sm font-bold">Key terms for the whole lesson (up to {limits.keyTerms})</h4>
      {content.keyTerms.map((entry, at) => <div key={at} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <Input aria-label={`Lesson term ${at + 1}`} placeholder="Term" value={entry.term} onChange={e => onChange(current => ({ ...current, keyTerms: current.keyTerms.map((item, i) => i === at ? { ...item, term: e.target.value } : item) }))} />
        <Input aria-label={`Meaning of lesson term ${at + 1}`} placeholder="Meaning" value={entry.definition} onChange={e => onChange(current => ({ ...current, keyTerms: current.keyTerms.map((item, i) => i === at ? { ...item, definition: e.target.value } : item) }))} />
        <Button variant="ghost" size="icon" aria-label={`Remove lesson term ${at + 1}`} onClick={() => onChange(current => ({ ...current, keyTerms: current.keyTerms.filter((_, i) => i !== at) }))}><Trash2 aria-hidden="true" /></Button>
      </div>)}
      <Button variant="outline" size="lg" disabled={content.keyTerms.length >= limits.keyTerms} onClick={() => onChange(current => ({ ...current, keyTerms: [...current.keyTerms, { term: '', definition: '' }] }))}><Plus aria-hidden="true" />Key term</Button>
    </div>

    {issues.length > 0 && <InlineAlert tone="warning" testId="lesson-issues">
      <p className="font-semibold">Not saved yet. Fix {issues.length === 1 ? 'this' : `these ${issues.length}`} to save the draft:</p>
      <ul className="mt-1 list-disc ps-5">{issues.slice(0, 8).map(issue => <li key={`${issue.path}:${issue.message}`}>{describePath(issue.path, content)}: {issue.message}</li>)}{issues.length > 8 && <li>and {issues.length - 8} more</li>}</ul>
    </InlineAlert>}
  </fieldset>
}
