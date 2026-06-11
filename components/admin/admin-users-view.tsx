'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { format, formatDistanceToNow } from 'date-fns'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserX,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  deleteAdminUsers,
  reactivateAdminUsers,
  suspendAdminUsers,
  type AdminBulkUsersResponse,
  type AdminUserListRow,
  type AdminUserSort,
  type AdminUserStatus,
  type AdminUsersQuery,
  type AdminUsersResponse,
} from '@/lib/api/admin'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useAdminMutation } from '@/lib/hooks/use-admin-mutation'

const ALL = 'all'
const PAGE_SIZES = [25, 50, 100]
const SYSTEM_ROLES = ['MEMBER', 'ADMIN', 'ORG_ADMIN', 'SUPER_ADMIN']
const STATUSES: AdminUserStatus[] = ['ACTIVE', 'SUSPENDED', 'DELETED']
const SORTS: Array<{ value: AdminUserSort; label: string }> = [
  { value: 'created_desc', label: 'Newest' },
  { value: 'created_asc', label: 'Oldest' },
  { value: 'name_asc', label: 'Name A-Z' },
  { value: 'name_desc', label: 'Name Z-A' },
  { value: 'last_active_desc', label: 'Last active' },
  { value: 'last_active_asc', label: 'Least recently active' },
]

type BulkAction = 'suspend' | 'reactivate' | 'delete'

interface AdminUsersViewProps {
  data: AdminUsersResponse
  query: AdminUsersQuery
  currentAdminId: string
}

