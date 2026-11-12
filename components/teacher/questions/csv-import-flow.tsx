'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, FileUp, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InlineAlert, NativeSelect } from '@/components/teacher/plans/fields'
import { useB13Apis, planTopics } from '@/components/teacher/worksheets/use-b13-apis'
import { EmptyBlock, FailureBlock, LoadingBlock, failureText } from '@/components/teacher/worksheets/states'
import { plural } from '@/components/teacher/plans/plan-format'
import {
  IMPORT_FIELDS, REQUIRED_IMPORT_FIELDS, checkCsvFile, importFieldLabel, importableTypes, typeLabel,
  type ImportMapping, type ImportPreview, type QuestionImport,
} from '@/lib/api/teaching/question-imports'
import { CsvPreviewTable, filterRows, type PreviewFilter } from './csv-preview-table'

/*
 * T4 bulk import (F-T4-06, D10). Steps: 1 Upload, 2 Match columns, 3 Check, 4 Done. The import id lives in the URL so a reload
 * resumes. Policy shown to the teacher: only valid rows are imported, in one go, as drafts; problem rows are skipped and
 * listed; importing twice never doubles anything.
 */
export interface ImportLocation { planId: string | null; importId: string | null }
const STEPS = ['Upload', 'Match columns', 'Check', 'Done'] as const

function Stepper({ current }: { current: number }) {
  return <ol aria-label="Import steps" className="flex flex-wrap gap-2 text-sm" data-testid="csv-steps">
    {STEPS.map((label, index) => <li key={label} aria-current={index === current ? 'step' : undefined} className={`rounded-full border px-3 py-1 ${index === current ? 'border-primary bg-primary/10 font-semibold text-primary' : index < current ? 'border-border bg-muted' : 'border-border text-muted-foreground'}`}>{index + 1}. {label}</li>)}
  </ol>
}

