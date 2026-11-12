'use client'

import { useId, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Lock, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FieldHint, NativeSelect } from '@/components/teacher/plans/fields'
import { newId } from '@/lib/api/teaching/lesson-schema'
import type { TeachingMaterial } from '@/lib/api/teaching/materials'
import {
  blankMarker, codeLanguages, countBlanks, hasOptions, hintRungs, isFreeText, issueFor, optionLimits, rungHelp, rungLabel, syncBlanks,
  type HintRung, type QuestionContent, type QuestionIssue,
} from '@/lib/api/teaching/question-schema'

export function Field({ label, htmlFor, issue, hint, children, right }: { label: string; htmlFor: string; issue?: QuestionIssue; hint?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return <div className="space-y-1.5" data-field-error={issue ? issue.path : undefined}>
    <div className="flex items-baseline justify-between gap-2"><label htmlFor={htmlFor} className="block text-sm font-medium">{label}</label>{right}</div>
    {children}
    {hint && <FieldHint id={`${htmlFor}-hint`}>{hint}</FieldHint>}
    {issue && <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-destructive" data-testid={`error-${issue.path}`}>{issue.message}</p>}
  </div>
}

/** The answer key is staff-only: learners never receive these fields before the reveal rules of the lesson and practice players. */
export function AnswerKeyHeading({ children = 'Answer key' }: { children?: ReactNode }) {
  return <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm" data-testid="answer-key-note">
    <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><p><span className="font-semibold">{children}.</span> Only you and your school&rsquo;s teaching staff see this. Learners get the explanation and hints only at the points the lesson or practice player reveals them.</p>
  </div>
}

type Change = (next: QuestionContent) => void
interface FieldsProps { content: QuestionContent; onChange: Change; issues: QuestionIssue[]; disabled?: boolean }

export function PromptField({ content, onChange, issues, disabled }: FieldsProps) {
  const id = useId()
  const issue = issueFor(issues, 'prompt')
  const hint = content.type === 'FILL_BLANK' ? `Type ${blankMarker} (three underscores) where each blank goes.` : undefined
  return <Field label="Question" htmlFor={id} issue={issue} hint={hint} right={<span className="text-xs text-muted-foreground">{content.prompt.length}/2000</span>}>
    <Textarea id={id} rows={4} maxLength={2000} value={content.prompt} disabled={disabled} aria-invalid={!!issue} aria-describedby={[hint ? `${id}-hint` : '', issue ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined}
      onChange={e => onChange(syncBlanks({ ...content, prompt: e.target.value }))} data-testid="field-prompt" />
  </Field>
}

/* ---------- options-based types ---------- */

function OptionsEditor({ content, onChange, issues, disabled, images }: FieldsProps & { images: TeachingMaterial[] }) {
  const options = content.options ?? []
  const answer = content.correctAnswer
  const { min, max } = optionLimits(content.type)
  const isOrder = content.type === 'ORDERING'
  const isMulti = content.type === 'MULTI_SELECT'
  const isPicture = content.type === 'PICTURE_CHOICE'
  const groupName = useId()
  const listIssue = issueFor(issues, 'options') ?? (answer && issueFor(issues, 'correctAnswer'))
  const setOptions = (next: typeof options, correct = content.correctAnswer) => onChange({ ...content, options: next, correctAnswer: correct })
  const orderIds = answer.kind === 'order' ? answer.optionIds : options.map(o => o.id)

  const addOption = () => {
    const option = { id: newId(), label: '' }
    setOptions([...options, option], isOrder && answer.kind === 'order' ? { kind: 'order', optionIds: [...answer.optionIds, option.id] } : answer)
  }
  const removeOption = (id: string) => {
    const next = options.filter(o => o.id !== id)
    let correct = answer
    if (answer.kind === 'option' && answer.optionId === id) correct = { kind: 'option', optionId: next[0]?.id ?? '' }
    if (answer.kind === 'options') correct = { kind: 'options', optionIds: answer.optionIds.filter(x => x !== id) }
    if (answer.kind === 'order') correct = { kind: 'order', optionIds: answer.optionIds.filter(x => x !== id) }
    const images = content.media?.optionImages
    const media = isPicture && images ? { optionImages: Object.fromEntries(Object.entries(images).filter(([key]) => key !== id)) } : content.media
    onChange({ ...content, options: next, correctAnswer: correct, media })
  }
  const relabel = (id: string, label: string) => setOptions(options.map(o => (o.id === id ? { ...o, label } : o)))
  const move = (id: string, delta: -1 | 1) => {
    const ids = [...orderIds]; const at = ids.indexOf(id); const to = at + delta
    if (at < 0 || to < 0 || to >= ids.length) return
    ;[ids[at], ids[to]] = [ids[to]!, ids[at]!]
    onChange({ ...content, correctAnswer: { kind: 'order', optionIds: ids } })
  }
  const toggleCorrect = (id: string) => {
    if (isMulti && answer.kind === 'options') onChange({ ...content, correctAnswer: { kind: 'options', optionIds: answer.optionIds.includes(id) ? answer.optionIds.filter(x => x !== id) : [...answer.optionIds, id] } })
    else onChange({ ...content, correctAnswer: { kind: 'option', optionId: id } })
  }
  const setImage = (id: string, materialId: string) => {
    const next = { ...(content.media?.optionImages ?? {}) }
    if (materialId) next[id] = materialId; else delete next[id]
    onChange({ ...content, media: { optionImages: next } })
  }
  const sequence = isOrder ? orderIds.map(id => options.find(o => o.id === id)).filter((o): o is NonNullable<typeof o> => !!o) : options

  return <fieldset className="space-y-3" data-testid="options-editor" aria-describedby={listIssue ? `${groupName}-error` : undefined}>
    <legend className="text-sm font-medium">{isOrder ? 'Items, in the correct order' : 'Options'}</legend>
    <FieldHint>{isOrder ? 'Write the items from first to last. Learners will see them shuffled. Use the arrows to reorder.' : isMulti ? 'Tick every correct option.' : 'Choose the one correct option.'} ({min} to {max})</FieldHint>
    <ol className="space-y-2">
      {sequence.map((option, index) => {
        const optionIssue = issueFor(issues, `options.${options.findIndex(o => o.id === option.id)}`)
        const inputId = `${groupName}-opt-${option.id}`
        const correct = answer.kind === 'option' ? answer.optionId === option.id : answer.kind === 'options' ? answer.optionIds.includes(option.id) : false
        return <li key={option.id} className="space-y-1.5 rounded-lg border border-border p-2.5" data-testid="option-row">
          <div className="flex items-center gap-2">
            {isOrder
              ? <span className="w-6 shrink-0 text-center text-sm font-semibold" aria-hidden="true">{index + 1}</span>
              : <input type={isMulti ? 'checkbox' : 'radio'} name={groupName} checked={correct} disabled={disabled} onChange={() => toggleCorrect(option.id)} className="size-5 shrink-0" aria-label={`Option ${index + 1} is correct`} data-testid="option-correct" />}
            <label htmlFor={inputId} className="sr-only">{isOrder ? `Item ${index + 1}` : `Option ${index + 1}`}</label>
            <Input id={inputId} value={option.label} disabled={disabled} maxLength={300} aria-invalid={!!optionIssue} onChange={e => relabel(option.id, e.target.value)} placeholder={isOrder ? `Item ${index + 1}` : `Option ${index + 1}`} data-testid="option-label" />
            {isOrder && <>
              <Button type="button" variant="outline" size="icon" disabled={disabled || index === 0} onClick={() => move(option.id, -1)} aria-label={`Move item ${index + 1} up`}><ArrowUp aria-hidden="true" /></Button>
              <Button type="button" variant="outline" size="icon" disabled={disabled || index === sequence.length - 1} onClick={() => move(option.id, 1)} aria-label={`Move item ${index + 1} down`}><ArrowDown aria-hidden="true" /></Button>
            </>}
            <Button type="button" variant="ghost" size="icon" disabled={disabled || options.length <= min} onClick={() => removeOption(option.id)} aria-label={`Remove ${isOrder ? 'item' : 'option'} ${index + 1}`}><Trash2 aria-hidden="true" /></Button>
          </div>
          {isPicture && <div className="ps-7">
            <NativeSelect label={`Picture for option ${index + 1}`} value={content.media?.optionImages?.[option.id] ?? ''} disabled={disabled} onChange={e => setImage(option.id, e.target.value)} data-testid="option-image"
              hint={images.length === 0 ? 'No photos in this topic yet. Add a photo to the topic material first.' : undefined}>
              <option value="">Choose a photo</option>{images.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</NativeSelect>
            {issueFor(issues, `options.${options.findIndex(o => o.id === option.id)}.image`) && <p role="alert" className="mt-1 text-xs font-medium text-destructive">Choose a picture for this option.</p>}
          </div>}
          {optionIssue && !issueFor(issues, `options.${options.findIndex(o => o.id === option.id)}.image`) && <p role="alert" className="ps-7 text-xs font-medium text-destructive" data-testid={`error-${optionIssue.path}`}>{optionIssue.message}</p>}
        </li>
      })}
    </ol>
    <Button type="button" variant="outline" size="lg" disabled={disabled || options.length >= max} onClick={addOption} data-testid="add-option"><Plus aria-hidden="true" />Add {isOrder ? 'item' : 'option'}</Button>
    {listIssue && <p id={`${groupName}-error`} role="alert" className="text-xs font-medium text-destructive" data-testid={`error-${listIssue.path}`}>{listIssue.message}</p>}
  </fieldset>
}

function TrueFalseEditor({ content, onChange, issues, disabled }: FieldsProps) {
  const name = useId()
  const answer = content.correctAnswer.kind === 'option' ? content.correctAnswer.optionId : ''
  const issue = issueFor(issues, 'correctAnswer')
  return <fieldset className="space-y-2" data-testid="true-false-editor">
    <legend className="text-sm font-medium">Correct answer</legend>
    <div className="flex gap-4">{[{ id: 'true', label: 'True' }, { id: 'false', label: 'False' }].map(o => <label key={o.id} className="flex min-h-9 items-center gap-2 text-sm">
      <input type="radio" name={name} className="size-5" checked={answer === o.id} disabled={disabled} onChange={() => onChange({ ...content, correctAnswer: { kind: 'option', optionId: o.id } })} data-testid={`tf-${o.id}`} />{o.label}</label>)}</div>
    {issue && <p role="alert" className="text-xs font-medium text-destructive" data-testid={`error-${issue.path}`}>{issue.message}</p>}
  </fieldset>
}

function BlanksEditor({ content, onChange, issues, disabled }: FieldsProps) {
  const id = useId()
  const answer = content.correctAnswer
  if (answer.kind !== 'blanks') return null
  const total = countBlanks(content.prompt)
  return <fieldset className="space-y-3" data-testid="blanks-editor">
    <legend className="text-sm font-medium">Accepted answers for each blank</legend>
    <FieldHint>One accepted answer per line. Spelling variants you want to accept go on separate lines. {total === 0 ? `Add ${blankMarker} to the question first.` : `The question has ${total} blank${total === 1 ? '' : 's'}.`}</FieldHint>
    {answer.blanks.map((list, index) => {
      const issue = issueFor(issues, `correctAnswer.blanks.${index}`)
      return <div key={index} className="space-y-1">
        <label htmlFor={`${id}-${index}`} className="block text-sm">Blank {index + 1}</label>
        <Textarea id={`${id}-${index}`} rows={2} value={list.join('\n')} disabled={disabled} aria-invalid={!!issue} data-testid="blank-answers"
          onChange={e => onChange({ ...content, correctAnswer: { kind: 'blanks', blanks: answer.blanks.map((entry, i) => (i === index ? e.target.value.split('\n') : entry)) } })} />
        {issue && <p role="alert" className="text-xs font-medium text-destructive" data-testid={`error-${issue.path}`}>{issue.message}</p>}
      </div>
    })}
    {issueFor(issues, 'correctAnswer') && !answer.blanks.some((_, i) => issueFor(issues, `correctAnswer.blanks.${i}`)) && <p role="alert" className="text-xs font-medium text-destructive" data-testid="error-correctAnswer">{issueFor(issues, 'correctAnswer')!.message}</p>}
  </fieldset>
}

function FreeTextEditor({ content, onChange, issues, disabled }: FieldsProps) {
  const id = useId()
  const answer = content.correctAnswer
  if (answer.kind !== 'text') return null
  const answerIssue = issueFor(issues, 'correctAnswer'); const rubricIssue = issueFor(issues, 'rubric')
  return <div className="space-y-4" data-testid="free-text-editor">
    <Field label="Model answer" htmlFor={`${id}-sample`} issue={answerIssue} hint="What a full-marks answer looks like.">
      <Textarea id={`${id}-sample`} rows={content.type === 'LONG_ANSWER' ? 6 : 3} value={answer.sample} disabled={disabled} aria-invalid={!!answerIssue} onChange={e => onChange({ ...content, correctAnswer: { kind: 'text', sample: e.target.value } })} data-testid="field-sample" />
    </Field>
    <Field label="Rubric" htmlFor={`${id}-rubric`} issue={rubricIssue} hint="What earns marks and what does not, in a few bullet points. Used for consistent marking." right={<span className="text-xs text-muted-foreground">{(content.rubric ?? '').length}/2000</span>}>
      <Textarea id={`${id}-rubric`} rows={4} maxLength={2000} value={content.rubric ?? ''} disabled={disabled} aria-invalid={!!rubricIssue} onChange={e => onChange({ ...content, rubric: e.target.value })} data-testid="field-rubric" />
    </Field>
  </div>
}

function CodeEditor({ content, onChange, issues, disabled }: FieldsProps) {
  const id = useId()
  const answer = content.correctAnswer
  if (answer.kind !== 'code') return null
  const sampleIssue = issueFor(issues, 'correctAnswer')
  return <div className="space-y-4" data-testid="code-editor">
    <NativeSelect label="Language" value={answer.language} disabled={disabled} data-testid="field-language"
      onChange={e => onChange({ ...content, correctAnswer: { ...answer, language: e.target.value }, media: { ...content.media, language: e.target.value } })}>
      {codeLanguages.map(language => <option key={language} value={language}>{language}</option>)}</NativeSelect>
    <Field label="Starter code (optional)" htmlFor={`${id}-starter`} hint="Shown to the person answering as a starting point.">
      <Textarea id={`${id}-starter`} rows={5} className="font-mono" spellCheck={false} value={content.media?.starterCode ?? ''} disabled={disabled} onChange={e => onChange({ ...content, media: { ...content.media, language: answer.language, starterCode: e.target.value } })} data-testid="field-starter" />
    </Field>
    <Field label="Model solution" htmlFor={`${id}-sample`} issue={sampleIssue}>
      <Textarea id={`${id}-sample`} rows={6} className="font-mono" spellCheck={false} value={answer.sample} disabled={disabled} aria-invalid={!!sampleIssue} onChange={e => onChange({ ...content, correctAnswer: { ...answer, sample: e.target.value } })} data-testid="field-sample" />
    </Field>
  </div>
}

/** The answer area for whichever of the nine types is chosen. */
export function AnswerEditor(props: FieldsProps & { images: TeachingMaterial[] }) {
  const { content } = props
  if (hasOptions(content.type)) return <OptionsEditor {...props} />
  if (content.type === 'TRUE_FALSE') return <TrueFalseEditor {...props} />
  if (content.type === 'FILL_BLANK') return <BlanksEditor {...props} />
  if (isFreeText(content.type)) return <FreeTextEditor {...props} />
  return <CodeEditor {...props} />
}

export function ExplanationField({ content, onChange, issues, disabled }: FieldsProps) {
  const id = useId()
  const issue = issueFor(issues, 'explanation')
  return <Field label="Explanation" htmlFor={id} issue={issue} hint="Why the answer is right. Shown to the learner after they answer." right={<span className="text-xs text-muted-foreground">{content.explanation.length}/2000</span>}>
    <Textarea id={id} rows={3} maxLength={2000} value={content.explanation} disabled={disabled} aria-invalid={!!issue} onChange={e => onChange({ ...content, explanation: e.target.value })} data-testid="field-explanation" />
  </Field>
}

/** Three optional rungs, in a fixed order: Nudge, Hint, Similar example. An empty rung is simply not saved. */
export function HintsEditor({ content, onChange, issues, disabled }: FieldsProps) {
  const base = useId()
  const textOf = (rung: HintRung) => content.hints.find(h => h.rung === rung)?.text ?? ''
  const setText = (rung: HintRung, text: string) => {
    onChange({ ...content, hints: hintRungs.map(r => ({ rung: r, text: r === rung ? text : textOf(r) })).filter(h => h.text !== '') })
  }
  return <fieldset className="space-y-3" data-testid="hints-editor">
    <legend className="text-sm font-medium">Hints (optional, up to three)</legend>
    {hintRungs.map((rung, index) => {
      const issue = issueFor(issues, `hints.${content.hints.findIndex(h => h.rung === rung)}`)
      return <Field key={rung} label={`${index + 1}. ${rungLabel[rung]}`} htmlFor={`${base}-${rung}`} issue={issue} hint={rungHelp[rung]} right={<span className="text-xs text-muted-foreground">{textOf(rung).length}/500</span>}>
        <Textarea id={`${base}-${rung}`} rows={2} maxLength={500} value={textOf(rung)} disabled={disabled} aria-invalid={!!issue} onChange={e => setText(rung, e.target.value)} data-testid={`hint-${rung}`} />
      </Field>
    })}
  </fieldset>
}
