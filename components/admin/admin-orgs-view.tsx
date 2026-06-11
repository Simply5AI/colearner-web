'use client'

import type { FormEvent, ReactNode } from 'react'
import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { format } from 'date-fns'
import {
  Archive,
  Building2,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  archiveAdminOrg,
  createAdminOrg,
  type AdminOrgListRow,
  type AdminOrgSort,
  type AdminOrgSsoFilter,
  type AdminOrgType,
  type AdminOrgsQuery,
  type AdminOrgsResponse,
  type AdminSubscriptionPlan,
  type CreateAdminOrgBody,
} from '@/lib/api/admin'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const ALL = 'all'
const PAGE_SIZES = [25, 50, 100]
const ORG_TYPES: AdminOrgType[] = ['PERSONAL', 'TEAM', 'ENTERPRISE']
const PLANS: AdminSubscriptionPlan[] = ['FREE', 'PRO', 'ENTERPRISE']
const SSO_FILTERS: Array<{ value: typeof ALL | AdminOrgSsoFilter; label: string }> = [
  { value: ALL, label: 'Any SSO' },
  { value: 'true', label: 'SSO on' },
  { value: 'false', label: 'SSO off' },
]
const SORTS: Array<{ value: AdminOrgSort; label: string }> = [
  { value: 'created_desc', label: 'Newest' },
  { value: 'created_asc', label: 'Oldest' },
  { value: 'member_count_desc', label: 'Most members' },
  { value: 'member_count_asc', label: 'Fewest members' },
  { value: 'mrr_desc', label: 'Highest MRR' },
  { value: 'mrr_asc', label: 'Lowest MRR' },
]
const SLUG_PATTERN = /^[a-z0-9-]{3,40}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface AdminOrgsViewProps {
  data: AdminOrgsResponse
  query: AdminOrgsQuery
}

interface CreateOrgForm {
  name: string
  slug: string
  type: AdminOrgType
  ownerEmail: string
  plan: AdminSubscriptionPlan
}

type CreateOrgErrors = Partial<Record<keyof CreateOrgForm, string>> & { form?: string }

const emptyCreateForm: CreateOrgForm = {
  name: '',
  slug: '',
  type: 'TEAM',
  ownerEmail: '',
  plan: 'FREE',
}

