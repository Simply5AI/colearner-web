'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ArrowDown, ArrowLeft, ArrowUp, Check, KeyRound, Printer, Save, Trash2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api/client'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { InlineAlert } from '@/components/teacher/plans/fields'
import { WorksheetBankPicker } from '@/components/teacher/questions/worksheet-bank-picker'
import { IntentKey, teachingErrorInfo } from '@/lib/api/teaching/plans'
import { typeLabel } from '@/lib/api/teaching/question-imports'
import {
  DEFAULT_SETTINGS, WORKSHEET_MAX_ITEMS, totalPoints,
  type BankQuestion, type Worksheet, type WorksheetItem, type WorksheetSettings,
} from '@/lib/api/teaching/worksheets'
import { WorksheetFillDialog, type FillRequest } from './worksheet-fill-dialog'
import { WorksheetStatusChip, worksheetKey, worksheetsKey } from './worksheets-list'
import { EmptyBlock, FailureBlock, LoadingBlock, failureText } from './states'
import { planTopics, useB13Apis } from './use-b13-apis'

interface Draft { title: string; instructions: string; items: WorksheetItem[]; settings: WorksheetSettings }
const draftOf = (sheet: Worksheet): Draft => ({ title: sheet.title, instructions: sheet.instructions, items: [...sheet.items].sort((a, b) => a.sortOrder - b.sortOrder), settings: sheet.settings ?? DEFAULT_SETTINGS })
const renumber = (items: WorksheetItem[]) => items.map((item, index) => ({ ...item, sortOrder: index }))
const same = (a: Draft, b: Draft) => JSON.stringify({ ...a, items: renumber(a.items) }) === JSON.stringify({ ...b, items: renumber(b.items) })
interface Label { prompt: string; type: string; available?: boolean }

