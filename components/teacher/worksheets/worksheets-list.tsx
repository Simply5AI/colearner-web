'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FilePlus2, FileText, KeyRound, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { InlineAlert } from '@/components/teacher/plans/fields'
import { dateText, plural } from '@/components/teacher/plans/plan-format'
import { IntentKey } from '@/lib/api/teaching/plans'
import { totalPoints, type Worksheet, type WorksheetStatus } from '@/lib/api/teaching/worksheets'
import { useB13Apis } from './use-b13-apis'
import { EmptyBlock, FailureBlock, LoadingBlock, failureText } from './states'

const statusWords: Record<WorksheetStatus, string> = { DRAFT: 'Draft', FINAL: 'Final', ARCHIVED: 'Archived' }
export function WorksheetStatusChip({ status }: { status: WorksheetStatus }) {
  return <span data-status={status} className={`inline-flex h-5 items-center rounded-full border px-2 text-xs font-semibold ${status === 'FINAL' ? 'border-primary/40 bg-primary/10 text-primary' : status === 'ARCHIVED' ? 'border-border bg-muted text-muted-foreground' : 'border-border bg-background'}`}>{statusWords[status]}</span>
}

export const worksheetKey = (schoolId: string, worksheetId: string) => ['b13', schoolId, 'worksheet', worksheetId] as const
export const worksheetsKey = (schoolId: string, planId: string) => ['b13', schoolId, 'worksheets', planId] as const

export function WorksheetsList({ planId }: { planId: string }) {
  const apis = useB13Apis()
  const router = useRouter()
  const client = useQueryClient()
  const [showArchived, setShowArchived] = useState(false)
  const [creating, setCreating] = useState(false)
  const query = useQuery({ queryKey: worksheetsKey(apis.schoolId, planId), queryFn: () => apis.worksheets.list(planId), retry: false, staleTime: 0, refetchOnWindowFocus: false })
  const plan = useQuery({ queryKey: ['b13', apis.schoolId, 'plan', planId], queryFn: () => apis.plans.get(planId), retry: false, staleTime: 0, refetchOnWindowFocus: false })
  const base = `/teacher/plans/${encodeURIComponent(planId)}`

  if (query.isPending) return <LoadingBlock label="Loading worksheets" testId="ws-list-loading" />
  if (query.isError) return <div className="space-y-3"><FailureBlock error={query.error} onRetry={() => void query.refetch()} subject="this plan's worksheets" testId="ws-list-failure" /><Button asChild variant="outline" size="lg"><Link href={base}>Back to plan</Link></Button></div>
  const all = query.data.items
  const shown = all.filter(sheet => showArchived || sheet.status !== 'ARCHIVED')
  const archivedCount = all.filter(sheet => sheet.status === 'ARCHIVED').length

  return <div className="space-y-5" data-testid="ws-list">
    <Button asChild variant="ghost" size="lg" className="-ms-2"><Link href={base}><ArrowLeft aria-hidden="true" className="rtl:rotate-180" />{plan.data?.title ?? 'Back to plan'}</Link></Button>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-extrabold">Worksheets</h2><p className="text-sm text-muted-foreground">Printable A4 sheets built from your published questions, with a separate answer key.</p></div>
      <Button size="lg" onClick={() => setCreating(true)} data-testid="ws-new"><FilePlus2 aria-hidden="true" />New worksheet</Button>
    </div>
    {archivedCount > 0 && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={showArchived} onChange={event => setShowArchived(event.target.checked)} data-testid="ws-show-archived" />Show {plural(archivedCount, 'archived worksheet')}</label>}
    {shown.length === 0
      ? <EmptyBlock testId="ws-empty" title="No worksheets yet">Create a worksheet, then add published questions from your bank, or let "Fill for me" pick them by topic and difficulty.</EmptyBlock>
      : <ul className="grid gap-3 md:grid-cols-2" aria-label="Worksheets">{shown.map(sheet => <WorksheetCard key={sheet.id} sheet={sheet} base={base} />)}</ul>}
    <CreateDialog open={creating} onOpenChange={setCreating} onCreate={async (title, instructions, key) => {
      const sheet = await apis.worksheets.create(planId, { title, instructions }, key)
      void client.invalidateQueries({ queryKey: worksheetsKey(apis.schoolId, planId) })
      router.push(`${base}/worksheets/${encodeURIComponent(sheet.id)}`)
    }} />
  </div>
}