export function CsvImportFlow({ initialPlanId, initialImportId, onLocationChange }: { initialPlanId: string | null; initialImportId: string | null; onLocationChange?: (location: ImportLocation) => void }) {
  const apis = useB13Apis()
  const client = useQueryClient()
  const [planId, setPlanId] = useState<string | null>(initialPlanId)
  const [importId, setImportId] = useState<string | null>(initialImportId)
  const move = (next: Partial<ImportLocation>) => {
    const location = { planId: 'planId' in next ? next.planId ?? null : planId, importId: 'importId' in next ? next.importId ?? null : importId }
    setPlanId(location.planId); setImportId(location.importId); onLocationChange?.(location)
  }

  const plansQuery = useQuery({ queryKey: ['b13', apis.schoolId, 'plan-choices'], queryFn: () => apis.plans.list({ limit: 50 }), enabled: planId === null, retry: false, staleTime: 0, refetchOnWindowFocus: false })
  const planQuery = useQuery({ queryKey: ['b13', apis.schoolId, 'plan', planId], queryFn: () => apis.plans.get(planId!), enabled: planId !== null, retry: false, staleTime: 0, refetchOnWindowFocus: false })
  const importQuery = useQuery({ queryKey: ['b13', apis.schoolId, 'import', importId], queryFn: () => apis.imports.get(importId!), enabled: importId !== null, retry: false, staleTime: 0, gcTime: 0, refetchOnWindowFocus: false })

  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [editingMapping, setEditingMapping] = useState(false)
  const [result, setResult] = useState<{ committedCount: number; skippedCount: number } | null>(null)

  const record = importQuery.data ?? null
  const topics = useMemo(() => planTopics(planQuery.data?.tree ?? []), [planQuery.data])
  const topicTitles = useMemo(() => Object.fromEntries(topics.map(topic => [topic.id, topic.title])), [topics])
  const currentPreview = preview ?? record?.preview ?? null
  const committed = result ?? (record?.status === 'COMMITTED' ? { committedCount: record.committedCount ?? 0, skippedCount: record.skippedCount ?? 0 } : null)
  const step = committed ? 3 : record?.status === 'EXPIRED' ? 0 : currentPreview && !editingMapping ? 2 : record ? 1 : 0

  const planTitle = planQuery.data?.title

  return <div className="space-y-5" data-testid="csv-import" data-step={STEPS[step]}>
    <Button asChild variant="ghost" size="lg" className="-ms-2"><Link href={planId ? `/teacher/plans/${encodeURIComponent(planId)}` : '/teacher/plans'}><ArrowLeft aria-hidden="true" className="rtl:rotate-180" />{planId ? 'Back to plan' : 'All plans'}</Link></Button>
    <Stepper current={step} />
    {planTitle && <p className="text-sm text-muted-foreground" data-testid="csv-plan">Importing into <span className="font-semibold text-foreground">{planTitle}</span></p>}

    {planId === null && <PlanChoice query={plansQuery} onChoose={choice => move({ planId: choice })} />}
    {planId !== null && planQuery.isError && <FailureBlock error={planQuery.error} onRetry={() => void planQuery.refetch()} subject="this plan" testId="csv-plan-failure" />}

    {planId !== null && !planQuery.isError && importId !== null && importQuery.isPending && <LoadingBlock label="Opening your import" testId="csv-loading" />}
    {planId !== null && importId !== null && importQuery.isError && <div className="space-y-3">
      <FailureBlock error={importQuery.error} onRetry={() => void importQuery.refetch()} subject="this import" testId="csv-import-failure" />
      <Button variant="outline" size="lg" onClick={() => move({ importId: null })}>Start a new import</Button>
    </div>}

    {planId !== null && !planQuery.isError && importId === null && <UploadStep planId={planId} onUploaded={uploaded => { setPreview(null); setResult(null); setEditingMapping(false); client.setQueryData(['b13', apis.schoolId, 'import', uploaded.id], uploaded); move({ importId: uploaded.id }) }} />}

    {planId !== null && record && record.status === 'EXPIRED' && <div className="space-y-3" data-testid="csv-expired">
      <InlineAlert tone="warning">This import expired. Imports are kept for 24 hours. Upload the file again to continue.</InlineAlert>
      <Button size="lg" onClick={() => move({ importId: null })}><Upload aria-hidden="true" />Upload again</Button>
    </div>}

    {planId !== null && record && record.status !== 'EXPIRED' && step === 1 && <MappingStep record={record} topics={topics} onPreview={next => { setPreview(next); setEditingMapping(false) }} />}
    {planId !== null && record && step === 2 && currentPreview && <PreviewStep record={record} preview={currentPreview} topicTitles={topicTitles}
      onEditMapping={() => setEditingMapping(true)} onCommitted={done => setResult(done)} onExpired={() => void importQuery.refetch()} />}
    {planId !== null && record && step === 3 && committed && <DoneStep planId={planId} summary={committed} onAgain={() => { setPreview(null); setResult(null); move({ importId: null }) }} />}
  </div>
}

function PlanChoice({ query, onChoose }: { query: { isPending: boolean; isError: boolean; error: unknown; data?: { items: { id: string; title: string; status: string; scope: { classLabel: string; subject: string } }[] }; refetch: () => unknown }; onChoose: (planId: string) => void }) {
  const [choice, setChoice] = useState('')
  if (query.isPending) return <LoadingBlock label="Loading your plans" testId="csv-plans-loading" />
  if (query.isError) return <FailureBlock error={query.error} onRetry={() => void query.refetch()} subject="your plans" testId="csv-plans-failure" />
  const plans = (query.data?.items ?? []).filter(plan => plan.status !== 'ARCHIVED')
  if (plans.length === 0) return <EmptyBlock testId="csv-no-plans" title="No plans to import into">Create a teaching plan first. Questions always belong to a plan.</EmptyBlock>
  return <form className="max-w-lg space-y-3 rounded-xl border border-border bg-card p-4" onSubmit={event => { event.preventDefault(); if (choice) onChoose(choice) }} data-testid="csv-plan-choice">
    <NativeSelect label="Which plan are these questions for?" value={choice} onChange={event => setChoice(event.target.value)}>
      <option value="">Choose a plan</option>
      {plans.map(plan => <option key={plan.id} value={plan.id}>{plan.title} · {plan.scope.classLabel} · {plan.scope.subject}</option>)}
    </NativeSelect>
    <Button type="submit" size="lg" aria-disabled={!choice} disabled={!choice}>Continue</Button>
  </form>
}

