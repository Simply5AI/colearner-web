'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import {
  BookOpen,
  ChevronRight,
  Clock,
  ListChecks,
  Map,
  Search,
  UserRound,
  X,
} from 'lucide-react'

import type { AdminUserListRow, AdminUsersQuery, AdminUsersResponse } from '@/lib/api/admin'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { initials, statusBadge } from '@/components/admin/admin-learning/shared'

const PAGE_SIZES = [25, 50, 100]

interface Props {
  data: AdminUsersResponse
  query: AdminUsersQuery
}

export function AdminLearningPickerView({ data, query }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(query.search ?? '')
  const didMountSearch = useRef(false)

  const limit = query.limit ?? 25
  const offset = Number.parseInt(query.cursor ?? '0', 10) || 0
  const currentPage = Math.floor(offset / limit) + 1

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

  function updateQuery(patch: Partial<AdminUsersQuery>) {
    const params = new URLSearchParams(searchParams.toString())
    const next = { ...query, ...patch, sort: 'last_active_desc' as const }
    for (const [key, value] of Object.entries(next)) {
      if (key === 'sort') continue
      if (value === undefined || value === null || value === '') params.delete(key)
      else params.set(key, String(value))
    }
    startTransition(() => router.push(`/admin/learning?${params.toString()}`))
  }

  return (
    <div className="px-4 py-5 md:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Learning</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a learner to inspect read-only progress, mastery, sessions, and roadmaps.
          </p>
        </div>
        <Button variant="outline" render={<Link href="/admin/users" />}>
          <UserRound className="h-4 w-4" />
          User management
        </Button>
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <label className="min-w-[240px] flex-1 text-sm">
            <span className="mb-1 block text-muted-foreground">Search</span>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, email, or user ID"
              />
            </div>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Rows</span>
            <Select
              value={String(limit)}
              onValueChange={(v) => v && updateQuery({ limit: Number(v), cursor: undefined })}
            >
              <SelectTrigger className="w-[120px]">
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
          </label>
          {query.search && (
            <Button variant="ghost" size="sm" onClick={() => router.push('/admin/learning')}>
              <X className="h-4 w-4" /> Clear
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Learner</th>
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last active</th>
                  <th className="px-4 py-3">Learning screens</th>
                  <th className="px-4 py-3 w-24 text-right">Open</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="mx-auto flex max-w-md flex-col items-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                          <BookOpen className="h-6 w-6" />
                        </div>
                        <p className="mt-4 font-semibold">No learners found</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          No accounts match the current search. Try a different name or email.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.items.map((user) => <LearnerRow key={user.id} user={user} />)
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {currentPage} · {data.total.toLocaleString()} learners
          {isPending && ' · Updating…'}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset <= 0 || isPending}
            onClick={() => updateQuery({ cursor: String(Math.max(0, offset - limit)) })}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!data.nextCursor || isPending}
            onClick={() => data.nextCursor && updateQuery({ cursor: data.nextCursor })}
          >
            Next
          </Button>
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
        'border-b border-border/50 last:border-0 hover:bg-muted/30',
        user.status === 'DELETED' && 'text-muted-foreground',
      )}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user.avatarUrl ?? undefined} />
            <AvatarFallback>{initials(user.name || user.email)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <Link href={learningBase} className="font-medium hover:text-primary hover:underline">
              {user.name || 'Unnamed user'}
            </Link>
            <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <Link href={`/admin/orgs/${user.org.id}`} className="font-medium hover:text-primary hover:underline">
          {user.org.name}
        </Link>
        <div className="text-xs text-muted-foreground">{user.org.slug}</div>
      </td>
      <td className="px-4 py-3">
        {statusBadge(user.status)}
        <div className="mt-1 text-xs text-muted-foreground">{user.systemRole}</div>
      </td>
      <td className="px-4 py-3">
        <div>{user.lastActiveAt ? formatDistanceToNow(new Date(user.lastActiveAt), { addSuffix: true }) : 'Never'}</div>
        <div className="text-xs text-muted-foreground">Joined {format(new Date(user.createdAt), 'MMM d, yyyy')}</div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {links.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-border/70 px-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <Button size="sm" render={<Link href={learningBase} />}>
          Open
          <ChevronRight className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  )
}