export function AdminUsersView({ data, query, currentAdminId }: AdminUsersViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { runSensitive } = useAdminMutation()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(query.search ?? '')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmAction, setConfirmAction] = useState<BulkAction | null>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [isMutating, setIsMutating] = useState(false)
  const didMountSearch = useRef(false)

  const currentIds = useMemo(() => data.items.map((user) => user.id), [data.items])
  const selectableCurrentIds = useMemo(
    () => data.items.filter((user) => user.id !== currentAdminId).map((user) => user.id),
    [currentAdminId, data.items]
  )
  const selectedVisibleCount = selectableCurrentIds.filter((id) => selectedIds.has(id)).length
  const allVisibleSelected = selectableCurrentIds.length > 0 && selectedVisibleCount === selectableCurrentIds.length
  const selectedCount = selectedIds.size
  const offset = Number.parseInt(query.cursor ?? '0', 10) || 0
  const limit = query.limit ?? 25
  const currentPage = Math.floor(offset / limit) + 1

  const orgOptions = useMemo(() => {
    const byId = new Map<string, AdminUserListRow['org']>()
    data.items.forEach((user) => byId.set(user.org.id, user.org))
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [data.items])

  useEffect(() => {
    setSearch(query.search ?? '')
  }, [query.search])

  useEffect(() => {
    if (!didMountSearch.current) {
      didMountSearch.current = true
      return
    }
    const timer = window.setTimeout(() => {
      replaceQuery({ search: search.trim() || undefined, cursor: undefined })
    }, 300)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const replaceQuery = (updates: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === '' || value === ALL) {
        params.delete(key)
      } else {
        params.set(key, String(value))
      }
    })
    startTransition(() => {
      router.replace(`/admin/users${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false })
    })
  }

  const clearFilters = () => {
    setSearch('')
    startTransition(() => router.replace('/admin/users', { scroll: false }))
  }

  const toggleVisibleRows = () => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (allVisibleSelected) {
        selectableCurrentIds.forEach((id) => next.delete(id))
      } else {
        selectableCurrentIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const toggleRow = (id: string) => {
    if (id === currentAdminId) return
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const openSingleAction = (action: BulkAction, id: string) => {
    setSelectedIds(new Set([id]))
    setConfirmAction(action)
  }

  const performAction = async () => {
    if (!confirmAction || selectedIds.size === 0) return
    setIsMutating(true)
    const headers: Record<string, string> = {}
    const userIds = Array.from(selectedIds)

    try {
      let result: AdminBulkUsersResponse
      if (confirmAction === 'suspend') {
        result = await runSensitive(() =>
          suspendAdminUsers(headers, { userIds, reason: suspendReason })
        )
      } else if (confirmAction === 'reactivate') {
        result = await runSensitive(() => reactivateAdminUsers(headers, { userIds }))
      } else {
        result = await runSensitive(() => deleteAdminUsers(headers, { userIds }))
      }

      showBulkResult(confirmAction, result)
      setSelectedIds((current) => {
        const next = new Set(current)
        result.succeeded.forEach((id) => next.delete(id))
        return next
      })
      setConfirmAction(null)
      setSuspendReason('')
      router.refresh()
    } catch (error) {
      toast.error('Bulk action failed', {
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setIsMutating(false)
    }
  }

  return (
    <TooltipProvider>
      <div className="px-4 py-5 md:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">Users</h1>
              <Badge variant="outline">{data.total.toLocaleString()} total</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Search and manage accounts across every organization.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.refresh()} disabled={isPending}>
              <RefreshCw className={cn('h-4 w-4', isPending && 'animate-spin')} />
              Refresh
            </Button>
            <Tooltip>
              <TooltipTrigger render={<Button variant="outline" disabled />}>
                <Download className="h-4 w-4" />
                Export CSV
              </TooltipTrigger>
              <TooltipContent>CSV export is out of scope for v1.</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <Card className="my-5">
          <CardContent className="space-y-3 p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.4fr)_repeat(5,minmax(130px,1fr))_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search email, name, or id"
                  className="h-9 pl-9"
                />
              </div>

              <Select value={query.orgId ?? ALL} onValueChange={(value) => replaceQuery({ orgId: value ?? undefined, cursor: undefined })}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All orgs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All orgs</SelectItem>
                  {orgOptions.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                  {query.orgId && !orgOptions.some((org) => org.id === query.orgId) && (
                    <SelectItem value={query.orgId}>Selected org</SelectItem>
                  )}
                </SelectContent>
              </Select>

              <Select
                value={query.systemRole ?? ALL}
                onValueChange={(value) => replaceQuery({ systemRole: value ?? undefined, cursor: undefined })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All roles</SelectItem>
                  {SYSTEM_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {formatRole(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={query.status ?? ALL}
                onValueChange={(value) => replaceQuery({ status: value ?? undefined, cursor: undefined })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All active" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Active and suspended</SelectItem>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {formatRole(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={query.from ?? ''}
                onChange={(event) => replaceQuery({ from: event.target.value || undefined, cursor: undefined })}
                className="h-9"
                aria-label="Signup from date"
              />
              <Input
                type="date"
                value={query.to ?? ''}
                onChange={(event) => replaceQuery({ to: event.target.value || undefined, cursor: undefined })}
                className="h-9"
                aria-label="Signup to date"
              />

              <Button variant="outline" onClick={clearFilters} className="h-9">
                <X className="h-4 w-4" />
                Clear
              </Button>
            </div>

            <div className="flex flex-col gap-3 border-t pt-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <Select value={query.sort ?? 'created_desc'} onValueChange={(value) => replaceQuery({ sort: value ?? undefined, cursor: undefined })}>
                  <SelectTrigger className="h-8 w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORTS.map((sort) => (
                      <SelectItem key={sort.value} value={sort.value}>
                        {sort.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(limit)}
                  onValueChange={(value) => replaceQuery({ limit: Number(value), cursor: undefined })}
                >
                  <SelectTrigger className="h-8 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size} rows
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCount > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                  <span className="font-medium">{selectedCount} selected</span>
                  <Button size="sm" variant="outline" onClick={() => setConfirmAction('suspend')}>
                    <UserX className="h-4 w-4" />
                    Suspend
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirmAction('reactivate')}>
                    <UserCheck className="h-4 w-4" />
                    Reactivate
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setConfirmAction('delete')}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => setSelectedIds(new Set())} aria-label="Clear selection">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="my-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="w-10 px-4 py-3 text-left">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={toggleVisibleRows}
                      aria-label="Select visible users"
                    />
                  </th>
                  <th className="px-3 py-3 text-left">User</th>
                  <th className="px-3 py-3 text-left">Email</th>
                  <th className="px-3 py-3 text-left">Org</th>
                  <th className="px-3 py-3 text-left">Role</th>
                  <th className="px-3 py-3 text-left">Status</th>
                  <th className="px-3 py-3 text-left">Last active</th>
                  <th className="px-3 py-3 text-left">Created</th>
                  <th className="w-12 px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((user) => {
                  const isSelf = user.id === currentAdminId
                  return (
                    <tr
                      key={user.id}
                      className={cn(
                        'border-b transition-colors hover:bg-muted/30',
                        (user.status === 'DELETED' || user.status === 'SUSPENDED') &&
                          'bg-muted/30 text-muted-foreground'
                      )}
                    >
                      <td className="px-4 py-3">
                        {isSelf ? (
                          <Tooltip>
                            <TooltipTrigger render={<span className="inline-flex" />}>
                              <Checkbox checked={false} disabled aria-label="Cannot select your own account" />
                            </TooltipTrigger>
                            <TooltipContent>You cannot bulk-edit your own admin account.</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Checkbox
                            checked={selectedIds.has(user.id)}
                            onCheckedChange={() => toggleRow(user.id)}
                            aria-label={`Select ${user.email}`}
                          />
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/admin/users/${user.id}`} className="flex min-w-0 items-center gap-3">
                          <Avatar size="sm">
                            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
                            <AvatarFallback>{initials(user.name || user.email)}</AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 font-semibold text-foreground hover:text-primary">
                            {user.name || 'Unnamed user'}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">{user.email}</td>
                      <td className="px-3 py-3">
                        <div className="font-medium">{user.org.name}</div>
                        <div className="text-xs text-muted-foreground">{user.org.slug}</div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={user.systemRole === 'SUPER_ADMIN' ? 'default' : 'outline'}>
                          {formatRole(user.systemRole)}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={user.status} />
                      </td>
                      <td className="px-3 py-3">{relativeTime(user.lastActiveAt)}</td>
                      <td className="px-3 py-3">{formatDate(user.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${user.email}`} />}>
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem render={<Link href={`/admin/users/${user.id}`} />}>
                              Open details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={isSelf || user.status !== 'ACTIVE'}
                              onClick={() => openSingleAction('suspend', user.id)}
                            >
                              <UserX className="h-4 w-4" />
                              Suspend
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={isSelf || user.status !== 'SUSPENDED'}
                              onClick={() => openSingleAction('reactivate', user.id)}
                            >
                              <RotateCcw className="h-4 w-4" />
                              Reactivate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={isSelf || user.status === 'DELETED'}
                              variant="destructive"
                              onClick={() => openSingleAction('delete', user.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {data.items.length === 0 && (
            <div className="flex min-h-72 flex-col items-center justify-center px-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-lg font-bold">No users found</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                No accounts match the current search and filters.
              </p>
              <Button className="mt-4" variant="outline" onClick={clearFilters}>
                Reset filters
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
            <div className="text-muted-foreground">
              Page {currentPage} · Showing {data.items.length} of {data.total.toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={offset === 0}
                onClick={() => replaceQuery({ cursor: Math.max(0, offset - limit) || undefined })}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={!data.nextCursor}
                onClick={() => data.nextCursor && replaceQuery({ cursor: data.nextCursor })}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirmTitle(confirmAction)}</DialogTitle>
              <DialogDescription>
                This will affect {selectedCount} selected account{selectedCount === 1 ? '' : 's'}. The action will be audited.
              </DialogDescription>
            </DialogHeader>
            {confirmAction === 'suspend' && (
              <div>
                <label className="text-xs font-semibold" htmlFor="suspension-reason">
                  Suspension reason
                </label>
                <Input
                  id="suspension-reason"
                  className="mt-1"
                  value={suspendReason}
                  onChange={(event) => setSuspendReason(event.target.value)}
                  placeholder="Policy review"
                />
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={isMutating}>
                Cancel
              </Button>
              <Button
                variant={confirmAction === 'delete' ? 'destructive' : 'default'}
                onClick={performAction}
                disabled={isMutating || selectedCount === 0}
              >
                {isMutating ? 'Working...' : confirmTitle(confirmAction)}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}

function StatusBadge({ status }: { status: AdminUserStatus }) {
  if (status === 'DELETED') return <Badge variant="outline">Deleted</Badge>
  if (status === 'SUSPENDED') return <Badge variant="destructive">Suspended</Badge>
  return <Badge variant="secondary">Active</Badge>
}

function initials(value: string) {
  return value
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function formatRole(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatDate(value: string) {
  return format(new Date(value), 'MMM d, yyyy')
}

function relativeTime(value: string | null) {
  if (!value) return 'Never'
  return formatDistanceToNow(new Date(value), { addSuffix: true })
}

function confirmTitle(action: BulkAction | null) {
  if (action === 'suspend') return 'Suspend users'
  if (action === 'reactivate') return 'Reactivate users'
  if (action === 'delete') return 'Delete users'
  return 'Confirm action'
}

function showBulkResult(action: BulkAction, result: AdminBulkUsersResponse) {
  const label = action === 'suspend' ? 'suspended' : action === 'reactivate' ? 'reactivated' : 'deleted'
  if (result.failed.length === 0) {
    toast.success(`${result.succeeded.length} user${result.succeeded.length === 1 ? '' : 's'} ${label}`)
    return
  }
  toast.warning(`${result.succeeded.length} ${label}, ${result.failed.length} failed`, {
    description: result.failed.map((failure) => `${failure.userId}: ${failure.reason}`).join('\n'),
  })
}