function UploadStep({ planId, onUploaded }: { planId: string; onUploaded: (record: QuestionImport) => void }) {
  const apis = useB13Apis()
  const [file, setFile] = useState<File | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  async function choose(next: File | null) {
    setFailure(null); setFile(null); setProblem(null)
    if (!next) return
    const check = await checkCsvFile(next)
    if (check) setProblem(check.problem); else setFile(next)
  }
  async function submit() {
    if (!file || busy) return
    setBusy(true); setFailure(null)
    try { onUploaded(await apis.imports.upload(planId, file)) } catch (error) { setFailure(failureText(error)) } finally { setBusy(false) }
  }
  return <section className="space-y-4 rounded-xl border border-border bg-card p-4" aria-labelledby="csv-upload-title" data-testid="csv-upload">
    <div className="space-y-1">
      <h2 id="csv-upload-title" className="text-lg font-bold">Upload your questions</h2>
      <p className="text-sm text-muted-foreground">A CSV file with one question per row and a header row. Up to 500 questions and 1 MB. Comma or semicolon separated, UTF-8. Nothing is added to your bank until you check and confirm.</p>
    </div>
    <div className="space-y-1.5">
      <label htmlFor="csv-file" className="block text-sm font-medium">CSV file</label>
      <input id="csv-file" ref={input} type="file" accept=".csv,text/csv" data-testid="csv-file" aria-describedby={problem ? 'csv-file-problem' : undefined} aria-invalid={problem ? true : undefined}
        onChange={event => void choose(event.target.files?.[0] ?? null)} className="block w-full max-w-lg text-sm file:me-3 file:rounded-lg file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium" />
      {file && <p className="text-xs text-muted-foreground" data-testid="csv-file-name">{file.name} · {(file.size / 1024).toFixed(1)} KB</p>}
    </div>
    {problem && <InlineAlert testId="csv-file-problem">{problem}</InlineAlert>}
    {failure && <InlineAlert testId="csv-upload-failure">{failure}</InlineAlert>}
    <details className="rounded-lg border border-border p-3 text-sm">
      <summary className="cursor-pointer font-semibold">Which columns can I use?</summary>
      <p className="mt-2 text-muted-foreground">{IMPORT_FIELDS.map(field => importFieldLabel[field]).join(', ')}. You match your own column names on the next step. Code and picture-choice questions cannot be imported; write those in the editor.</p>
      <ul className="mt-2 list-disc space-y-1 ps-5 text-muted-foreground" data-testid="csv-rules">
        <li>Row numbers in the preview match your spreadsheet: the header is row 1, so your first question is row 2.</li>
        <li>Multiple choice: put the letter of the right option (A to H) in the correct-answer column. Select all that apply: several letters separated by <code>;</code>, for example <code>A;C</code>.</li>
        <li>Fill in the blank: write ___ in the question for each blank. In the correct-answer column, separate the blanks with <code>|</code> and the accepted answers inside one blank with <code>;</code>, for example <code>Paris;paris|France</code>.</li>
        <li>True or false: <code>true</code> or <code>false</code>. Ordering: the letters in the right order, for example <code>C;A;B</code>. Short and long answer: the model answer, plus a marking guide.</li>
      </ul>
    </details>
    <Button size="lg" onClick={() => void submit()} disabled={!file || busy} aria-disabled={!file || busy} data-testid="csv-upload-submit"><FileUp aria-hidden="true" />{busy ? 'Uploading' : 'Upload and continue'}</Button>
    {!file && !problem && <p className="text-xs text-muted-foreground">Choose a file to continue.</p>}
  </section>
}

