'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { MoreHorizontal, RefreshCw, Search, Trash2, UserMinus, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  deleteAdminPod,
  getAdminPod,
  removeAdminPodMember,
  updateAdminPod,
  type AdminPaginated,
  type AdminPodDetail,
  type AdminPodListRow,
  type AdminPodSort,
  type AdminPodVisibility,
  type AdminPodsQuery,
} from '@/lib/api/admin'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useAdminMutation } from '@/lib/hooks/use-admin-mutation'

const ALL = 'all'

interface Props {
  data: AdminPaginated<AdminPodListRow>
  query: AdminPodsQuery
}

export function AdminContentPodsView({ data, query }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { runSensitive } = useAdminMutation()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(query.search ?? '')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AdminPodDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminPodListRow | null>(null)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [isMutating, setIsMutating] = useState(false)
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
    getAdminPod({}, detailId)
      .then((next) => { if (!cancelled) setDetail(next) })
      .catch((err) => { if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load pod') })
      .finally(() => { if (!cancelled) setDetailLoading(false) })
    return () => { cancelled = true }
  }, [detailId])

  function updateQuery(patch: Partial<AdminPodsQuery>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries({ ...query, ...patch })) {
      if (value === undefined || value === null || value === '' || value === ALL) params.delete(key)
      else params.set(key, String(value))
    }
    startTransition(() => router.push(`/admin/content/pods?${params.toString()}`))
  }

  async function changeVisibility(row: AdminPodListRow, visibility: AdminPodVisibility) {
    setIsMutating(true)
    try {
      await runSensitive(() => updateAdminPod(row.id, { visibility }))
      toast.success('Visibility updated')
      if (detailId === row.id) {
        const next = await getAdminPod({}, row.id)
        setDetail(next)
      }
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setIsMutating(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget || deleteConfirmName !== deleteTarget.name) return
    setIsMutating(true)
    try {
      await runSensitive(() => deleteAdminPod(deleteTarget.id))
      toast.success('Pod deleted')
      setDeleteTarget(null)
      setDeleteConfirmName('')
      if (detailId === deleteTarget.id) setDetailId(null)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setIsMutating(false)
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!detail) return
    setIsMutating(true)
    try {
      await runSensitive(() => removeAdminPodMember(detail.id, userId))
      toast.success('Member removed')
      const next = await getAdminPod({}, detail.id)
      setDetail(next)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Remove failed')
    } finally {
      setIsMutating(false)
    }
  }

  return (
    <div className="px-4 py-5 md:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Pods</h1>
          <p className="mt-1 text-sm text-muted-foreground">{data.total.toLocaleString()} study pods</p>
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
              <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pod name" />
            </div>
          </label>
          <FilterSelect label="Visibility" value={query.visibility ?? ALL} onChange={(v) => updateQuery({ visibility: v === ALL ? undefined : (v as AdminPodVisibility), cursor: undefined })} options={[{ value: ALL, label: 'All' }, { value: 'PUBLIC', label: 'Public' }, { value: 'INVITE_ONLY', label: 'Invite only' }]} />
          <FilterSelect label="Org" value={query.orgId ?? ALL} onChange={(v) => updateQuery({ orgId: v === ALL ? undefined : v, cursor: undefined })} options={[{ value: ALL, label: 'All orgs' }, ...orgOptions.map((o) => ({ value: o.id, label: o.name }))]} />
          <FilterSelect label="Sort" value={query.sort ?? 'created_desc'} onChange={(v) => updateQuery({ sort: v as AdminPodSort, cursor: undefined })} options={[{ value: 'created_desc', label: 'Newest' }, { value: 'members_desc', label: 'Most members' }]} />
          {(query.search || query.visibility || query.orgId) && (
            <Button variant="ghost" size="sm" onClick={() => router.push('/admin/content/pods')}><X className="h-4 w-4" /> Clear</Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Org</th>
                <th className="px-4 py-3">Visibility</th>
                <th className="px-4 py-3 text-right">Members</th>
                <th className="px-4 py-3 text-right">Captures</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No pods found.</td></tr>
              ) : (
                data.items.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3"><button type="button" className="font-medium hover:underline" onClick={() => setDetailId(row.id)}>{row.name}</button></td>
                    <td className="px-4 py-3">{row.owner.email ?? '—'}</td>
                    <td className="px-4 py-3">{row.org.name}</td>
                    <td className="px-4 py-3"><Badge variant="outline">{row.visibility}</Badge></td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.memberCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.captureCount}</td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetailId(row.id)}>View</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => changeVisibility(row, row.visibility === 'PUBLIC' ? 'INVITE_ONLY' : 'PUBLIC')}>
                            Set {row.visibility === 'PUBLIC' ? 'invite only' : 'public'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(row)}><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-between">
        <Button variant="outline" disabled={currentPage <= 1} onClick={() => updateQuery({ cursor: String(Math.max(0, offset - limit)) })}>Previous</Button>
        <span className="text-sm text-muted-foreground">Page {currentPage}</span>
        <Button variant="outline" disabled={!data.nextCursor} onClick={() => data.nextCursor && updateQuery({ cursor: data.nextCursor })}>Next</Button>
      </div>

      <Sheet open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{detail?.name ?? 'Pod detail'}</SheetTitle>
            <SheetDescription>{detail?.org.name}</SheetDescription>
          </SheetHeader>
          <SheetBody>
            {detailLoading && (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading pod…</p>
            )}
            {detail && !detailLoading && (
              <Tabs defaultValue="members" className="space-y-4">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="members">Members</TabsTrigger>
                  <TabsTrigger value="captures">Captures</TabsTrigger>
                </TabsList>
                <TabsContent value="members" className="mt-0">
                  <div className="overflow-hidden rounded-xl border border-border/70">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3">Member</th>
                          <th className="px-4 py-3">Role</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/70">
                        {detail.members.map((member) => (
                          <tr key={member.id}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={member.user.avatarUrl ?? undefined} />
                                  <AvatarFallback>{member.user.email?.[0]?.toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span className="font-medium">{member.user.email}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{member.role}</td>
                            <td className="px-4 py-3 text-right">
                              {member.role !== 'OWNER' && member.user.id !== detail.ownerId && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={isMutating}
                                  onClick={() => handleRemoveMember(member.user.id)}
                                  aria-label={`Remove ${member.user.email}`}
                                >
                                  <UserMinus className="h-4 w-4" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
                <TabsContent value="captures" className="mt-0">
                  <ul className="space-y-3 text-sm">
                    {detail.captures.map((capture) => (
                      <li key={capture.id} className="rounded-xl border border-border/70 bg-card p-4">
                        <Link href="/admin/content/extractions" className="font-medium text-primary hover:underline">
                          {capture.extraction.title || capture.extraction.videoUrl}
                        </Link>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(capture.createdAt), { addSuffix: true })}
                        </div>
                      </li>
                    ))}
                    {detail.captures.length === 0 && (
                      <li className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
                        No shared captures.
                      </li>
                    )}
                  </ul>
                </TabsContent>
              </Tabs>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
            setDeleteConfirmName('')
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete pod?
            </DialogTitle>
            <DialogDescription>
              Shared captures will be detached. Extractions remain with their owners.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-2">
              <Label htmlFor="pod-delete-confirm">
                Type <span className="font-semibold">{deleteTarget?.name}</span> to confirm
              </Label>
              <Input
                id="pod-delete-confirm"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder={deleteTarget?.name}
                autoComplete="off"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={isMutating || deleteConfirmName !== deleteTarget?.name}
              onClick={handleDelete}
            >
              Delete pod
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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