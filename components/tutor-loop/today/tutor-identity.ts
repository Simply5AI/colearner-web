'use client'

import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { getTutorWorkspaceScope, tutorLoopClient, type TutorIcon } from '@/lib/api/tutor-loop/client'

export interface TutorIdentityView {
  workspace: 'school' | 'personal'
  tutorName: string
  tutorIcon: TutorIcon
  adult: boolean
}

/** Shares the shell's entry query key so the tutor's name, icon and band are read once per page. */
export function useTutorIdentity(): TutorIdentityView {
  const workspace = getTutorWorkspaceScope()
  const entry = useQuery({
    queryKey: ['tutor-shell', 'entry', workspace],
    queryFn: () => tutorLoopClient.entry({ workspace }),
    retry: false,
    staleTime: 60_000,
  })
  return {
    workspace,
    tutorName: entry.data?.tutorIdentity?.name || 'Co',
    tutorIcon: entry.data?.tutorIdentity?.icon ?? 'SPROUT',
    adult: entry.data?.band === '18+',
  }
}

export function useLearnerFirstName(): string | null {
  const { data } = useSession()
  const name = data?.user?.name?.trim()
  return name ? (name.split(/\s+/)[0] ?? null) : null
}

export const coArt = (icon: TutorIcon, state: 'idle' | 'speaking' | 'resting' | 'celebrating' | 'thinking' | 'concerned' = 'idle') =>
  `/tutor-loop/${icon.toLowerCase()}-${state}.svg`

export const ITEM_KIND_LABEL: Record<string, string> = {
  TEACHER_DUE: 'From your teacher',
  REVIEW: 'Review',
  LESSON: 'Lesson',
  PRACTICE: 'Practice',
  TEACH_BACK: 'Teach it back',
  MOCK: 'Practice exam',
}

export const itemKindLabel = (kind: string) => ITEM_KIND_LABEL[kind] ?? 'Study'
