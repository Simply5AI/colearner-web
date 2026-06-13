'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Flag, MoreHorizontal, Pencil, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  deleteAdminConcept,
  deleteAdminQuestion,
  flagAdminConcept,
  flagAdminQuestion,
  getAdminConceptDuplicates,
  mergeAdminConcept,
  unflagAdminConcept,
  unflagAdminQuestion,
  updateAdminConcept,
  updateAdminQuestion,
  type AdminConceptListRow,
  type AdminDuplicateCandidate,
  type AdminLibraryQuery,
  type AdminLibrarySort,
  type AdminPaginated,
  type AdminQuestionListRow,
} from '@/lib/api/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useAdminMutation } from '@/lib/hooks/use-admin-mutation'

const ALL = 'all'
type LibraryTab = 'concepts' | 'questions'

interface Props {
  tab: LibraryTab
  concepts: AdminPaginated<AdminConceptListRow>
  questions: AdminPaginated<AdminQuestionListRow>
  query: AdminLibraryQuery
}

export function AdminContentLibraryView({ tab, concepts, questions, query }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { runSensitive } = useAdminMutation()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(query.search ?? '')
  const [editConcept, setEditConcept] = useState<AdminConceptListRow | null>(null)
  const [editQuestion, setEditQuestion] = useState<AdminQuestionListRow | null>(null)
  const [flagTarget, setFlagTarget] = useState<{ kind: LibraryTab; row: AdminConceptListRow | AdminQuestionListRow } | null>(null)
  const [flagReason, setFlagReason] = useState('')
  const [deleteConcept, setDeleteConcept] = useState<AdminConceptListRow | null>(null)
  const [deleteQuestion, setDeleteQuestion] = useState<AdminQuestionListRow | null>(null)
  const [duplicates, setDuplicates] = useState<AdminDuplicateCandidate[]>([])
  const [duplicateSource, setDuplicateSource] = useState<AdminConceptListRow | null>(null)
  const [isMutating, setIsMutating] = useState(false)
  const didMountSearch = useRef(false)

  const activeData = tab === 'concepts' ? concepts : questions
  const offset = Number.parseInt(query.cursor ?? '0', 10) || 0
  const limit = query.limit ?? 25
  const currentPage = Math.floor(offset / limit) + 1

  const orgOptions = useMemo(() => {
    const byId = new Map<string, string>()
    activeData.items.forEach((row) => byId.set(row.org.id, row.org.name))
    return Array.from(byId.entries()).map(([id, name]) => ({ id, name }))
  }, [activeData.items])

  useEffect(() => {
    setSearch(query.search ?? '')
  }, [query.search])

  useEffect(() => {
    if (!didMountSearch.current) {
      didMountSearch.current = true
      return
    }
    const timer = setTimeout(() => updateQuery({ search: search || undefined, cursor: undefined }), 300)
    return () => clearTimeout(timer)
  }, [search])

  function updateQuery(patch: Partial<AdminLibraryQuery> & { tab?: LibraryTab }) {
    const params = new URLSearchParams(searchParams.toString())
    const next = { ...query, ...patch }
    if (patch.tab) params.set('tab', patch.tab)
    for (const [key, value] of Object.entries(next)) {
      if (key === 'tab') continue
      if (value === undefined || value === null || value === '' || value === ALL) params.delete(key)
      else params.set(key, String(value))
    }
    startTransition(() => router.push(`/admin/content/library?${params.toString()}`))
  }

  async function saveConcept() {
    if (!editConcept) return
    setIsMutating(true)
    try {
      await runSensitive(() =>
        updateAdminConcept(editConcept.id, {
          title: editConcept.title,
          description: editConcept.description ?? undefined,
        }),
      )
      toast.success('Concept updated')
      setEditConcept(null)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setIsMutating(false)
    }
  }

  async function saveQuestion() {
    if (!editQuestion) return
    setIsMutating(true)
    try {
      await runSensitive(() => updateAdminQuestion(editQuestion.id, { text: editQuestion.text }))
      toast.success('Question updated')
      setEditQuestion(null)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setIsMutating(false)
    }
  }

  async function submitFlag() {
    if (!flagTarget || flagReason.trim().length < 3) {
      toast.error('Enter a flag reason')
      return
    }
    setIsMutating(true)
    try {
      if (flagTarget.kind === 'concepts') {
        await runSensitive(() => flagAdminConcept(flagTarget.row.id, flagReason.trim()))
      } else {
        await runSensitive(() => flagAdminQuestion(flagTarget.row.id, flagReason.trim()))
      }
      toast.success('Flagged')
      setFlagTarget(null)
      setFlagReason('')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Flag failed')
    } finally {
      setIsMutating(false)
    }
  }

  async function handleUnflag(kind: LibraryTab, id: string) {
    setIsMutating(true)
    try {
      await runSensitive(() => (kind === 'concepts' ? unflagAdminConcept(id) : unflagAdminQuestion(id)))
      toast.success('Unflagged')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unflag failed')
    } finally {
      setIsMutating(false)
    }
  }

  async function confirmDeleteConcept() {
    if (!deleteConcept) return
    setIsMutating(true)
    try {
      const result = await runSensitive(() => deleteAdminConcept(deleteConcept.id))
      toast.success(`Deleted · ${result.affectedReviewSchedules} schedules affected`)
      setDeleteConcept(null)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setIsMutating(false)
    }
  }

  async function confirmDeleteQuestion() {
    if (!deleteQuestion) return
    setIsMutating(true)
    try {
      const result = await runSensitive(() => deleteAdminQuestion(deleteQuestion.id))
      toast.success(`Deleted · ${result.affectedReviewSchedules} schedules affected`)
      setDeleteQuestion(null)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setIsMutating(false)
    }
  }

  async function openDuplicates(row: AdminConceptListRow) {
    setDuplicateSource(row)
    try {
      const result = await getAdminConceptDuplicates({}, row.id)
      setDuplicates(result.items)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load duplicates')
    }
  }

  async function mergeInto(targetConceptId: string) {
    if (!duplicateSource) return
    setIsMutating(true)
    try {
      await runSensitive(() => mergeAdminConcept(duplicateSource.id, targetConceptId))
      toast.success('Concepts merged')
      setDuplicateSource(null)
      setDuplicates([])
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Merge failed')
    } finally {
      setIsMutating(false)
    }
  }

  return (
    <div className="px-4 py-5 md:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Content library</h1>
          <p className="mt-1 text-sm text-muted-foreground">Moderate concepts and questions across the platform.</p>
        </div>
        <Button variant="outline" onClick={() => router.refresh()} disabled={isPending}>
          <RefreshCw className={cn('h-4 w-4', isPending && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => updateQuery({ tab: v as LibraryTab, cursor: undefined })}>
        <TabsList>
          <TabsTrigger value="concepts">Concepts ({concepts.total})</TabsTrigger>
          <TabsTrigger value="questions">Questions ({questions.total})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="my-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <label className="min-w-[200px] flex-1 text-sm">
            <span className="mb-1 block text-muted-foreground">Search</span>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tab === 'concepts' ? 'Concept name' : 'Question text'} />
            </div>
          </label>
          <FilterSelect label="Org" value={query.orgId ?? ALL} onChange={(v) => updateQuery({ orgId: v === ALL ? undefined : v, cursor: undefined })} options={[{ value: ALL, label: 'All orgs' }, ...orgOptions.map((o) => ({ value: o.id, label: o.name }))]} />
          <FilterSelect label="Flagged" value={query.flagged ?? ALL} onChange={(v) => updateQuery({ flagged: v === ALL ? undefined : (v as 'true' | 'false'), cursor: undefined })} options={[{ value: ALL, label: 'Any' }, { value: 'true', label: 'Flagged' }, { value: 'false', label: 'Not flagged' }]} />
          <FilterSelect label="Sort" value={query.sort ?? 'created_desc'} onChange={(v) => updateQuery({ sort: v as AdminLibrarySort, cursor: undefined })} options={[{ value: 'created_desc', label: 'Newest' }, { value: 'created_asc', label: 'Oldest' }, { value: 'title_asc', label: 'Title A-Z' }, { value: 'title_desc', label: 'Title Z-A' }]} />
          {(query.search || query.orgId || query.flagged) && (
            <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/content/library?tab=${tab}`)}>
              <X className="h-4 w-4" /> Clear
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {tab === 'concepts' ? (
            <ConceptsTable
              rows={concepts.items}
              onEdit={setEditConcept}
              onFlag={(row) => { setFlagTarget({ kind: 'concepts', row }); setFlagReason('') }}
              onUnflag={(id) => handleUnflag('concepts', id)}
              onDelete={setDeleteConcept}
              onDuplicates={openDuplicates}
            />
          ) : (
            <QuestionsTable
              rows={questions.items}
              onEdit={setEditQuestion}
              onFlag={(row) => { setFlagTarget({ kind: 'questions', row }); setFlagReason('') }}
              onUnflag={(id) => handleUnflag('questions', id)}
              onDelete={setDeleteQuestion}
            />
          )}
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-between">
        <Button variant="outline" disabled={currentPage <= 1} onClick={() => updateQuery({ cursor: String(Math.max(0, offset - limit)) })}>Previous</Button>
        <span className="text-sm text-muted-foreground">Page {currentPage}</span>
        <Button variant="outline" disabled={!activeData.nextCursor} onClick={() => activeData.nextCursor && updateQuery({ cursor: activeData.nextCursor })}>Next</Button>
      </div>

      <Sheet open={!!editConcept} onOpenChange={(open) => !open && setEditConcept(null)}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Edit concept</SheetTitle>
            <SheetDescription>Update the title and description shown to learners.</SheetDescription>
          </SheetHeader>
          {editConcept && (
            <>
              <SheetBody className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="concept-title">Title</Label>
                  <Input
                    id="concept-title"
                    value={editConcept.title}
                    onChange={(e) => setEditConcept({ ...editConcept, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="concept-description">Description</Label>
                  <Textarea
                    id="concept-description"
                    value={editConcept.description ?? ''}
                    onChange={(e) => setEditConcept({ ...editConcept, description: e.target.value })}
                    rows={6}
                    className="min-h-32 resize-y"
                  />
                </div>
              </SheetBody>
              <SheetFooter>
                <Button variant="outline" onClick={() => setEditConcept(null)}>Cancel</Button>
                <Button onClick={saveConcept} disabled={isMutating}>Save changes</Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={!!editQuestion} onOpenChange={(open) => !open && setEditQuestion(null)}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Edit question</SheetTitle>
            <SheetDescription>Revise the question text shown in recall sessions.</SheetDescription>
          </SheetHeader>
          {editQuestion && (
            <>
              <SheetBody className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="question-text">Question text</Label>
                  <Textarea
                    id="question-text"
                    value={editQuestion.text}
                    onChange={(e) => setEditQuestion({ ...editQuestion, text: e.target.value })}
                    rows={8}
                    className="min-h-40 resize-y"
                  />
                </div>
              </SheetBody>
              <SheetFooter>
                <Button variant="outline" onClick={() => setEditQuestion(null)}>Cancel</Button>
                <Button onClick={saveQuestion} disabled={isMutating}>Save changes</Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!flagTarget} onOpenChange={(open) => !open && setFlagTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-amber-600" />
              Flag content
            </DialogTitle>
            <DialogDescription>Provide a moderation reason. Flagged items are hidden from learners.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-2">
              <Label htmlFor="flag-reason">Reason</Label>
              <Textarea
                id="flag-reason"
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="Describe why this content should be reviewed…"
                rows={4}
                className="min-h-28 resize-y"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlagTarget(null)}>Cancel</Button>
            <Button onClick={submitFlag} disabled={isMutating || !flagReason.trim()}>Flag content</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConcept} onOpenChange={(open) => !open && setDeleteConcept(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete concept?</DialogTitle>
            <DialogDescription>This cascades to related questions and review schedules.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {deleteConcept && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
                <p className="font-medium">{deleteConcept.title}</p>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConcept(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteConcept} disabled={isMutating}>Delete concept</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteQuestion} onOpenChange={(open) => !open && setDeleteQuestion(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete question?</DialogTitle>
            <DialogDescription>Removes related review schedules for this question.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {deleteQuestion && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
                <p className="line-clamp-3">{deleteQuestion.text}</p>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteQuestion(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteQuestion} disabled={isMutating}>Delete question</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!duplicateSource} onOpenChange={(open) => !open && setDuplicateSource(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Duplicate candidates</DialogTitle>
            <DialogDescription>
              Similar concepts in the same org for &ldquo;{duplicateSource?.title}&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-0 pb-2">
            <ul className="max-h-72 space-y-2 overflow-auto">
              {duplicates.length === 0 ? (
                <li className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No duplicates above threshold.
                </li>
              ) : (
                duplicates.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3 text-sm"
                  >
                    <span>
                      {d.title}{' '}
                      <span className="text-muted-foreground">({(d.similarity * 100).toFixed(0)}% match)</span>
                    </span>
                    <Button size="sm" variant="outline" disabled={isMutating} onClick={() => mergeInto(d.id)}>
                      Merge into
                    </Button>
                  </li>
                ))
              )}
            </ul>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateSource(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ConceptsTable({
  rows,
  onEdit,
  onFlag,
  onUnflag,
  onDelete,
  onDuplicates,
}: {
  rows: AdminConceptListRow[]
  onEdit: (row: AdminConceptListRow) => void
  onFlag: (row: AdminConceptListRow) => void
  onUnflag: (id: string) => void
  onDelete: (row: AdminConceptListRow) => void
  onDuplicates: (row: AdminConceptListRow) => void
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <th className="px-4 py-3">Name</th>
          <th className="px-4 py-3">Source</th>
          <th className="px-4 py-3">Org</th>
          <th className="px-4 py-3 text-right">Usages</th>
          <th className="px-4 py-3">Created</th>
          <th className="px-4 py-3 w-10" />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-border/50 last:border-0">
            <td className="px-4 py-3">
              <div className="font-medium">{row.title}</div>
              {row.isFlagged && <Badge variant="destructive" className="mt-1">Flagged</Badge>}
            </td>
            <td className="px-4 py-3 text-xs">
              <Link href={`/admin/content/extractions`} className="text-primary hover:underline">{row.source.title || row.source.id}</Link>
            </td>
            <td className="px-4 py-3">{row.org.name}</td>
            <td className="px-4 py-3 text-right tabular-nums">{row.usageCount}</td>
            <td className="px-4 py-3 text-xs text-muted-foreground">{formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}</td>
            <td className="px-4 py-3">
              <RowMenu
                onEdit={() => onEdit(row)}
                onFlag={() => onFlag(row)}
                onUnflag={row.isFlagged ? () => onUnflag(row.id) : undefined}
                onDelete={() => onDelete(row)}
                onDuplicates={() => onDuplicates(row)}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function QuestionsTable({
  rows,
  onEdit,
  onFlag,
  onUnflag,
  onDelete,
}: {
  rows: AdminQuestionListRow[]
  onEdit: (row: AdminQuestionListRow) => void
  onFlag: (row: AdminQuestionListRow) => void
  onUnflag: (id: string) => void
  onDelete: (row: AdminQuestionListRow) => void
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <th className="px-4 py-3">Question</th>
          <th className="px-4 py-3">Type</th>
          <th className="px-4 py-3">Concept</th>
          <th className="px-4 py-3 text-right">Usages</th>
          <th className="px-4 py-3 w-10" />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-border/50 last:border-0">
            <td className="px-4 py-3">
              <div className="max-w-md truncate font-medium">{row.text}</div>
              {row.isFlagged && <Badge variant="destructive" className="mt-1">Flagged</Badge>}
            </td>
            <td className="px-4 py-3"><Badge variant="outline">{row.type}</Badge></td>
            <td className="px-4 py-3 text-xs">{row.concept.title}</td>
            <td className="px-4 py-3 text-right tabular-nums">{row.usageCount}</td>
            <td className="px-4 py-3">
              <RowMenu onEdit={() => onEdit(row)} onFlag={() => onFlag(row)} onUnflag={row.isFlagged ? () => onUnflag(row.id) : undefined} onDelete={() => onDelete(row)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function RowMenu({
  onEdit,
  onFlag,
  onUnflag,
  onDelete,
  onDuplicates,
}: {
  onEdit: () => void
  onFlag: () => void
  onUnflag?: () => void
  onDelete: () => void
  onDuplicates?: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
        <DropdownMenuItem onClick={onFlag}><Flag className="h-4 w-4" /> Flag</DropdownMenuItem>
        {onUnflag && <DropdownMenuItem onClick={onUnflag}>Unflag</DropdownMenuItem>}
        {onDuplicates && <DropdownMenuItem onClick={onDuplicates}>Find duplicates</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </label>
  )
}