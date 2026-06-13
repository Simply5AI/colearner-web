'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import {
  AlertTriangle,
  Copy,
  Download,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  deleteAdminExtraction,
  getAdminExtraction,
  getAdminExtractionDownload,
  reprocessAdminExtraction,
  type AdminExtractionDetail,
  type AdminExtractionListRow,
  type AdminExtractionSort,
  type AdminExtractionStatus,
  type AdminExtractionsQuery,
  type AdminPaginated,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useAdminMutation } from '@/lib/hooks/use-admin-mutation'

const ALL = 'all'
const STATUSES: AdminExtractionStatus[] = ['PENDING', 'PROCESSING', 'COMPLETED_PASS1', 'COMPLETED', 'FAILED']
const SORTS: Array<{ value: AdminExtractionSort; label: string }> = [
  { value: 'created_desc', label: 'Newest' },
  { value: 'created_asc', label: 'Oldest' },
  { value: 'duration_desc', label: 'Longest processing' },
  { value: 'duration_asc', label: 'Shortest processing' },
]

interface Props {
  data: AdminPaginated<AdminExtractionListRow>
  query: AdminExtractionsQuery
}

export function AdminContentExtractionsView({ data, query }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { runSensitive } = useAdminMutation()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(query.search ?? '')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AdminExtractionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminExtractionListRow | null>(null)
  const [isMutating, setIsMutating] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const didMountSearch = useRef(false)

  const offset = Number.parseInt(query.cursor ?? '0', 10) || 0
  const limit = query.limit ?? 25
  const currentPage = Math.floor(offset / limit) + 1

  const orgOptions = useMemo(() => {
    const byId = new Map<string, string>()
    data.items.forEach((row) => byId.set(row.org.id, row.org.name))
    return Array.from(byId.entries()).map(([id, name]) => ({ id, name }))
  }, [data.items])

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

  useEffect(() => {
    if (!detailId) {
      setDetail(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    getAdminExtraction({}, detailId)
      .then((next) => {
        if (!cancelled) setDetail(next)
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load extraction')
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [detailId])

  function updateQuery(patch: Partial<AdminExtractionsQuery>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries({ ...query, ...patch })) {
      if (value === undefined || value === null || value === '' || value === ALL) params.delete(key)
      else params.set(key, String(value))
    }
    startTransition(() => router.push(`/admin/content/extractions?${params.toString()}`))
  }

  async function handleReprocess(row: AdminExtractionListRow) {
    setIsMutating(true)
    try {
      const result = await runSensitive(() => reprocessAdminExtraction(row.id))
      toast.success('Reprocess queued', { description: `Job ${result.jobId}` })
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reprocess failed')
    } finally {
      setIsMutating(false)
    }
  }

  async function handleDownload(extractionId: string) {
    setIsDownloading(true)
    try {
      const download = await getAdminExtractionDownload({}, extractionId)
      window.open(download.url, '_blank', 'noopener,noreferrer')
      toast.success('Download started', { description: download.fileName })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setIsDownloading(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setIsMutating(true)
    try {
      await runSensitive(() => deleteAdminExtraction(deleteTarget.id))
      toast.success('Extraction deleted')
      setDeleteTarget(null)
      if (detailId === deleteTarget.id) setDetailId(null)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setIsMutating(false)
    }
  }

  return (
    <div className="px-4 py-5 md:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Extractions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.total.toLocaleString()} extractions across all organizations
          </p>
        </div>
        <Button variant="outline" onClick={() => router.refresh()} disabled={isPending}>
          <RefreshCw className={cn('h-4 w-4', isPending && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <label className="min-w-[200px] flex-1 text-sm">
            <span className="mb-1 block text-muted-foreground">Search</span>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="URL, email, or id" />
            </div>
          </label>
          <FilterSelect
            label="Status"
            value={query.status ?? ALL}
            onChange={(v) => updateQuery({ status: v === ALL ? undefined : (v as AdminExtractionStatus), cursor: undefined })}
            options={[{ value: ALL, label: 'All statuses' }, ...STATUSES.map((s) => ({ value: s, label: s }))]}
          />
          <FilterSelect
            label="Org"
            value={query.orgId ?? ALL}
            onChange={(v) => updateQuery({ orgId: v === ALL ? undefined : v, cursor: undefined })}
            options={[{ value: ALL, label: 'All orgs' }, ...orgOptions.map((o) => ({ value: o.id, label: o.name }))]}
          />
          <FilterSelect
            label="Sort"
            value={query.sort ?? 'created_desc'}
            onChange={(v) => updateQuery({ sort: v as AdminExtractionSort, cursor: undefined })}
            options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
          />
          <div className="flex gap-2">
            <Input type="date" value={query.from ?? ''} onChange={(e) => updateQuery({ from: e.target.value || undefined, cursor: undefined })} />
            <Input type="date" value={query.to ?? ''} onChange={(e) => updateQuery({ to: e.target.value || undefined, cursor: undefined })} />
          </div>
          {(query.search || query.status || query.orgId || query.from || query.to) && (
            <Button variant="ghost" size="sm" onClick={() => router.push('/admin/content/extractions')}>
              <X className="h-4 w-4" /> Clear
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Org</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Duration</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      No extractions match these filters.
                    </td>
                  </tr>
                ) : (
                  data.items.map((row) => (
                    <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <button type="button" className="text-left" onClick={() => setDetailId(row.id)}>
                          <div className="font-medium">{row.title || 'Untitled extraction'}</div>
                          <div className="max-w-xs truncate text-xs text-muted-foreground">{row.sourceUrl}</div>
                        </button>
                      </td>
                      <td className="px-4 py-3">{row.owner.email}</td>
                      <td className="px-4 py-3">{row.org.name}</td>
                      <td className="px-4 py-3">
                        <ExtractionStatusBadge status={row.status} isStuck={row.isStuck} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.processingTimeMs ? `${(row.processingTimeMs / 1000).toFixed(1)}s` : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetailId(row.id)}>View</DropdownMenuItem>
                            {row.hasUploadedFile && (
                              <DropdownMenuItem
                                disabled={isDownloading}
                                onClick={() => handleDownload(row.id)}
                              >
                                <Download className="h-4 w-4" /> Download file
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              disabled={!['FAILED', 'COMPLETED', 'COMPLETED_PASS1'].includes(row.status)}
                              onClick={() => handleReprocess(row)}
                            >
                              <RotateCcw className="h-4 w-4" /> Reprocess
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(row)}>
                              <Trash2 className="h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Pagination
        currentPage={currentPage}
        hasNext={!!data.nextCursor}
        onPrev={() => updateQuery({ cursor: String(Math.max(0, offset - limit)) })}
        onNext={() => data.nextCursor && updateQuery({ cursor: data.nextCursor })}
      />

      <Sheet open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
        <SheetContent className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{detail?.title || 'Extraction detail'}</SheetTitle>
            <SheetDescription className="break-all">{detail?.sourceUrl}</SheetDescription>
          </SheetHeader>
          <SheetBody>
            {detailLoading && (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading extraction…</p>
            )}
            {detail && !detailLoading && (
              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="transcript">Transcript</TabsTrigger>
                  <TabsTrigger value="concepts">Concepts</TabsTrigger>
                  <TabsTrigger value="questions">Questions</TabsTrigger>
                  <TabsTrigger value="logs">Logs</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="mt-0 space-y-3 text-sm">
                  <div className="rounded-xl border border-border/70 bg-card p-4">
                    <MetaRow label="Status" value={<ExtractionStatusBadge status={detail.status} />} />
                    <MetaRow label="Owner" value={detail.owner.email} />
                    <MetaRow label="Org" value={detail.org.name} />
                    <MetaRow label="Model" value={detail.processedModel ?? '—'} />
                    <MetaRow label="Processing" value={detail.processingTimeMs ? `${detail.processingTimeMs} ms` : '—'} />
                    <MetaRow label="Created" value={format(new Date(detail.createdAt), 'PPpp')} />
                  </div>
                  {detail.uploadedFile && (
                    <div className="rounded-xl border border-border/70 bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">Uploaded file</p>
                          <p className="mt-1 truncate text-sm text-muted-foreground">
                            {detail.uploadedFile.fileName}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {[detail.uploadedFile.mimeType, formatFileSize(detail.uploadedFile.fileSize)]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          disabled={isDownloading}
                          onClick={() => handleDownload(detail.id)}
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                      </div>
                    </div>
                  )}
                  {detail.errorMessage && (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                      {detail.errorMessage}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="transcript" className="mt-0">
                  {detail.transcriptText ? (
                    <div className="space-y-3">
                      <Button size="sm" variant="outline" onClick={() => copyText(detail.transcriptText!)}>
                        <Copy className="h-4 w-4" /> Copy transcript
                      </Button>
                      <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-xl border border-border/70 bg-muted/30 p-4 text-xs leading-relaxed">
                        {detail.transcriptText}
                      </pre>
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                      No transcript stored.
                    </p>
                  )}
                </TabsContent>
                <TabsContent value="concepts" className="mt-0">
                  <ul className="space-y-3 text-sm">
                    {detail.concepts.map((c) => (
                      <li key={c.id} className="rounded-xl border border-border/70 bg-card p-4">
                        <div className="font-medium">{c.title}</div>
                        {c.description && <p className="mt-1.5 text-muted-foreground">{c.description}</p>}
                      </li>
                    ))}
                    {detail.concepts.length === 0 && (
                      <li className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
                        No concepts extracted.
                      </li>
                    )}
                  </ul>
                </TabsContent>
                <TabsContent value="questions" className="mt-0">
                  <ul className="space-y-3 text-sm">
                    {detail.questions.map((q) => (
                      <li key={q.id} className="rounded-xl border border-border/70 bg-card p-4">
                        <Badge variant="outline" className="mb-2">{q.type}</Badge>
                        <div>{q.text}</div>
                      </li>
                    ))}
                    {detail.questions.length === 0 && (
                      <li className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
                        No questions generated.
                      </li>
                    )}
                  </ul>
                </TabsContent>
                <TabsContent value="logs" className="mt-0">
                  {detail.logs ? (
                    <div className="space-y-3 text-sm">
                      <div className="rounded-xl border border-border/70 bg-card p-4">
                        Job {detail.logs.id} · {detail.logs.name}
                      </div>
                      {detail.logs.failedReason && (
                        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive">
                          {detail.logs.failedReason}
                        </div>
                      )}
                      <pre className="max-h-64 overflow-auto rounded-xl border border-border/70 bg-muted/30 p-4 text-xs leading-relaxed">
                        {(detail.logs.logs ?? []).join('\n') || 'No log lines.'}
                      </pre>
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                      No job logs available.
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete extraction?
            </DialogTitle>
            <DialogDescription>
              Soft-deletes this extraction and cascades concepts and questions per platform rules.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {deleteTarget && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
                <p className="font-medium">{deleteTarget.title || deleteTarget.sourceUrl}</p>
                <p className="mt-2 text-muted-foreground">
                  {deleteTarget.conceptCount} concepts · {deleteTarget.questionCount} questions will be affected.
                </p>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={isMutating} onClick={handleDelete}>Delete extraction</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

function ExtractionStatusBadge({ status, isStuck }: { status: AdminExtractionStatus; isStuck?: boolean }) {
  const variant = status === 'FAILED' ? 'destructive' : status === 'COMPLETED' || status === 'COMPLETED_PASS1' ? 'default' : 'secondary'
  return (
    <div className="flex items-center gap-1">
      <Badge variant={variant}>{status}</Badge>
      {isStuck && (
        <Badge variant="outline" className="border-amber-500 text-amber-700">
          <AlertTriangle className="mr-1 h-3 w-3" /> Stuck
        </Badge>
      )}
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/50 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

function Pagination({
  currentPage,
  hasNext,
  onPrev,
  onNext,
}: {
  currentPage: number
  hasNext: boolean
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className="mt-4 flex items-center justify-between">
      <Button variant="outline" disabled={currentPage <= 1} onClick={onPrev}>Previous</Button>
      <span className="text-sm text-muted-foreground">Page {currentPage}</span>
      <Button variant="outline" disabled={!hasNext} onClick={onNext}>Next</Button>
    </div>
  )
}

function formatFileSize(bytes: number | null) {
  if (bytes == null) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function copyText(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copied'),
    () => toast.error('Copy failed'),
  )
}