/** Build a worksheet (F: worksheets). DRAFT is editable; FINAL and ARCHIVED are read-only with a visible reason. */
export function WorksheetBuilder({ planId, worksheetId }: { planId: string; worksheetId: string }) {
  const apis = useB13Apis()
  const client = useQueryClient()
  const detailQuery = useQuery({ queryKey: worksheetKey(apis.schoolId, worksheetId), queryFn: () => apis.worksheets.get(worksheetId), retry: false, staleTime: 0, gcTime: 0, refetchOnWindowFocus: false })
  const planQuery = useQuery({ queryKey: ['b13', apis.schoolId, 'plan', planId], queryFn: () => apis.plans.get(planId), retry: false, staleTime: 0, refetchOnWindowFocus: false })
  const [sheet, setSheet] = useState<Worksheet | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [labels, setLabels] = useState<Record<string, Label>>({})
  const [notice, setNotice] = useState('')
  const [failure, setFailure] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [busy, setBusy] = useState<null | 'save' | 'fill' | 'finalize' | 'archive'>(null)
  const [dialog, setDialog] = useState<null | 'fill' | 'finalize' | 'archive'>(null)
  const [fillFailure, setFillFailure] = useState<string | null>(null)
  const finalizeKey = useRef(new IntentKey())
  const archiveKey = useRef(new IntentKey())
  const fillKey = useRef(new IntentKey())
  const topics = useMemo(() => planTopics(planQuery.data?.tree ?? []), [planQuery.data])

  const found = detailQuery.data ?? null
  // `GET /worksheets/:id` carries each item's prompt preview, type and availability, so rows never depend on the list or a render.
  useEffect(() => {
    if (!found) return
    if (!sheet) { setSheet(found); setDraft(draftOf(found)) }
    setLabels(current => ({ ...current, ...Object.fromEntries(found.items.map(item => [item.questionId, { prompt: item.promptPreview, type: item.type ?? '', available: item.available }])) }))
  }, [found, sheet])

  const editable = sheet?.status === 'DRAFT'
  const dirty = Boolean(sheet && draft && !same(draft, draftOf(sheet)))
  const readOnlyReason = sheet?.status === 'FINAL' ? 'This worksheet is final, so its questions are frozen. Make a new worksheet to change them.' : sheet?.status === 'ARCHIVED' ? 'This worksheet is archived and read-only.' : null
  const base = `/teacher/plans/${encodeURIComponent(planId)}/worksheets/${encodeURIComponent(worksheetId)}`

  function patch(next: Partial<Draft>) { setDraft(current => (current ? { ...current, ...next } : current)); setNotice('') }
  function add(question: BankQuestion) {
    if (!draft || !editable || draft.items.length >= WORKSHEET_MAX_ITEMS || draft.items.some(item => item.questionId === question.id)) return
    setLabels(current => ({ ...current, [question.id]: { prompt: question.promptPreview, type: question.type } }))
    patch({ items: renumber([...draft.items, { questionId: question.id, questionVersion: question.version, sortOrder: draft.items.length, points: 1 }]) })
    setNotice(`Added question ${draft.items.length + 1}.`)
  }
  function move(index: number, direction: -1 | 1) {
    if (!draft) return
    const target = index + direction
    if (target < 0 || target >= draft.items.length) return
    const items = [...draft.items]; [items[index], items[target]] = [items[target]!, items[index]!]
    patch({ items: renumber(items) }); setNotice(`Question moved to position ${target + 1}.`)
  }
  function remove(index: number) { if (!draft) return; patch({ items: renumber(draft.items.filter((_, position) => position !== index)) }); setNotice('Question removed.') }
  function setPoints(index: number, value: number) {
    if (!draft) return
    const points = Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0
    patch({ items: draft.items.map((item, position) => (position === index ? { ...item, points } : item)) })
  }

  function onError(error: unknown, scope: 'page' | 'fill' = 'page') {
    const info = teachingErrorInfo(error)
    if (info.code === 'VERSION_CONFLICT' || info.status === 409) { setConflict(true); return }
    if (scope === 'fill') setFillFailure(failureText(error)); else setFailure(failureText(error))
  }
  async function reload() {
    setConflict(false); setFailure(null)
    const fresh = await detailQuery.refetch()
    const next = fresh.data
    if (next) { setSheet(next); setDraft(draftOf(next)); setNotice('Loaded the latest version.') }
  }
  async function save(): Promise<Worksheet | null> {
    if (!sheet || !draft) return null
    setBusy('save'); setFailure(null); setConflict(false)
    try {
      const saved = await apis.worksheets.save(sheet.id, { title: draft.title.trim() || 'Untitled worksheet', instructions: draft.instructions, items: renumber(draft.items), settings: draft.settings, expectedVersion: sheet.version })
      setSheet(saved); setDraft(draftOf(saved)); setNotice('Saved.')
      void client.invalidateQueries({ queryKey: worksheetsKey(apis.schoolId, planId) })
      void detailQuery.refetch()
      return saved
    } catch (error) { onError(error); return null } finally { setBusy(null) }
  }
  async function fill(request: FillRequest) {
    if (!sheet) return
    setFillFailure(null)
    let current: Worksheet | null = sheet
    if (dirty) { current = await save(); if (!current) { setDialog(null); return } }
    setBusy('fill')
    try {
      const result = await apis.worksheets.fill(current.id, request, fillKey.current.keyFor(request))
      fillKey.current.done()
      const before = current.items.length
      setSheet(result.worksheet); setDraft(draftOf(result.worksheet)); setDialog(null)
      void client.invalidateQueries({ queryKey: worksheetsKey(apis.schoolId, planId) })
      void detailQuery.refetch()
      const added = result.worksheet.items.length - before
      setNotice(result.shortfall > 0 ? `Added ${added}. Only ${added} matching published questions were available, ${result.shortfall} short.` : `Added ${added} questions.`)
    } catch (error) { onError(error, 'fill'); if (teachingErrorInfo(error).status === 409) setDialog(null) } finally { setBusy(null) }
  }
  async function lifecycle(kind: 'finalize' | 'archive') {
    if (!sheet) return
    let current: Worksheet | null = sheet
    if (kind === 'finalize' && dirty) { current = await save(); if (!current) { setDialog(null); return } }
    setBusy(kind); setFailure(null)
    try {
      const keyring = kind === 'finalize' ? finalizeKey.current : archiveKey.current
      const result = kind === 'finalize' ? await apis.worksheets.finalize(current.id, keyring.keyFor({ id: current.id, v: current.version })) : await apis.worksheets.archive(current.id, keyring.keyFor({ id: current.id, v: current.version }))
      keyring.done()
      setSheet(result); setDraft(draftOf(result)); setDialog(null); setNotice(kind === 'finalize' ? 'Worksheet finalised. Its questions are frozen.' : 'Worksheet archived.')
      void client.invalidateQueries({ queryKey: worksheetsKey(apis.schoolId, planId) })
      void detailQuery.refetch()
    } catch (error) { setDialog(null); onError(error) } finally { setBusy(null) }
  }

  if (detailQuery.isPending) return <LoadingBlock label="Opening the worksheet" testId="wsb-loading" />
  if (detailQuery.isError && !sheet) return <div className="space-y-3"><FailureBlock error={detailQuery.error} onRetry={() => void detailQuery.refetch()} subject="this worksheet" testId="wsb-failure" /><Button asChild variant="outline" size="lg"><Link href={`/teacher/plans/${encodeURIComponent(planId)}/worksheets`}>Back to worksheets</Link></Button></div>
  if (!found && !sheet) return <div className="space-y-3"><FailureBlock error={new ApiError(404, 'Not found')} testId="wsb-missing" subject="this worksheet" /><Button asChild variant="outline" size="lg"><Link href={`/teacher/plans/${encodeURIComponent(planId)}/worksheets`}>Back to worksheets</Link></Button></div>
  if (!sheet || !draft) return <LoadingBlock label="Opening the worksheet" testId="wsb-loading" />

  const addedIds = new Set(draft.items.map(item => item.questionId))
  const full = draft.items.length >= WORKSHEET_MAX_ITEMS
  const bankReason = readOnlyReason ?? (full ? `A worksheet holds at most ${WORKSHEET_MAX_ITEMS} questions.` : null)
  const locked = !editable
  const field = 'w-full rounded-lg border border-input bg-background px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 md:text-sm'

  return <div className="space-y-5" data-testid="ws-builder" data-status={sheet.status}>
    <Button asChild variant="ghost" size="lg" className="-ms-2"><Link href={`/teacher/plans/${encodeURIComponent(planId)}/worksheets`}><ArrowLeft aria-hidden="true" className="rtl:rotate-180" />All worksheets</Link></Button>
    <header className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-extrabold">Worksheet</h2><WorksheetStatusChip status={sheet.status} />{dirty && <span className="text-xs font-semibold text-muted-foreground" data-testid="wsb-dirty">Unsaved changes</span>}</div>
        <div className="flex flex-wrap gap-2">
          {editable && <Button size="lg" onClick={() => void save()} disabled={!dirty || busy !== null} aria-disabled={!dirty || busy !== null} data-testid="wsb-save"><Save aria-hidden="true" />{busy === 'save' ? 'Saving' : 'Save'}</Button>}
          {editable && <Button size="lg" variant="outline" onClick={() => setDialog('finalize')} disabled={draft.items.length === 0 || busy !== null} aria-disabled={draft.items.length === 0 || busy !== null} data-testid="wsb-finalize">
            <Check aria-hidden="true" />Finalise</Button>}
          {sheet.items.length > 0 && <Button asChild size="lg" variant="outline"><Link href={`${base}/print`} data-testid="wsb-print"><Printer aria-hidden="true" />A4 print page</Link></Button>}
          {sheet.items.length > 0 && <Button asChild size="lg" variant="outline"><Link href={`${base}/answer-key`} data-testid="wsb-key"><KeyRound aria-hidden="true" />Answer key</Link></Button>}
          {sheet.status !== 'ARCHIVED' && <Button size="lg" variant="outline" onClick={() => setDialog('archive')} disabled={busy !== null} data-testid="wsb-archive"><Archive aria-hidden="true" />Archive</Button>}
        </div>
      </div>
      {editable && draft.items.length === 0 && <p className="text-xs text-muted-foreground" data-testid="wsb-finalize-reason">Add at least one question to finalise.</p>}
      {readOnlyReason && <InlineAlert tone="locked" testId="wsb-locked">{readOnlyReason}</InlineAlert>}
      {conflict && <InlineAlert tone="warning" testId="wsb-conflict"><p className="font-semibold">This worksheet changed somewhere else, for example in another tab. Your last edits were not saved.</p><Button className="mt-2" variant="outline" size="lg" onClick={() => void reload()}>Load the latest</Button></InlineAlert>}
      {failure && <InlineAlert testId="wsb-failure-inline">{failure}</InlineAlert>}
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground" data-testid="wsb-notice">{notice}</p>
    </header>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-5">
        <section className="space-y-3 rounded-xl border border-border bg-card p-4" aria-labelledby="wsb-details-title">
          <h3 id="wsb-details-title" className="text-base font-bold">Details</h3>
          <div className="space-y-1.5"><label htmlFor="wsb-title" className="block text-sm font-medium">Title</label>
            <input id="wsb-title" value={draft.title} maxLength={120} disabled={locked} onChange={event => patch({ title: event.target.value })} className={`h-9 ${field}`} data-testid="wsb-title" /></div>
          <div className="space-y-1.5"><label htmlFor="wsb-instructions" className="block text-sm font-medium">Instructions for students</label>
            <textarea id="wsb-instructions" rows={3} value={draft.instructions} maxLength={1000} disabled={locked} onChange={event => patch({ instructions: event.target.value })} className={`py-1.5 ${field}`} data-testid="wsb-instructions" /></div>
          <fieldset className="space-y-2" disabled={locked}><legend className="text-sm font-medium">Print settings</legend>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={draft.settings.includeName} onChange={event => patch({ settings: { ...draft.settings, includeName: event.target.checked } })} data-testid="wsb-name" />Add a name and date line</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={draft.settings.showHints} onChange={event => patch({ settings: { ...draft.settings, showHints: event.target.checked } })} data-testid="wsb-hints" />Print hints under questions</label>
            <div className="flex items-center gap-2 text-sm"><label htmlFor="wsb-lines">Answer lines for written answers</label>
              <input id="wsb-lines" type="number" min={0} max={12} value={draft.settings.answerLines} onChange={event => patch({ settings: { ...draft.settings, answerLines: Math.max(0, Math.min(12, Math.round(Number(event.target.value) || 0))) } })} className="h-9 w-20 rounded-lg border border-input bg-background px-2.5 text-base md:text-sm" data-testid="wsb-lines" /></div>
          </fieldset>
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-card p-4" aria-labelledby="wsb-items-title" data-testid="wsb-items-section">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="wsb-items-title" className="text-base font-bold">Questions <span className="font-normal text-muted-foreground" data-testid="wsb-total">({draft.items.length} · {totalPoints(draft.items)} {totalPoints(draft.items) === 1 ? 'mark' : 'marks'})</span></h3>
            <Button size="lg" variant="outline" onClick={() => { setFillFailure(null); setDialog('fill') }} disabled={locked || full || busy !== null} aria-disabled={locked || full || busy !== null} data-testid="wsb-fill"><Wand2 aria-hidden="true" />Fill for me</Button>
          </div>
          {draft.items.length === 0
            ? <EmptyBlock testId="wsb-empty" title="No questions yet">{locked ? 'This worksheet has no questions.' : 'Add published questions from the list, or use Fill for me.'}</EmptyBlock>
            : <ol className="space-y-2" aria-label="Worksheet questions" data-testid="wsb-items">{draft.items.map((item, index) => {
              const label = labels[item.questionId]
              return <li key={item.questionId} className="flex flex-wrap items-start gap-3 rounded-lg border border-border p-3" data-testid="wsb-item" data-question={item.questionId}>
                <span className="w-6 pt-1 text-sm font-bold tabular-nums" aria-hidden="true">{index + 1}.</span>
                <div className="min-w-0 flex-1 space-y-1 text-sm"><p className="break-words">{label?.prompt || 'Question (loading its text)'}</p>{label?.available === false && <p className="text-xs font-semibold text-destructive" data-testid="wsb-unavailable">No longer published. Remove it before finalising.</p>}<p className="text-xs text-muted-foreground">{label ? typeLabel[label.type] ?? label.type : ''} · version {item.questionVersion}</p></div>
                <div className="flex items-center gap-1">
                  <label htmlFor={`pts-${item.questionId}`} className="text-xs text-muted-foreground">Marks</label>
                  <input id={`pts-${item.questionId}`} type="number" min={0} max={100} value={item.points} disabled={locked} onChange={event => setPoints(index, Number(event.target.value))} className="h-9 w-16 rounded-lg border border-input bg-background px-2 text-base disabled:opacity-60 md:text-sm" data-testid="wsb-points" />
                </div>
                {!locked && <div className="flex gap-1">
                  <Button size="icon-lg" variant="outline" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move question ${index + 1} up`} data-testid="wsb-up"><ArrowUp aria-hidden="true" /></Button>
                  <Button size="icon-lg" variant="outline" onClick={() => move(index, 1)} disabled={index === draft.items.length - 1} aria-label={`Move question ${index + 1} down`} data-testid="wsb-down"><ArrowDown aria-hidden="true" /></Button>
                  <Button size="icon-lg" variant="outline" onClick={() => remove(index)} aria-label={`Remove question ${index + 1}`} data-testid="wsb-remove"><Trash2 aria-hidden="true" /></Button>
                </div>}
              </li>
            })}</ol>}
        </section>
      </div>
      <div className="min-w-0"><WorksheetBankPicker planId={planId} topics={topics} addedIds={addedIds} disabledReason={bankReason} onAdd={add} /></div>
    </div>

    <WorksheetFillDialog open={dialog === 'fill'} onOpenChange={open => setDialog(open ? 'fill' : null)} topics={topics} remaining={WORKSHEET_MAX_ITEMS - draft.items.length} busy={busy === 'fill' || busy === 'save'} failure={fillFailure} onFill={request => void fill(request)} />
    <Dialog open={dialog === 'finalize' || dialog === 'archive'} onOpenChange={open => { if (!open && busy === null) setDialog(null) }}>
      <DialogContent data-testid="wsb-confirm">
        <DialogHeader>
          <DialogTitle>{dialog === 'archive' ? 'Archive this worksheet?' : 'Finalise this worksheet?'}</DialogTitle>
          <DialogDescription>{dialog === 'archive' ? 'Archived worksheets are read-only and hidden from the list by default. The questions in your bank are not affected.' : 'Finalising freezes the questions at their current versions. If a question is later edited or archived, this worksheet still prints as it is now. You cannot change a final worksheet.'}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => setDialog(null)} disabled={busy !== null}>Cancel</Button>
          <Button size="lg" variant={dialog === 'archive' ? 'destructive' : 'default'} disabled={busy !== null} data-testid="wsb-confirm-go" onClick={() => dialog && void lifecycle(dialog === 'archive' ? 'archive' : 'finalize')}>{busy === 'finalize' || busy === 'archive' ? 'Working' : dialog === 'archive' ? 'Archive worksheet' : 'Finalise worksheet'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
}
