'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, GraduationCap, Lightbulb, XCircle } from 'lucide-react'
import { Button, CoCharacter, QuestionOptionTile } from '@/components/design-system'
import { learnApi, linkHref, type LearnBand, type TeacherLessonSummary } from '@/lib/api/learn'
import type { LessonBlock, LessonCheckResult, StudentLessonStep, StudentLessonView } from '@/lib/api/teaching/lesson-schema'
import { stepKindLabel } from '@/lib/api/teaching/lesson-schema'
import { cn } from '@/lib/utils'
import { useLearnIdentity } from './learn-common'

/*
 * B12 section 7 / 10.3: the teacher-authored lesson, step by step. The SAME component renders the learner's lesson and the
 * teacher's "Preview as student", so what a teacher previews is what a student gets. It shows "From your teacher" (never
 * the AI badge; the text is the teacher's own). It renders plain text only: no HTML, no links inside blocks (links exist only
 * as `sources` chips to published material). It never receives the answer key: `StudentLessonView` has no field for it.
 * Motion is limited to `motion-safe:` transitions; every control is a native button or radio.
 */
export interface TeacherLessonReaderProps {
  view: StudentLessonView
  band: LearnBand
  /** `preview` is the teacher's preview: a check can be answered but gives no feedback, because feedback comes from the server for a learner. */
  mode?: 'learner' | 'preview'
  /** Learner mode: checks one answer. Formative: the result is shown, never stored or graded. */
  onCheck?: (stepIndex: number, optionId: string) => Promise<LessonCheckResult>
  /** Where a source chip goes. Defaults to the learner's library item for the published material. */
  sourceHref?: (materialId: string) => string | null
  onFinish?: () => void
}

const defaultSourceHref = (materialId: string) => linkHref({ route: 'LIBRARY_ITEM', id: materialId })

function Blocks({ blocks, band }: { blocks: readonly LessonBlock[]; band: LearnBand }) {
  const kids = band === 'kids'
  return <div className={cn('space-y-5', kids && 'space-y-6')}>{blocks.map((block, index) => {
    if (block.type === 'TEXT') return <p key={index} className={cn('max-w-prose whitespace-pre-line break-words leading-relaxed', kids && 'text-[length:var(--ds-h3)] font-semibold leading-snug')}>{block.text}</p>
    if (block.type === 'LIST') return <ul key={index} className="max-w-prose list-disc space-y-2 break-words ps-6">{block.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul>
    if (block.type === 'TABLE') return <div key={index} role="region" aria-label="Table" tabIndex={0} className="overflow-x-auto rounded-[var(--radius)] border border-border focus-visible:outline-2 focus-visible:outline-ring">
      <table className="w-full min-w-max border-collapse text-start text-[length:var(--ds-small)]">
        <thead><tr>{block.headers.map((header, headerIndex) => <th key={headerIndex} scope="col" className="border-b border-border bg-secondary p-2 text-start font-bold">{header}</th>)}</tr></thead>
        <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} className="border-b border-border p-2">{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
    return <dl key={index} className="max-w-prose space-y-2">{block.terms.map((term, termIndex) => <div key={termIndex} className="rounded-[var(--radius)] border border-border p-3"><dt className="font-bold">{term.term}</dt><dd className="break-words text-muted-foreground">{term.definition}</dd></div>)}</dl>
  })}</div>
}

function CheckStep({ step, index, mode, onCheck }: { step: StudentLessonStep; index: number; mode: 'learner' | 'preview'; onCheck?: TeacherLessonReaderProps['onCheck'] }) {
  const group = useId()
  const [chosen, setChosen] = useState<string | null>(null)
  const [result, setResult] = useState<LessonCheckResult | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hintOpen, setHintOpen] = useState(false)
  const check = step.check
  if (!check) return null
  const answered = result?.correct === true

  async function submit() {
    if (!chosen || !onCheck) return
    setPending(true); setError(null)
    try { setResult(await onCheck(index, chosen)) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'That could not be checked. Please try again.') }
    finally { setPending(false) }
  }

  return <section aria-label="Check your understanding" className="ds-card space-y-4" data-testid="lesson-check">
    <p className="font-bold">{check.question}</p>
    <div role="radiogroup" aria-label={check.question} className="grid gap-3">
      {check.options.map(option => <QuestionOptionTile key={option.id} name={group} value={option.id} label={option.text} checked={chosen === option.id}
        disabled={pending || answered} onSelect={value => { setChosen(value); setResult(null) }} />)}
    </div>
    {check.hint && <div>
      <button type="button" aria-expanded={hintOpen} onClick={() => setHintOpen(open => !open)} className="ds-button ds-button-ghost"><Lightbulb aria-hidden="true" size={18} />{hintOpen ? 'Hide the hint' : 'Need a hint?'}</button>
      {hintOpen && <p className="mt-2 break-words text-muted-foreground" data-testid="lesson-hint">{check.hint}</p>}
    </div>}
    {mode === 'learner'
      ? <Button onClick={() => void submit()} disabled={!chosen || pending || answered} loading={pending}>Check my answer</Button>
      : <p role="note" className="text-[length:var(--ds-small)] text-muted-foreground" data-testid="preview-check-note">Preview only: learners get feedback here after they choose. It is not shown in a preview.</p>}
    <div aria-live="polite" role="status">
      {result && <p data-testid="check-result" data-correct={result.correct} className={cn('flex items-start gap-2 font-semibold', result.correct ? 'text-primary' : 'text-foreground')}>
        {result.correct ? <CheckCircle2 aria-hidden="true" className="mt-1 size-5 shrink-0" /> : <XCircle aria-hidden="true" className="mt-1 size-5 shrink-0" />}
        <span><span className="sr-only">{result.correct ? 'Correct. ' : 'Not quite. '}</span>{result.feedback}{!result.correct && ' Pick another answer to try again.'}</span>
      </p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </div>
    <p className="text-[length:var(--ds-caption)] text-muted-foreground">This check is for practice. It is not a grade and is not saved.</p>
  </section>
}

