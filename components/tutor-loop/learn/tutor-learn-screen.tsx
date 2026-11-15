'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AgeBandScope } from '@/components/design-system'
import { cn } from '@/lib/utils'
import { GoalRow, buildHrefWithGoal, useGoalFilter } from '@/lib/tutor-loop/goal-filter'
import { learnSubTabs } from '@/components/tutor-loop/shell/tutor-nav'
import { useTutorShell } from '@/components/tutor-loop/shell/tutor-shell-context'
import { MyPlan } from './my-plan'
import { LibraryTab } from '@/components/tutor-loop/library/library-tab'
import { NotesTab } from '@/components/tutor-loop/library/notes-tab'

type Tab = 'plan' | 'library' | 'notes'
const tabOf = (v: string | null): Tab => (v === 'library' || v === 'notes' ? v : 'plan')

function Body() {
  const params = useSearchParams()
  const shell = useTutorShell()
  const filter = useGoalFilter()
  const tab = tabOf(params.get('tab'))
  return <AgeBandScope band={shell.band} className="mx-auto w-full max-w-[1000px] space-y-4 px-4 pb-24 pt-6 sm:px-6">
    <GoalRow goals={shell.goals} selectedGoalId={filter.goalId} onSelectGoal={filter.setGoalId} />
    <div role="tablist" aria-label="Learn" className="inline-flex gap-0.5 rounded-full bg-muted p-1">
      {learnSubTabs().map((t) => <Link key={t.id} role="tab" aria-selected={tab === t.id} href={buildHrefWithGoal(t.href, filter.goalId)} scroll={false}
        className={cn('inline-flex min-h-10 items-center rounded-full px-4 text-sm font-bold', tab === t.id ? 'bg-background shadow-sm' : 'text-muted-foreground')}>{t.label}</Link>)}
    </div>
    {tab === 'plan' && <MyPlan goalId={filter.goalId} />}
    {tab === 'library' && <LibraryTab goalId={filter.goalId} />}
    {tab === 'notes' && <NotesTab goalId={filter.goalId} />}
  </AgeBandScope>
}

/** TL06 / TL15: Learn with My plan, Library and Notes. Replaces the legacy overview for eligible learners only. */
export function TutorLearnScreen() {
  return <Suspense fallback={null}><Body /></Suspense>
}