export function AdminOrgsView({ data, query }: AdminOrgsViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(query.search ?? '')
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateOrgForm>(emptyCreateForm)
  const [createErrors, setCreateErrors] = useState<CreateOrgErrors>({})
  const [archiveTarget, setArchiveTarget] = useState<AdminOrgListRow | null>(null)
  const [isMutating, setIsMutating] = useState(false)
  const didMountSearch = useRef(false)

  const offset = Number.parseInt(query.cursor ?? '0', 10) || 0
  const limit = query.limit ?? 25
  const currentPage = Math.floor(offset / limit) + 1
  const hasFilters = Boolean(
    query.search || query.type || query.plan || query.sso || query.showArchived
  )

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

  const replaceQuery = (updates: Record<string, string | number | boolean | undefined>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === '' || value === ALL || value === false) {
        params.delete(key)
      } else {
        params.set(key, String(value))
      }
    })
    startTransition(() => {
      router.replace(`/admin/orgs${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false })
    })
  }

  const clearFilters = () => {
    setSearch('')
    startTransition(() => router.replace('/admin/orgs', { scroll: false }))
  }

  const openCreateDialog = () => {
    setCreateForm(emptyCreateForm)
    setCreateErrors({})
    setCreateOpen(true)
  }

  const updateCreateField = <Key extends keyof CreateOrgForm>(key: Key, value: CreateOrgForm[Key]) => {
    setCreateForm((current) => ({ ...current, [key]: value }))
    setCreateErrors((current) => ({ ...current, [key]: undefined, form: undefined }))
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const errors = validateCreateForm(createForm)
    setCreateErrors(errors)
    if (Object.keys(errors).length > 0) return

    setIsMutating(true)
    const headers: Record<string, string> = {}
    const body: CreateAdminOrgBody = {
      name: createForm.name.trim(),
      slug: createForm.slug.trim().toLowerCase(),
      type: createForm.type,
      ownerEmail: createForm.ownerEmail.trim().toLowerCase(),
      plan: createForm.plan,
    }

    try {
      const created = await createAdminOrg(headers, body)
      toast.success('Organization created', {
        description: `${created.name} is ready for ${created.ownerEmail ?? body.ownerEmail}.`,
      })
      setCreateOpen(false)
      setCreateForm(emptyCreateForm)
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.'
      if (/slug/i.test(message)) {
        setCreateErrors((current) => ({ ...current, slug: message }))
      } else if (/owner email|email/i.test(message)) {
        setCreateErrors((current) => ({ ...current, ownerEmail: message }))
      } else {
        setCreateErrors((current) => ({ ...current, form: message }))
      }
      toast.error('Organization was not created', { description: message })
    } finally {
      setIsMutating(false)
    }
  }

  const handleArchive = async () => {
    if (!archiveTarget) return

    setIsMutating(true)
    try {
      await archiveAdminOrg({}, archiveTarget.id)
      toast.success('Organization archived', {
        description: `${archiveTarget.name} is now hidden from the active list.`,
      })
      setArchiveTarget(null)
      router.refresh()
    } catch (error) {
      toast.error('Archive failed', {
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setIsMutating(false)
    }
  }

  return (
    <div className="px-4 py-5 md:px-6 lg:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
            <Badge variant="outline">{data.total.toLocaleString()} total</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Search and manage customer organizations across the platform.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.refresh()} disabled={isPending}>
            <RefreshCw className={cn('h-4 w-4', isPending && 'animate-spin')} />
            Refresh
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            New org
          </Button>
        </div>
      </div>

      <Card className="my-5">
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.4fr)_repeat(4,minmax(130px,1fr))_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name or slug"
                className="h-9 pl-9"
              />
            </div>

            <Select
              value={query.type ?? ALL}
              onValueChange={(value) => replaceQuery({ type: value ?? undefined, cursor: undefined })}
            >
              <SelectTrigger className="h-9" aria-label="Organization type">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All types</SelectItem>
                {ORG_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatEnum(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={query.plan ?? ALL}
              onValueChange={(value) => replaceQuery({ plan: value ?? undefined, cursor: undefined })}
            >
              <SelectTrigger className="h-9" aria-label="Organization plan">
                <SelectValue placeholder="All plans" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All plans</SelectItem>
                {PLANS.map((plan) => (
                  <SelectItem key={plan} value={plan}>
                    {formatPlan(plan)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={query.sso ?? ALL}
              onValueChange={(value) => replaceQuery({ sso: value ?? undefined, cursor: undefined })}
            >
              <SelectTrigger className="h-9" aria-label="SSO status">
                <SelectValue placeholder="Any SSO" />
              </SelectTrigger>
              <SelectContent>
                {SSO_FILTERS.map((filter) => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex h-9 items-center gap-2 rounded-lg border border-input px-3">
              <Label className="text-sm font-medium">
                <Checkbox
                  aria-label="Show archived"
                  checked={Boolean(query.showArchived)}
                  onCheckedChange={(checked) =>
                    replaceQuery({ showArchived: checked === true ? true : undefined, cursor: undefined })
                  }
                />
                Show archived
              </Label>
            </div>

            <Button variant="outline" onClick={clearFilters} className="h-9">
              <X className="h-4 w-4" />
              Clear
            </Button>
          </div>

          <div className="flex flex-col gap-3 border-t pt-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Select
                value={query.sort ?? 'created_desc'}
                onValueChange={(value) => replaceQuery({ sort: value ?? undefined, cursor: undefined })}
              >
                <SelectTrigger className="h-8 w-48" aria-label="Organization sort">
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
                <SelectTrigger className="h-8 w-28" aria-label="Rows per page">
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
          </div>
        </CardContent>
      </Card>

      <Card className="my-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-3 py-3 text-left">Slug</th>
                <th className="px-3 py-3 text-left">Type</th>
                <th className="px-3 py-3 text-left">Plan</th>
                <th className="px-3 py-3 text-left">Members</th>
                <th className="px-3 py-3 text-left">Owner email</th>
                <th className="px-3 py-3 text-left">SSO</th>
                <th className="px-3 py-3 text-left">MRR</th>
                <th className="px-3 py-3 text-left">Created</th>
                <th className="w-12 px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((org) => (
                <tr
                  key={org.id}
                  className={cn(
                    'border-b transition-colors hover:bg-muted/30',
                    org.deletedAt && 'bg-muted/30 text-muted-foreground'
                  )}
                >
                  <td className="px-4 py-3">
                    <Link href={`/admin/orgs/${org.id}`} className="flex min-w-0 items-center gap-3">
                      <Avatar size="sm">
                        <AvatarFallback>{initials(org.name)}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0">
                        <span className="block font-semibold text-foreground hover:text-primary">
                          {org.name}
                        </span>
                        {org.deletedAt && <Badge variant="outline">Archived</Badge>}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">{org.slug}</td>
                  <td className="px-3 py-3">
                    <Badge variant="outline">{formatEnum(org.type)}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant={org.plan === 'ENTERPRISE' ? 'default' : 'secondary'}>
                      {formatPlan(org.plan)}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">{org.memberCount.toLocaleString()}</td>
                  <td className="px-3 py-3 font-mono text-xs">{org.ownerEmail ?? 'No owner'}</td>
                  <td className="px-3 py-3">
                    <Badge variant={org.ssoEnabled ? 'secondary' : 'outline'}>
                      {org.ssoEnabled ? 'On' : 'Off'}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">{formatCurrency(org.mrr)}</td>
                  <td className="px-3 py-3">{formatDate(org.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${org.name}`} />}>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem render={<Link href={`/admin/orgs/${org.id}`} />}>
                          Open details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={Boolean(org.deletedAt)}
                          variant="destructive"
                          onClick={() => setArchiveTarget(org)}
                        >
                          <Archive className="h-4 w-4" />
                          {org.deletedAt ? 'Already archived' : 'Archive org'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.items.length === 0 && (
          <div className="flex min-h-72 flex-col items-center justify-center px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              {hasFilters ? <ShieldAlert className="h-6 w-6" /> : <Building2 className="h-6 w-6" />}
            </div>
            <h2 className="mt-4 text-lg font-bold">
              {hasFilters ? 'No organizations found' : 'No organizations yet'}
            </h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {hasFilters
                ? 'No organizations match the current search and filters.'
                : 'Create an organization on behalf of a customer to get started.'}
            </p>
            <div className="mt-4 flex items-center gap-2">
              {hasFilters && (
                <Button variant="outline" onClick={clearFilters}>
                  Reset filters
                </Button>
              )}
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4" />
                Create org
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
          <div className="text-muted-foreground">
            Page {currentPage} - Showing {data.items.length} of {data.total.toLocaleString()}
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>New organization</DialogTitle>
              <DialogDescription>
                Create an organization and invite the owner to finish account setup.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field
                id="org-name"
                label="Name"
                error={createErrors.name}
              >
                <Input
                  id="org-name"
                  value={createForm.name}
                  onChange={(event) => updateCreateField('name', event.target.value)}
                  placeholder="Acme Learning"
                />
              </Field>
              <Field
                id="org-slug"
                label="Slug"
                error={createErrors.slug}
              >
                <Input
                  id="org-slug"
                  value={createForm.slug}
                  onChange={(event) => updateCreateField('slug', event.target.value.toLowerCase())}
                  placeholder="acme-learning"
                />
              </Field>
              <Field
                id="org-owner-email"
                label="Owner email"
                error={createErrors.ownerEmail}
                className="md:col-span-2"
              >
                <Input
                  id="org-owner-email"
                  type="email"
                  value={createForm.ownerEmail}
                  onChange={(event) => updateCreateField('ownerEmail', event.target.value)}
                  placeholder="owner@example.com"
                />
              </Field>
              <Field id="org-type" label="Type" error={createErrors.type}>
                <Select
                  value={createForm.type}
                  onValueChange={(value) => updateCreateField('type', value as AdminOrgType)}
                >
                  <SelectTrigger aria-label="New organization type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORG_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {formatEnum(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="org-plan" label="Plan" error={createErrors.plan}>
                <Select
                  value={createForm.plan}
                  onValueChange={(value) => updateCreateField('plan', value as AdminSubscriptionPlan)}
                >
                  <SelectTrigger aria-label="New organization plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANS.map((plan) => (
                      <SelectItem key={plan} value={plan}>
                        {formatPlan(plan)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {createErrors.form && (
              <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {createErrors.form}
              </p>
            )}

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={isMutating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isMutating}>
                {isMutating ? 'Creating...' : 'Create org'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive organization</DialogTitle>
            <DialogDescription>
              {archiveTarget
                ? `${archiveTarget.name} (${archiveTarget.slug}) will be hidden from active organization lists.`
                : 'This organization will be hidden from active organization lists.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveTarget(null)} disabled={isMutating}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleArchive} disabled={isMutating || !archiveTarget}>
              {isMutating ? 'Archiving...' : 'Archive org'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({
  id,
  label,
  error,
  className,
  children,
}: {
  id: string
  label: string
  error?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-1.5 text-xs font-semibold">
        {label}
      </Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}

function validateCreateForm(form: CreateOrgForm): CreateOrgErrors {
  const errors: CreateOrgErrors = {}
  if (!form.name.trim()) errors.name = 'Name is required.'
  if (!SLUG_PATTERN.test(form.slug.trim())) {
    errors.slug = 'Slug must be 3 to 40 lowercase letters, numbers, or hyphens.'
  }
  if (!EMAIL_PATTERN.test(form.ownerEmail.trim())) {
    errors.ownerEmail = 'A valid owner email is required.'
  }
  if (!ORG_TYPES.includes(form.type)) errors.type = 'Select an organization type.'
  if (!PLANS.includes(form.plan)) errors.plan = 'Select a plan.'
  return errors
}

function initials(value: string) {
  return value
    .split(/\s|-/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatPlan(value: AdminSubscriptionPlan) {
  if (value === 'PRO') return 'Pro'
  return formatEnum(value)
}

function formatDate(value: string) {
  return format(new Date(value), 'MMM d, yyyy')
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)
}