function WorksheetCard({ sheet, base }: { sheet: Worksheet; base: string }) {
  const href = `${base}/worksheets/${encodeURIComponent(sheet.id)}`
  return <li className="space-y-3 rounded-xl border border-border bg-card p-4" data-testid="ws-card" data-status={sheet.status}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <h3 className="min-w-0 break-words text-base font-bold"><Link href={href} className="hover:underline focus-visible:underline">{sheet.title || 'Untitled worksheet'}</Link></h3>
      <WorksheetStatusChip status={sheet.status} />
    </div>
    <p className="text-sm text-muted-foreground">{plural(sheet.items.length, 'question')} · {plural(totalPoints(sheet.items), 'mark')}{sheet.updatedAt ? ` · updated ${dateText(sheet.updatedAt)}` : ''}</p>
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" size="lg"><Link href={href}><FileText aria-hidden="true" />{sheet.status === 'DRAFT' ? 'Edit' : 'Open'}</Link></Button>
      {sheet.items.length > 0 && <Button asChild variant="outline" size="lg"><Link href={`${href}/print`}><Printer aria-hidden="true" />Print</Link></Button>}
      {sheet.items.length > 0 && <Button asChild variant="outline" size="lg"><Link href={`${href}/answer-key`}><KeyRound aria-hidden="true" />Answer key</Link></Button>}
    </div>
  </li>
}

function CreateDialog({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (open: boolean) => void; onCreate: (title: string, instructions: string, key: string) => Promise<void> }) {
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [intent] = useState(() => new IntentKey())
  async function submit() {
    if (!title.trim() || busy) return
    setBusy(true); setFailure(null)
    try { await onCreate(title.trim(), instructions.trim(), intent.keyFor({ title: title.trim(), instructions: instructions.trim() })); intent.done() } catch (error) { setFailure(failureText(error)) } finally { setBusy(false) }
  }
  return <Dialog open={open} onOpenChange={next => { if (!busy) onOpenChange(next) }}>
    <DialogContent data-testid="ws-create-dialog">
      <DialogHeader><DialogTitle>New worksheet</DialogTitle><DialogDescription>Give it a title. You add questions on the next screen.</DialogDescription></DialogHeader>
      <DialogBody>
        <form className="space-y-3" onSubmit={event => { event.preventDefault(); void submit() }} id="ws-create-form">
          <div className="space-y-1.5"><label htmlFor="ws-new-title" className="block text-sm font-medium">Title</label>
            <input id="ws-new-title" value={title} maxLength={120} onChange={event => setTitle(event.target.value)} data-testid="ws-new-title" className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-base md:text-sm" autoComplete="off" /></div>
          <div className="space-y-1.5"><label htmlFor="ws-new-instructions" className="block text-sm font-medium">Instructions for students (optional)</label>
            <textarea id="ws-new-instructions" value={instructions} maxLength={1000} rows={3} onChange={event => setInstructions(event.target.value)} className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-base md:text-sm" /></div>
          {failure && <InlineAlert testId="ws-create-failure">{failure}</InlineAlert>}
        </form>
      </DialogBody>
      <DialogFooter><Button variant="outline" size="lg" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button><Button type="submit" form="ws-create-form" size="lg" disabled={!title.trim() || busy} aria-disabled={!title.trim() || busy} data-testid="ws-create-submit">{busy ? 'Creating' : 'Create worksheet'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
