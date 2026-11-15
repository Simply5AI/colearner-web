'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getTutorWorkspaceScope,
  tutorLoopClient,
  type LearnerGoal,
  type TutorEntryResponse,
  type TutorIcon,
} from '@/lib/api/tutor-loop/client'
import { computeCountdown } from '@/lib/tutor-loop/date'

export interface TutorShellValue {
  /** `loading` keeps the legacy shell; `enabled` switches to the Today / Learn / Practice shell. */
  state: 'loading' | 'enabled' | 'disabled'
  entry: TutorEntryResponse | null
  band: 'teens' | 'adults'
  tutorName: string
  tutorIcon: TutorIcon
  canUseTutor: boolean
  goals: LearnerGoal[]
  nextExam: { goal: LearnerGoal; daysLeft: number; label: string } | null
}

const fallback: TutorShellValue = {
  state: 'loading', entry: null, band: 'teens', tutorName: 'Co', tutorIcon: 'SPROUT', canUseTutor: true, goals: [], nextExam: null,
}
const Ctx = createContext<TutorShellValue>(fallback)

/** Server-resolved entry from the layout: `entry` when Tutor Loop is on, `disabled` when it is known to be off. */
export type TutorEntrySeed = { entry: TutorEntryResponse } | { disabled: true }
const SeedCtx = createContext<TutorEntrySeed | undefined>(undefined)
export function TutorEntrySeedProvider({ seed, children }: { seed: TutorEntrySeed; children: ReactNode }) {
  return <SeedCtx.Provider value={seed}>{children}</SeedCtx.Provider>
}
export const useTutorShell = () => useContext(Ctx)

export const tutorIconSrc = (icon: TutorIcon, state: 'idle' | 'resting' | 'thinking' = 'idle') =>
  `/tutor-loop/${icon.toLowerCase()}-${state}.svg`

/** Reads the entry and the active goals once for the shell. A 403 (flag off, ineligible band) keeps the legacy shell. */
export function TutorShellProvider({ children }: { children: ReactNode }) {
  const workspace = getTutorWorkspaceScope()
  const seed = useContext(SeedCtx)
  const known = seed !== undefined
  const entryQuery = useQuery({
    queryKey: ['tutor-shell', 'entry', workspace],
    queryFn: () => tutorLoopClient.entry({ workspace }),
    retry: false,
    staleTime: 60_000,
    // A seeded entry renders on the first paint; a seeded "disabled" never calls the API.
    enabled: !(seed && 'disabled' in seed),
    initialData: seed && 'entry' in seed ? seed.entry : undefined,
  })
  const enabled = !!entryQuery.data && !entryQuery.data.needsConsent
  const goalsQuery = useQuery({
    queryKey: ['tutor-shell', 'goals', workspace],
    queryFn: () => tutorLoopClient.goals(false, { workspace }),
    enabled,
    retry: false,
    staleTime: 30_000,
  })
  const value = useMemo<TutorShellValue>(() => {
    if (seed && 'disabled' in seed) return { ...fallback, state: 'disabled' }
    if (entryQuery.isPending) return fallback
    if (!entryQuery.data || entryQuery.error) {
      return { ...fallback, state: 'disabled' }
    }
    const entry = entryQuery.data
    const goals = (goalsQuery.data?.items ?? []).filter((g) => g.status === 'ACTIVE')
    let nextExam: TutorShellValue['nextExam'] = null
    for (const goal of goals) {
      const date = goal.exam?.date
      const c = date ? computeCountdown(date) : null
      if (goal.kind === 'EXAM' && c && c.state !== 'PASSED' && (!nextExam || c.daysLeft < nextExam.daysLeft)) {
        nextExam = { goal, daysLeft: c.daysLeft, label: c.shortLabel }
      }
    }
    return {
      state: entry.needsConsent ? 'disabled' : 'enabled',
      entry,
      band: entry.band === '18+' ? 'adults' : 'teens',
      tutorName: entry.tutorIdentity?.name || 'Co',
      tutorIcon: entry.tutorIdentity?.icon ?? 'SPROUT',
      canUseTutor: entry.capabilities.canUseTutor,
      goals,
      nextExam,
    }
  }, [seed, entryQuery.isPending, entryQuery.data, entryQuery.error, goalsQuery.data])
  void known
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
