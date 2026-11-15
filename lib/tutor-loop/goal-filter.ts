'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { LearnerGoal } from '@/lib/api/tutor-loop/client'
import { computeCountdown, formatTutorDate } from './date'

/* ---------- Shared store so selected goal persists across Learn & Practice ---------- */

let sharedGoalId: string | null = null
let storageHydrated = false
const listeners = new Set<() => void>()
const GOAL_STORAGE_KEY = 'colearner.tutor.selected-goal'

function readStoredGoalId(): string | null {
  try {
    const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem(GOAL_STORAGE_KEY) : null
    return raw && /^[A-Za-z0-9-]{8,64}$/.test(raw) ? raw : null
  } catch {
    return null
  }
}

function writeStoredGoalId(goalId: string | null) {
  try {
    if (typeof window === 'undefined') return
    if (goalId) window.sessionStorage.setItem(GOAL_STORAGE_KEY, goalId)
    else window.sessionStorage.removeItem(GOAL_STORAGE_KEY)
  } catch {
    // Storage can be blocked (private windows); the URL and in-memory store still carry the selection.
  }
}

/** Restores the last selected goal once per page load, so Learn and Practice keep it across full navigations. */
export function hydrateSharedGoalId() {
  if (storageHydrated) return
  storageHydrated = true
  if (sharedGoalId === null) {
    const stored = readStoredGoalId()
    if (stored) setSharedGoalId(stored)
  }
}

