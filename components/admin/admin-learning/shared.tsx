'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import {
  ArrowLeft,
  BookOpen,
  Clock,
  ListChecks,
  Map,
  type LucideIcon,
} from 'lucide-react'

import type {
  AdminLearningActivityRow,
  AdminLearningUser,
  AdminLearningUserStatus,
} from '@/lib/api/admin'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface LearningViewProps<T> {
  data: T
  user: AdminLearningUser
  authHeaders: Record<string, string>
}

const LEARNING_TABS = [
  { key: 'overview', label: 'Overview', icon: BookOpen },
  { key: 'mastery', label: 'Mastery', icon: ListChecks },
  { key: 'sessions', label: 'Sessions', icon: Clock },
  { key: 'roadmaps', label: 'Roadmaps', icon: Map },
] as const

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

export function activityMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {}
  return metadata as Record<string, unknown>
}

export function formatLearningActivity(item: AdminLearningActivityRow): {
  title: string
  detail?: string
} {
  const metadata = activityMetadata(item.metadata)

  if (item.subject === 'RecallSession' && item.action === 'completed') {
    const parts: string[] = []
    if (typeof metadata.accuracy === 'number') {
      parts.push(`${Math.round(metadata.accuracy * 100)}% accuracy`)
    }
    if (typeof metadata.durationSeconds === 'number') {
      parts.push(formatDuration(metadata.durationSeconds))
    }
    return {
      title: 'Completed a recall session',
      detail: parts.join(' · ') || undefined,
    }
  }

  if (item.subject === 'RecallAttempt' && item.action === 'scored') {
    const parts: string[] = []
    if (typeof metadata.isCorrect === 'boolean') {
      parts.push(metadata.isCorrect ? 'Correct answer' : 'Incorrect answer')
    }
    if (typeof metadata.score === 'number') {
      parts.push(`Score ${Math.round(metadata.score * 100)}%`)
    }
    return {
      title: 'Answered a recall question',
      detail: parts.join(' · ') || undefined,
    }
  }

  if (item.subject === 'RecallAttempt' && item.action === 'tutoring_requested') {
    return { title: 'Requested tutoring help on a question' }
  }

  if (item.subject === 'Extraction' && item.action === 'captured') {
    const sourceType = typeof metadata.sourceType === 'string' ? metadata.sourceType.toLowerCase() : 'content'
    const source = typeof metadata.source === 'string' ? metadata.source : null
    return {
      title: `Captured new ${sourceType}`,
      detail: source ? truncateText(source, 72) : undefined,
    }
  }

  if (item.subject === 'Concept') {
    return { title: `${humanizeAction(item.action)} concept mastery` }
  }

  if (item.subject === 'Roadmap') {
    return { title: `${humanizeAction(item.action)} roadmap` }
  }

  return {
    title: `${humanizeAction(item.action)} ${humanizeSubject(item.subject)}`,
  }
}

function humanizeAction(action: string) {
  return action.replace(/[._]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function humanizeSubject(subject: string) {
  return subject.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
}

function truncateText(value: string, max: number) {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}

export function EmptyState({
  children = 'No data yet',
  hint,
}: {
  children?: string
  hint?: string
}) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{children}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  )
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
  const learningBase = `/admin/users/${user.id}/learning`

  return (
    <div className="px-4 py-5 md:px-6 lg:px-8">
      <div className="mb-5">
        <Link href={`/admin/users/${user.id}`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), '-ml-2')}>
          <ArrowLeft className="h-4 w-4" />
          Back to user
        </Link>
      </div>

      <div className="sticky top-0 z-10 -mx-4 mb-6 border-b border-border/70 bg-background/95 px-4 py-4 backdrop-blur md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start gap-4">
            <Avatar className="h-14 w-14 ring-2 ring-background">
              <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
              <AvatarFallback>{initials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
                {statusBadge(user.status)}
                <Badge variant="outline">{user.systemRole}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <Link
                  href={`/admin/orgs/${user.org.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {user.org.name}
                </Link>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">Read-only learning profile</span>
              </div>
            </div>
          </div>

          <nav className="mt-5 inline-flex flex-wrap gap-1 rounded-lg border border-border/70 bg-muted/40 p-1">
            {LEARNING_TABS.map((tab) => {
              const href = tab.key === 'overview' ? learningBase : `${learningBase}/${tab.key}`
              const Icon = tab.icon
              return (
                <Link
                  key={tab.key}
                  href={href}
                  className={cn(
                    'inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
                    active === tab.key
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </Link>
              )
            })}
          </nav>
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

export type LearningTabIcon = LucideIcon

export const MASTERY_LEVEL_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  NEW: { label: 'New', color: '#64748b', bg: 'bg-slate-500/10' },
  LEARNING: { label: 'Learning', color: '#D97706', bg: 'bg-amber-500/10' },
  REVIEW: { label: 'Review', color: '#2563EB', bg: 'bg-blue-500/10' },
  WEAK: { label: 'Weak', color: '#DC2626', bg: 'bg-red-500/10' },
  MASTERED: { label: 'Mastered', color: '#16A34A', bg: 'bg-emerald-500/10' },
}

export function LearningPageIntro({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mb-6 max-w-3xl">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export function LearningFiltersCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="mb-5 py-0">
      <CardContent className="flex flex-wrap items-end gap-3 p-4">{children}</CardContent>
    </Card>
  )
}

export function LearningDataSection({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
      <div className="border-b border-border/70 px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
      {footer}
    </section>
  )
}