function SourceChips({ step, sourceHref }: { step: StudentLessonStep; sourceHref: (materialId: string) => string | null }) {
  if (step.sources.length === 0) return null
  return <section aria-label="Where this comes from" data-testid="lesson-sources" className="space-y-2">
    <ul className="flex flex-wrap gap-2">{step.sources.map(source => {
      const href = sourceHref(source.materialId)
      return <li key={`${source.materialId}:${source.label}`}>{href
        ? <Link href={href} className="ds-pill border border-border hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"><BookOpen size={16} aria-hidden="true" />{source.label}</Link>
        : <span className="ds-pill border border-border"><BookOpen size={16} aria-hidden="true" />{source.label}</span>}</li>
    })}</ul>
  </section>
}

export function TeacherLessonReader({ view, band, mode = 'learner', onCheck, sourceHref = defaultSourceHref, onFinish }: TeacherLessonReaderProps) {
  const [index, setIndex] = useState(0)
  const [finished, setFinished] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const first = useRef(true)
  const total = view.steps.length
  const step = view.steps[Math.min(index, total - 1)]!
  const last = index >= total - 1
  const kids = band === 'kids'

  // Moving between steps moves focus to the new step's heading, so keyboard and screen reader users land on it.
  useEffect(() => {
    if (first.current) { first.current = false; return }
    heading.current?.focus()
  }, [index, finished])
  const go = useCallback((delta: -1 | 1) => setIndex(current => Math.min(total - 1, Math.max(0, current + delta))), [total])

  return <article aria-label={view.title} data-testid="teacher-lesson" data-band={band} data-mode={mode} className="space-y-5">
    <header className="space-y-3">
      <p className="ds-pill w-fit" data-testid="from-teacher"><GraduationCap size={16} aria-hidden="true" />From your teacher</p>
      <h2 className="break-words">{view.title}</h2>
      {view.objectives.length > 0 && <div><h3 className="text-[length:var(--ds-body)]">{kids ? 'What you will learn' : 'Objectives'}</h3><ul className="list-disc space-y-1 break-words ps-6">{view.objectives.map((objective, objectiveIndex) => <li key={objectiveIndex}>{objective}</li>)}</ul></div>}
    </header>

    {!finished ? <>
      <p className="font-bold" data-testid="lesson-progress" role="status">Step {index + 1} of {total}</p>
      <div role="img" aria-label={`Step ${index + 1} of ${total}`} className="flex flex-wrap gap-2">{view.steps.map((entry, dotIndex) => <span key={entry.id} aria-hidden="true" data-current={dotIndex === index || undefined} className={cn('block size-4 rounded-full border-2 border-primary', dotIndex <= index && 'bg-primary')} />)}</div>
      <section aria-labelledby="lesson-step-title" className="ds-card space-y-4" data-testid="lesson-step" data-kind={step.kind}>
        <p className="text-[length:var(--ds-small)] font-bold text-muted-foreground">{stepKindLabel[step.kind]}</p>
        <h3 id="lesson-step-title" ref={heading} tabIndex={-1} className="break-words outline-none focus-visible:outline-2 focus-visible:outline-ring">{step.title}</h3>
        {step.coLine && <div className="flex items-start gap-3" data-testid="co-line"><CoCharacter band={band} state="explaining" size={kids ? 72 : 48} decorative /><p className="min-w-0 break-words rounded-[var(--radius)] bg-secondary p-3">{step.coLine}</p></div>}
        <Blocks blocks={step.blocks} band={band} />
        <SourceChips step={step} sourceHref={sourceHref} />
      </section>
      {step.kind === 'CHECK' && step.check && <CheckStep key={step.id} step={step} index={index} mode={mode} onCheck={onCheck} />}
      <nav aria-label="Lesson steps" className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={() => go(-1)} disabled={index === 0}><ArrowLeft aria-hidden="true" size={18} className="rtl:rotate-180" />Back</Button>
        {last ? <Button onClick={() => setFinished(true)} data-testid="lesson-finish-step">{kids ? 'All done!' : 'Finish lesson'}</Button>
          : <Button onClick={() => go(1)} data-testid="lesson-next">Next<ArrowRight aria-hidden="true" size={18} className="rtl:rotate-180" /></Button>}
      </nav>
    </> : <section aria-labelledby="lesson-done" className="ds-card space-y-4" data-testid="lesson-done">
      <h3 id="lesson-done" ref={heading} tabIndex={-1} className="outline-none">{kids ? 'You finished the lesson!' : 'Lesson finished'}</h3>
      {view.keyTerms.length > 0 && <div><h4 className="mb-2 font-bold">Key terms</h4><Blocks blocks={[{ type: 'KEY_TERMS', terms: view.keyTerms.slice(0, 6) }]} band={band} />{view.keyTerms.length > 6 && <Blocks blocks={[{ type: 'KEY_TERMS', terms: view.keyTerms.slice(6) }]} band={band} />}</div>}
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => { setFinished(false); setIndex(0) }}>Read it again</Button>
        {onFinish && <Button onClick={onFinish}>Close lesson</Button>}
      </div>
    </section>}
  </article>
}