function MappingStep({ record, topics, onPreview }: { record: QuestionImport; topics: { id: string; title: string; depth: number }[]; onPreview: (preview: ImportPreview) => void }) {
  const apis = useB13Apis()
  const initial = useMemo<ImportMapping>(() => {
    const source = record.mapping ?? record.suggestedMapping ?? {}
    return Object.fromEntries(IMPORT_FIELDS.map(field => [field, source[field] && record.headers.includes(source[field]!) ? source[field]! : null]))
  }, [record])
  const [mapping, setMapping] = useState<ImportMapping>(initial)
  const [defaultTopicId, setDefaultTopicId] = useState(record.defaultTopicId ?? '')
  const [defaultType, setDefaultType] = useState(record.defaultType ?? '')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  useEffect(() => { setMapping(initial) }, [initial])

  const missing = REQUIRED_IMPORT_FIELDS.filter(field => !mapping[field])
  const blocked = missing.length > 0
  const mappedHeaders = Object.values(mapping).filter(Boolean) as string[]
  const duplicates = mappedHeaders.filter((header, index) => mappedHeaders.indexOf(header) !== index)

  async function submit() {
    if (blocked || busy) return
    setBusy(true); setFailure(null)
    try { onPreview(await apis.imports.setMapping(record.id, { mapping, defaultTopicId: defaultTopicId || null, defaultType: defaultType || null })) } catch (error) { setFailure(failureText(error)) } finally { setBusy(false) }
  }
  return <section className="space-y-4 rounded-xl border border-border bg-card p-4" aria-labelledby="csv-map-title" data-testid="csv-mapping">
    <div className="space-y-1">
      <h2 id="csv-map-title" className="text-lg font-bold">Match your columns</h2>
      <p className="text-sm text-muted-foreground">{record.fileName ? `${record.fileName}: ` : ''}{plural(record.rowCount, 'question row')} found. We guessed the matches from your header names. Check them, then see a preview.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {IMPORT_FIELDS.map(field => <NativeSelect key={field} label={`${importFieldLabel[field]}${REQUIRED_IMPORT_FIELDS.includes(field) ? ' (required)' : ''}`} data-testid={`map-${field}`}
        value={mapping[field] ?? ''} aria-invalid={REQUIRED_IMPORT_FIELDS.includes(field) && !mapping[field] ? true : undefined}
        onChange={event => setMapping(current => ({ ...current, [field]: event.target.value || null }))}>
        <option value="">Not in my file</option>
        {record.headers.map(header => <option key={header} value={header}>{header}</option>)}
      </NativeSelect>)}
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <NativeSelect label="Default topic" hint="Used when a row's topic is empty or does not match a topic title in this plan." data-testid="map-default-topic" value={defaultTopicId} onChange={event => setDefaultTopicId(event.target.value)}>
        <option value="">No default topic</option>
        {topics.map(topic => <option key={topic.id} value={topic.id}>{' '.repeat(topic.depth * 2)}{topic.title}</option>)}
      </NativeSelect>
      <NativeSelect label="Default question type" hint="Used when a row has no type, or you have no type column." data-testid="map-default-type" value={defaultType} onChange={event => setDefaultType(event.target.value)}>
        <option value="">No default type</option>
        {importableTypes.map(type => <option key={type} value={type}>{typeLabel[type]}</option>)}
      </NativeSelect>
    </div>
    {duplicates.length > 0 && <InlineAlert tone="warning" testId="map-duplicate-columns">The same column is matched more than once ({[...new Set(duplicates)].join(', ')}). That is allowed, but check it is what you meant.</InlineAlert>}
    {blocked && <InlineAlert tone="info" testId="map-blocked">Match {missing.map(field => importFieldLabel[field]).join(' and ')} to continue.</InlineAlert>}
    {failure && <InlineAlert testId="map-failure">{failure}</InlineAlert>}
    <Button size="lg" onClick={() => void submit()} disabled={blocked || busy} aria-disabled={blocked || busy} data-testid="map-submit">{busy ? 'Checking your rows' : 'Preview questions'}</Button>
  </section>
}