function subscribeGoalStore(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getSharedGoalId(): string | null {
  return sharedGoalId
}

export function setSharedGoalId(nextGoalId: string | null) {
  const normalized = nextGoalId && nextGoalId.trim() ? nextGoalId.trim() : null
  if (sharedGoalId === normalized) return
  sharedGoalId = normalized
  writeStoredGoalId(normalized)
  for (const listener of listeners) listener()
}

export function resetSharedGoalIdForTests() {
  sharedGoalId = null
  storageHydrated = false
  writeStoredGoalId(null)
  for (const listener of listeners) listener()
}

export function buildHrefWithGoal(
  baseHref: string,
  goalId: string | null | undefined = sharedGoalId,
): string {
  const [pathPart, hashPart] = baseHref.split('#')
  const [pathname, queryPart] = (pathPart ?? '').split('?')
  const params = new URLSearchParams(queryPart ?? '')
  if (goalId && goalId.trim()) {
    params.set('goalId', goalId.trim())
  } else {
    params.delete('goalId')
  }
  const qs = params.toString()
  return `${pathname}${qs ? `?${qs}` : ''}${hashPart ? `#${hashPart}` : ''}`
}

export interface GoalFilterContextValue {
  goalId: string | null
  selectedGoalId: string | null
  setGoalId: (goalId: string | null) => void
  selectGoal: (goalId: string | null) => void
  clearGoal: () => void
  buildHrefWithGoal: (baseHref: string, overrideGoalId?: string | null) => string
}

const GoalFilterContext = createContext<GoalFilterContextValue | null>(null)

function useSafeSearchParams(): URLSearchParams | null {
  try {
    return useSearchParams()
  } catch {
    return null
  }
}

function useSafeRouter(): ReturnType<typeof useRouter> | null {
  try {
    return useRouter()
  } catch {
    return null
  }
}

function useSafePathname(): string | null {
  try {
    return usePathname()
  } catch {
    return null
  }
}

export function GoalFilterProvider({
  initialGoalId,
  syncUrl = true,
  children,
}: {
  initialGoalId?: string | null
  syncUrl?: boolean
  children: ReactNode
}) {
  const value = useGoalFilterInternal({ initialGoalId, syncUrl })
  return React.createElement(GoalFilterContext.Provider, { value }, children)
}

function useGoalFilterInternal(options?: {
  initialGoalId?: string | null
  syncUrl?: boolean
}): GoalFilterContextValue {
  const searchParams = useSafeSearchParams()
  const router = useSafeRouter()
  const pathname = useSafePathname()
  const syncUrl = options?.syncUrl ?? true

  const storeGoalId = useSyncExternalStore(
    subscribeGoalStore,
    getSharedGoalId,
    () => options?.initialGoalId ?? null,
  )

  const urlGoalId = useMemo(() => {
    const raw = searchParams?.get('goalId')
    return raw && raw.trim() ? raw.trim() : null
  }, [searchParams])

  useEffect(() => {
    if (urlGoalId === null && !options?.initialGoalId) hydrateSharedGoalId()
  }, [urlGoalId, options?.initialGoalId])

  useEffect(() => {
    if (options?.initialGoalId !== undefined && sharedGoalId === null && options.initialGoalId) {
      setSharedGoalId(options.initialGoalId)
    }
  }, [options?.initialGoalId])

  useEffect(() => {
    if (urlGoalId !== null && urlGoalId !== sharedGoalId) {
      setSharedGoalId(urlGoalId)
    }
  }, [urlGoalId])

  const effectiveGoalId = urlGoalId ?? storeGoalId

  const setGoalId = useCallback(
    (nextGoalId: string | null) => {
      const normalized = nextGoalId && nextGoalId.trim() ? nextGoalId.trim() : null
      setSharedGoalId(normalized)
      if (syncUrl && pathname) {
        const params = new URLSearchParams(searchParams?.toString() ?? '')
        if (normalized) {
          params.set('goalId', normalized)
        } else {
          params.delete('goalId')
        }
        const qs = params.toString()
        const targetUrl = `${pathname}${qs ? `?${qs}` : ''}`
        if (router && typeof router.replace === 'function') {
          router.replace(targetUrl, { scroll: false })
        } else if (typeof window !== 'undefined' && window.history?.replaceState) {
          window.history.replaceState(null, '', targetUrl)
        }
      }
    },
    [pathname, router, searchParams, syncUrl],
  )

  const clearGoal = useCallback(() => setGoalId(null), [setGoalId])

  const makeHref = useCallback(
    (baseHref: string, overrideGoalId?: string | null) =>
      buildHrefWithGoal(baseHref, overrideGoalId === undefined ? effectiveGoalId : overrideGoalId),
    [effectiveGoalId],
  )

  return useMemo(
    () => ({
      goalId: effectiveGoalId,
      selectedGoalId: effectiveGoalId,
      setGoalId,
      selectGoal: setGoalId,
      clearGoal,
      buildHrefWithGoal: makeHref,
    }),
    [effectiveGoalId, setGoalId, clearGoal, makeHref],
  )
}

export function useGoalFilter(options?: {
  initialGoalId?: string | null
  syncUrl?: boolean
}): GoalFilterContextValue {
  const ctx = useContext(GoalFilterContext)
  const internal = useGoalFilterInternal(options)
  return ctx ?? internal
}

/* ---------- Shared <GoalRow /> Component ---------- */

export interface GoalRowItem {
  id: string
  title: string
  kind?: LearnerGoal['kind'] | string
  dueDate?: string | null
  exam?: { date?: string | null; passMarkPercent?: number | null } | null
}

export interface GoalRowProps {
  goals: GoalRowItem[]
  selectedGoalId?: string | null
  onSelectGoal?: (goalId: string | null) => void
  onAddGoal?: () => void
  addGoalHref?: string
  showAddGoal?: boolean
  todayDate?: string
  className?: string
}

function formatGoalSubtitle(goal: GoalRowItem, todayDate?: string): string | null {
  const examDate = goal.exam?.date
  if (examDate) {
    const countdown = computeCountdown(examDate, todayDate)
    return countdown ? countdown.shortLabel : formatTutorDate(examDate, { includeYear: false })
  }
  if (goal.dueDate) {
    return `Due ${formatTutorDate(goal.dueDate, { includeYear: false })}`
  }
  return null
}

export function GoalRow({
  goals,
  selectedGoalId: controlledGoalId,
  onSelectGoal,
  onAddGoal,
  addGoalHref = '/learn/start?step=goal',
  showAddGoal = true,
  todayDate,
  className,
}: GoalRowProps) {
  const filter = useGoalFilter()
  const activeGoalId = controlledGoalId === undefined ? filter.goalId : controlledGoalId
  const handleSelect = onSelectGoal ?? filter.setGoalId

  const allSelected = !activeGoalId

  return React.createElement(
    'div',
    {
      role: 'radiogroup',
      'aria-label': 'Goal',
      'data-testid': 'tutor-goal-row',
      className: [
        'flex w-full items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      ]
        .filter(Boolean)
        .join(' '),
    },
    React.createElement(
      'b',
      {
        className: 'shrink-0 text-[13px] font-bold text-[var(--color-neutral-700,var(--muted-foreground))]',
      },
      'Goal',
    ),
    React.createElement(
      'button',
      {
        type: 'button',
        role: 'radio',
        'aria-checked': allSelected,
        'data-testid': 'goal-chip-all',
        onClick: () => handleSelect(null),
        className: [
          'min-h-[38px] shrink-0 cursor-pointer whitespace-nowrap rounded-full border-[1.5px] px-3.5 text-sm font-bold transition-colors',
          allSelected
            ? 'border-[var(--color-accent-600,var(--primary))] bg-[var(--color-accent-100,var(--secondary))] text-[var(--color-accent-700,var(--secondary-foreground))]'
            : 'border-[var(--color-divider,var(--border))] bg-[var(--color-bg,var(--card))] text-[var(--color-text,var(--foreground))] hover:bg-[var(--color-neutral-100,var(--muted))]',
        ].join(' '),
      },
      'All goals',
    ),
    ...goals.map((goal) => {
      const selected = activeGoalId === goal.id
      const sub = formatGoalSubtitle(goal, todayDate)
      return React.createElement(
        'button',
        {
          key: goal.id,
          type: 'button',
          role: 'radio',
          'aria-checked': selected,
          'data-testid': `goal-chip-${goal.id}`,
          onClick: () => handleSelect(goal.id),
          className: [
            'min-h-[38px] shrink-0 cursor-pointer whitespace-nowrap rounded-full border-[1.5px] px-3.5 text-sm font-bold transition-colors',
            selected
              ? 'border-[var(--color-accent-600,var(--primary))] bg-[var(--color-accent-100,var(--secondary))] text-[var(--color-accent-700,var(--secondary-foreground))]'
              : 'border-[var(--color-divider,var(--border))] bg-[var(--color-bg,var(--card))] text-[var(--color-text,var(--foreground))] hover:bg-[var(--color-neutral-100,var(--muted))]',
          ].join(' '),
        },
        goal.title,
        sub
          ? React.createElement(
              'span',
              { className: 'ms-1.5 font-normal opacity-80' },
              `· ${sub}`,
            )
          : null,
      )
    }),
    showAddGoal
      ? onAddGoal
        ? React.createElement(
            'button',
            {
              type: 'button',
              'data-testid': 'goal-chip-add',
              onClick: onAddGoal,
              className:
                'min-h-[38px] shrink-0 cursor-pointer whitespace-nowrap rounded-full border-[1.5px] border-dashed border-[var(--color-neutral-400,var(--border))] bg-transparent px-3.5 text-sm font-bold text-[var(--color-accent-700,var(--primary))] hover:bg-[var(--color-accent-100,var(--secondary))]',
            },
            '+ Add goal',
          )
        : React.createElement(
            Link,
            {
              href: addGoalHref,
              ...({ 'data-testid': 'goal-chip-add' } as Record<string, string>),
              className:
                'inline-flex min-h-[38px] shrink-0 items-center whitespace-nowrap rounded-full border-[1.5px] border-dashed border-[var(--color-neutral-400,var(--border))] bg-transparent px-3.5 text-sm font-bold text-[var(--color-accent-700,var(--primary))] hover:bg-[var(--color-accent-100,var(--secondary))]',
            },
            '+ Add goal',
          )
      : null,
  )
}
