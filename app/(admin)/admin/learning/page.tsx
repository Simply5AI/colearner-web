import type { Metadata } from 'next'
import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListChecks,
  Map,
  Search,
  UserRound,
} from 'lucide-react'

import { getAuthHeaders } from '@/lib/api/auth-headers'
import {
  getAdminUsers,
  type AdminUserListRow,
  type AdminUsersQuery,
} from '@/lib/api/admin'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Admin Learning',
}

type AdminLearningPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const PAGE_SIZES = [25, 50, 100]

export default async function AdminLearningPage({ searchParams }: AdminLearningPageProps) {
  const [params, headers] = await Promise.all([searchParams, getAuthHeaders()])
  const query = normalizeQuery(params)
  const data = await getAdminUsers(headers, query)
  const limit = query.limit ?? 25
  const offset = Number.parseInt(query.cursor ?? '0', 10) || 0
  const currentPage = Math.floor(offset / limit) + 1
  const previousCursor = Math.max(0, offset - limit)
  const hasPrevious = offset > 0

  return (
    <div className="px-4 py-5 md:px-6 lg:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Learning</h1>
            <span className="inline-flex h-6 items-center rounded-full border border-border px-2 text-xs font-semibold text-muted-foreground">
              {data.total.toLocaleString()} users
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Pick a learner to inspect read-only progress, mastery, sessions, and roadmaps.
          </p>
        </div>
        <Link
          href="/admin/users"
          className="inline-flex h-8 w-fit items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <UserRound className="h-4 w-4" />
          User management
        </Link>
      </div>

      <form
        action="/admin/learning"
        className="mt-5 grid gap-3 rounded-lg border border-border bg-card p-4 shadow-sm md:grid-cols-[minmax(240px,1fr)_130px_auto_auto]"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="search"
            defaultValue={query.search ?? ''}
            placeholder="Search learners by name, email, or ID"
            className="h-9 w-full rounded-lg border border-input bg-background px-3 pl-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/50"
          />
        </div>
        <select
          name="limit"
          defaultValue={String(limit)}
          aria-label="Rows per page"
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size} rows
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Search className="h-4 w-4" />
          Search
        </button>
        <Link
          href="/admin/learning"
          className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Reset
        </Link>
      </form>

      <div className="mt-5 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Learner</th>
                <th className="px-4 py-3 text-left">Organization</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Last active</th>
                <th className="px-4 py-3 text-left">Learning screens</th>
                <th className="px-4 py-3 text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((user) => (
                <LearnerRow key={user.id} user={user} />
              ))}
            </tbody>
          </table>
        </div>

        {data.items.length === 0 && (
          <div className="flex min-h-72 flex-col items-center justify-center px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <BookOpen className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-bold">No learners found</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              No accounts match the current search. Clear the query or try a different name or email.
            </p>
            <Link
              href="/admin/learning"
              className="mt-4 inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              Clear search
            </Link>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
          <div className="text-muted-foreground">
            Page {currentPage} - Showing {data.items.length} of {data.total.toLocaleString()}
          </div>
          <div className="flex items-center gap-2">
            {hasPrevious ? (
              <Link
                href={learningHref(query, previousCursor === 0 ? undefined : String(previousCursor))}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 font-medium transition-colors hover:bg-muted"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Link>
            ) : (
              <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 font-medium text-muted-foreground opacity-50">
                <ChevronLeft className="h-4 w-4" />
                Previous
              </span>
            )}
            {data.nextCursor ? (
              <Link
                href={learningHref(query, data.nextCursor)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 font-medium transition-colors hover:bg-muted"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 font-medium text-muted-foreground opacity-50">
                Next
                <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function LearnerRow({ user }: { user: AdminUserListRow }) {
  const learningBase = `/admin/users/${user.id}/learning`
  const links = [
    { href: learningBase, label: 'Overview', icon: BookOpen },
    { href: `${learningBase}/mastery`, label: 'Mastery', icon: ListChecks },
    { href: `${learningBase}/sessions`, label: 'Sessions', icon: Clock },
    { href: `${learningBase}/roadmaps`, label: 'Roadmaps', icon: Map },
  ]

  return (
    <tr
      className={cn(
        'border-b transition-colors last:border-b-0 hover:bg-muted/30',
        user.status === 'DELETED' && 'bg-muted/30 text-muted-foreground'
      )}
    >
      <td className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
            {initials(user.name || user.email)}
          </span>
          <div className="min-w-0">
            <Link href={learningBase} className="font-semibold text-foreground hover:text-primary">
              {user.name || 'Unnamed user'}
            </Link>
            <div className="truncate font-mono text-xs text-muted-foreground">{user.email}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="font-medium">{user.org.name}</div>
        <div className="text-xs text-muted-foreground">{user.org.slug}</div>
      </td>
      <td className="px-4 py-3">
        <StatusPill status={user.status} />
        <div className="mt-1 text-xs text-muted-foreground">{formatLabel(user.systemRole)}</div>
      </td>
      <td className="px-4 py-3">
        <div>{relativeTime(user.lastActiveAt)}</div>
        <div className="text-xs text-muted-foreground">Created {formatDate(user.createdAt)}</div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {links.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={learningBase}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Open
          <ChevronRight className="h-4 w-4" />
        </Link>
      </td>
    </tr>
  )
}

function normalizeQuery(params: Record<string, string | string[] | undefined>): AdminUsersQuery {
  const search = first(params.search)
  const cursor = first(params.cursor)
  const limit = Number(first(params.limit))

  return {
    search: search || undefined,
    cursor: cursor || undefined,
    limit: PAGE_SIZES.includes(limit) ? limit : 25,
    sort: 'last_active_desc',
  }
}

function learningHref(query: AdminUsersQuery, cursor: string | undefined) {
  const params = new URLSearchParams()
  if (query.search) params.set('search', query.search)
  if (query.limit && query.limit !== 25) params.set('limit', String(query.limit))
  if (cursor) params.set('cursor', cursor)
  const qs = params.toString()
  return `/admin/learning${qs ? `?${qs}` : ''}`
}

function StatusPill({ status }: { status: AdminUserListRow['status'] }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-full px-2 text-xs font-semibold',
        status === 'ACTIVE' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        status === 'SUSPENDED' && 'bg-destructive/10 text-destructive',
        status === 'DELETED' && 'border border-border text-muted-foreground'
      )}
    >
      {formatLabel(status)}
    </span>
  )
}

function initials(value: string) {
  return value
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function formatLabel(value: string) {
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

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