function PreviewStep({ record, preview, topicTitles, onEditMapping, onCommitted, onExpired }: {
  record: QuestionImport; preview: ImportPreview; topicTitles: Record<string, string>
  onEditMapping: () => void; onCommitted: (result: { committedCount: number; skippedCount: number }) => void; onExpired: () => void
}) {
  const apis = useB13Apis()
  const [filter, setFilter] = useState<PreviewFilter>('all')
  const [includeDuplicates, setIncludeDuplicates] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const duplicates = preview.rows.filter(row => row.status === 'DUPLICATE_SUGGESTION').length
  const problems = preview.rows.filter(row => row.status === 'INVALID').length
  const willImport = preview.validCount + (includeDuplicates ? duplicates : 0)
  const rows = filterRows(preview.rows, filter)

  async function commit() {
    if (willImport === 0 || busy) return
    setBusy(true); setFailure(null)
    try {
      const done = await apis.imports.commit(record.id, includeDuplicates)
      onCommitted({ committedCount: done.committedCount, skippedCount: done.skippedCount })
    } catch (error) {
      setFailure(failureText(error))
      if ((error as { status?: number }).status === 410) onExpired()
    } finally { setBusy(false) }
  }
  const tabs: { key: PreviewFilter; label: string; n: number }[] = [{ key: 'all', label: 'All rows', n: preview.rows.length }, { key: 'problems', label: 'Needs fixing', n: problems }, { key: 'duplicates', label: 'Possible duplicates', n: duplicates }]
  return <section className="space-y-4" aria-labelledby="csv-preview-title" data-testid="csv-preview">
    <div className="space-y-1 rounded-xl border border-border bg-card p-4">
      <h2 id="csv-preview-title" className="text-lg font-bold">Check before importing</h2>
      <p className="text-sm" data-testid="csv-counts"><span data-testid="csv-valid">{plural(preview.validCount, 'question')} ready</span> · <span data-testid="csv-invalid">{plural(preview.invalidCount, 'row')} with a problem</span> · <span data-testid="csv-dups">{plural(duplicates, 'possible duplicate')}</span></p>
      <p className="text-sm text-muted-foreground" data-testid="csv-policy">Only rows that are ready are imported, together, as drafts you can review and publish. Rows with a problem are skipped, not guessed at: fix them in your file and import again. Importing the same file twice from this page never adds a question twice.</p>
    </div>
    <div role="group" aria-label="Show rows" className="flex flex-wrap gap-2">
      {tabs.map(tab => <Button key={tab.key} type="button" size="lg" variant={filter === tab.key ? 'default' : 'outline'} aria-pressed={filter === tab.key} onClick={() => setFilter(tab.key)} data-testid={`csv-filter-${tab.key}`}>{tab.label} ({tab.n})</Button>)}
    </div>
    <CsvPreviewTable rows={rows} topicTitles={topicTitles} />
    {duplicates > 0 && <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm" data-testid="csv-include-dups">
      <input type="checkbox" className="mt-0.5 size-4" checked={includeDuplicates} onChange={event => setIncludeDuplicates(event.target.checked)} />
      <span><span className="font-semibold">Also import the {plural(duplicates, 'possible duplicate')}.</span> These look like questions you already have, or like another row in this file. Duplicates are only suggestions; you decide.</span>
    </label>}
    {failure && <InlineAlert testId="csv-commit-failure">{failure} Nothing was imported; you can try again.</InlineAlert>}
    <div className="flex flex-wrap gap-2">
      <Button size="lg" onClick={() => void commit()} disabled={willImport === 0 || busy} aria-disabled={willImport === 0 || busy} data-testid="csv-commit">{busy ? 'Importing' : `Import ${plural(willImport, 'question')}`}</Button>
      <Button size="lg" variant="outline" onClick={onEditMapping} disabled={busy} data-testid="csv-edit-mapping">Change column matches</Button>
    </div>
    {willImport === 0 && <p className="text-xs text-muted-foreground">There is nothing ready to import. Fix the file and upload it again, or change the column matches.</p>}
  </section>
}

function DoneStep({ planId, summary, onAgain }: { planId: string; summary: { committedCount: number; skippedCount: number }; onAgain: () => void }) {
  return <section className="space-y-3 rounded-xl border border-border bg-card p-4" aria-labelledby="csv-done-title" data-testid="csv-done">
    <h2 id="csv-done-title" className="flex items-center gap-2 text-lg font-bold"><CheckCircle2 aria-hidden="true" className="size-5 text-primary" />Import finished</h2>
    <p role="status" className="text-sm" data-testid="csv-summary"><span data-testid="csv-committed">{plural(summary.committedCount, 'question')} added as drafts</span>. <span data-testid="csv-skipped">{plural(summary.skippedCount, 'row')} skipped</span>.</p>
    <p className="text-sm text-muted-foreground">Imported questions are drafts. Open them in the question bank to review, edit and publish. Learners only ever see published questions.</p>
    <div className="flex flex-wrap gap-2">
      <Button asChild size="lg" data-testid="csv-open-bank"><Link href={`/teacher/questions?planId=${encodeURIComponent(planId)}&origin=CSV&status=DRAFT`}>Review imported questions</Link></Button>
      <Button size="lg" variant="outline" onClick={onAgain}>Import another file</Button>
    </div>
  </section>
}