/* ---------- learner screen pieces: the lesson link in a plan topic and the lesson panel ---------- */

/** Loads and shows one published teacher lesson. `topicId` is the learner's own clone topic id. A missing lesson is never explained. */
export function TeacherLessonPanel({ planId, topicId, band, onClose }: { planId: string; topicId: string; band: LearnBand; onClose?: () => void }) {
  const { actor } = useLearnIdentity()
  const query = useQuery({
    queryKey: ['learn', actor, 'teacher-lesson', planId, topicId], queryFn: () => learnApi.teacherLesson(planId, topicId),
    enabled: !!actor && !!planId && !!topicId, retry: false, staleTime: 0, gcTime: 0, refetchOnMount: 'always',
  })
  if (query.isPending) return <div role="status" aria-live="polite" data-state="loading" className="ds-card"><span className="sr-only">Loading the lesson</span><div aria-hidden="true" className="h-24 animate-pulse rounded bg-secondary motion-reduce:animate-none" /></div>
  if (query.error) {
    const status = (query.error as { status?: number }).status
    const gone = status === 404 || status === 403
    return <div role="alert" data-state={gone ? 'unavailable-lesson' : 'error'} className="ds-card space-y-3">
      <p className="font-bold">{gone ? 'This lesson is not available right now.' : 'The lesson could not load.'}</p>
      {!gone && <p className="text-muted-foreground">{query.error.message}</p>}
      <div className="flex flex-wrap gap-3">{!gone && <Button onClick={() => void query.refetch()}>Try again</Button>}{onClose && <Button variant="secondary" onClick={onClose}>Close</Button>}</div>
    </div>
  }
  return <TeacherLessonReader key={query.data.version} view={query.data.view} band={band} mode="learner" onFinish={onClose}
    onCheck={(stepIndex, optionId) => learnApi.checkTeacherLesson(planId, topicId, stepIndex, optionId)} />
}

/** Shown in the plan topic panel only when the plan detail carries a published `teacherLesson`. */
export function TeacherLessonLink({ planId, topicId, summary, band }: { planId: string; topicId: string; summary: TeacherLessonSummary; band: LearnBand }) {
  const [open, setOpen] = useState(false)
  const region = useId()
  return <div data-testid="teacher-lesson-link" className="space-y-3">
    <div className="ds-card flex flex-wrap items-center gap-3 border-s-4 border-s-primary">
      <GraduationCap aria-hidden="true" className="size-6 shrink-0 text-primary" />
      <div className="min-w-0 flex-1"><p className="text-[length:var(--ds-small)] font-bold text-muted-foreground">From your teacher</p><p className="break-words font-bold">{summary.title}</p><p className="text-[length:var(--ds-small)] text-muted-foreground">{summary.stepCount} {summary.stepCount === 1 ? 'step' : 'steps'}</p></div>
      <button type="button" aria-expanded={open} aria-controls={region} onClick={() => setOpen(current => !current)} className="ds-button ds-button-primary">{open ? 'Close lesson' : band === 'kids' ? 'Open the lesson' : 'Open lesson'}</button>
    </div>
    <div id={region}>{open && <TeacherLessonPanel planId={planId} topicId={topicId} band={band} onClose={() => setOpen(false)} />}</div>
  </div>
}
