'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { ArrowLeft } from 'lucide-react'

import type { AdminLearningUser, AdminLearningUserStatus } from '@/lib/api/admin'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface LearningViewProps<T> {
  data: T
  user: AdminLearningUser
  authHeaders: Record<string, string>
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function statusBadge(status: AdminLearningUserStatus | string) {
  if (status === 'SUSPENDED') return <Badge variant="destructive">Suspended</Badge>
  if (status === 'DELETED') return <Badge variant="outline">Deleted</Badge>
  return <Badge variant="secondary">Active</Badge>
}

export function recordBadge(value: string) {
  const normalized = value.toLowerCase().replace(/_/g, ' ')
  if (value === 'WEAK' || value === 'ABANDONED') return <Badge variant="destructive">{normalized}</Badge>
  if (value === 'MASTERED' || value === 'COMPLETED' || value === 'ACTIVE') return <Badge variant="secondary">{normalized}</Badge>
  if (value === 'GENERATING') return <Badge variant="outline">{normalized}</Badge>
  return <Badge variant="outline">{normalized}</Badge>
}

export function formatDate(value: string | null | undefined) {
  if (!value) return 'No data yet'
  return format(new Date(value), 'PP p')
}

export function relativeDate(value: string | null | undefined) {
  if (!value) return 'No data yet'
  return formatDistanceToNow(new Date(value), { addSuffix: true })
}

export function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return 'No data yet'
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  if (minutes === 0) return `${remaining}s`
  return `${minutes}m ${remaining}s`
}

export function EmptyState({ children = 'No data yet' }: { children?: string }) {
  return <div className="px-4 py-8 text-center text-sm text-muted-foreground">{children}</div>
}

export function AdminLearningLayout({
  user,
  active,
  children,
}: {
  user: AdminLearningUser
  active: 'overview' | 'mastery' | 'sessions' | 'roadmaps'
  children: React.ReactNode
}) {
  const tabs = [
    { key: 'overview', label: 'Overview', href: `/admin/users/${user.id}/learning` },
    { key: 'mastery', label: 'Mastery', href: `/admin/users/${user.id}/learning/mastery` },
    { key: 'sessions', label: 'Sessions', href: `/admin/users/${user.id}/learning/sessions` },
    { key: 'roadmaps', label: 'Roadmaps', href: `/admin/users/${user.id}/learning/roadmaps` },
  ] as const

  return (
    <div className="px-4 py-5 md:px-6 lg:px-8">
      <div className="mb-4">
        <Link href={`/admin/users/${user.id}`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          <ArrowLeft className="h-4 w-4" />
          Back to user
        </Link>
      </div>

      <div className="sticky top-0 z-10 -mx-4 mb-5 border-b bg-background/95 px-4 py-4 backdrop-blur md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar className="h-14 w-14">
            <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{user.name}</h1>
              {statusBadge(user.status)}
              <Badge variant="outline">{user.systemRole}</Badge>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {user.email} - <span className="text-foreground/80">{user.org.name}</span>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={cn(
                'inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition-colors',
                active === tab.key
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:bg-muted'
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {children}
    </div>
  )
}

export function useLearningFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const params = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams])

  const replaceWithParams = useCallback((next: URLSearchParams) => {
    next.delete('cursor')
    const qs = next.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [pathname, router])

  const setParam = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    replaceWithParams(next)
  }, [params, replaceWithParams])

  const setParams = useCallback((updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value)
      else next.delete(key)
    })
    replaceWithParams(next)
  }, [params, replaceWithParams])

  const clearParams = useCallback(() => {
    router.replace(pathname, { scroll: false })
  }, [pathname, router])

  return { params, setParam, setParams, clearParams, pathname, router }
}

export function DebouncedInput({
  defaultValue,
  placeholder,
  onValue,
}: {
  defaultValue?: string
  placeholder: string
  onValue: (value: string) => void
}) {
  const [value, setValue] = useState(defaultValue ?? '')

  useEffect(() => {
    const timeout = window.setTimeout(() => onValue(value), 300)
    return () => window.clearTimeout(timeout)
  }, [onValue, value])

  return (
    <Input
      value={value}
      onChange={(event) => setValue(event.target.value)}
      placeholder={placeholder}
      className="h-9 min-w-[220px]"
    />
  )
}

export function CursorPager({
  nextCursor,
}: {
  nextCursor: string | null
}) {
  const { params, setParam, pathname, router } = useLearningFilters()
  const limit = params.get('limit') ?? '50'

  const goNext = () => {
    if (!nextCursor) return
    const next = new URLSearchParams(params.toString())
    next.set('cursor', nextCursor)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  const reset = () => {
    const next = new URLSearchParams(params.toString())
    next.delete('cursor')
    const qs = next.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>Rows</span>
        <Select value={limit} onValueChange={(value) => value && setParam('limit', value)}>
          <SelectTrigger className="h-8 w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={reset} disabled={!params.get('cursor')}>
          Previous
        </Button>
        <Button variant="outline" size="sm" onClick={goNext} disabled={!nextCursor}>
          Next
        </Button>
      </div>
    </div>
  )
}
