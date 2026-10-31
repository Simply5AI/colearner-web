'use client'

import { RoleShell } from '@/components/roles/role-shell'
import { studentNavigation } from '@/components/roles/role-config'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { JoinResult, LearnBand, OverviewFilters } from '@/lib/api/learn'
import { LearnHomeSkeleton, LearnHomeView } from '../learn-home'
import { LearnLoadError } from '../learn-common'
import { LearnApiError } from '@/lib/api/learn-request'
import { LearnOverviewView } from '../learn-overview'
import { PlanDetailView } from '../learn-plan'
import { LearnSkeleton } from '../learn-common'
import { fixtureBands, homeFixture, overviewFixture, planFixture, type HomeState, type OverviewState, type PlanState } from './learn-fixtures'

const isBand = (value: string | null): value is LearnBand => fixtureBands.includes(value as LearnBand)

/** Development-only visual qualification of the real B07 views. All data is synthetic and no request is made. */
export function LearnBrowserHarness() {
  const params = useSearchParams()
  const screen = params.get('screen') ?? 'home'
  const band: LearnBand = isBand(params.get('band')) ? params.get('band') as LearnBand : 'teens'
  const state = params.get('state') ?? 'default'
  const dir = params.get('dir') === 'rtl' ? 'rtl' : 'ltr'
  useEffect(() => { const previous = document.documentElement.dir; document.documentElement.dir = dir; return () => { document.documentElement.dir = previous } }, [dir])
  // Fixture dates use the browser locale, so render the views after mount to keep server and client markup identical.
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  const content = !ready ? null : screen === 'home' ? <HomeScreen band={band} state={state} /> : screen === 'learn' ? <OverviewScreen band={band} state={state} /> : <PlanScreen band={band} state={state} />
  return <div className="min-h-screen bg-background text-foreground">
    <p role="note" className="border-b border-border bg-muted p-3 text-center text-sm font-bold">B07 development UI qualification · synthetic fixtures only · no real learner, AI or API</p>
    {params.get('shell') === '1' ? <RoleShell role="student" band={band} homeHref="/learn/home" navigation={studentNavigation(band, true)} identity={homeFixture(band).learner.displayName}>{content}</RoleShell> : content}
  </div>
}

function HomeScreen({ band, state }: { band: LearnBand; state: string }) {
  if (state === 'loading') return <LearnHomeSkeleton band={band} />
  if (state === 'denied') return <LearnLoadError band={band} error={new LearnApiError(403, 'This learner, plan or action is not permitted by the current school and guardian settings.')} retry={() => undefined} />
  if (state === 'unavailable') return <LearnLoadError band={band} error={new LearnApiError(503, 'Learning services are unavailable right now. Please try again.')} retry={() => undefined} />
  return <LearnHomeView data={homeFixture(band, state as HomeState)} />
}

function OverviewScreen({ band, state }: { band: LearnBand; state: string }) {
  const [filters, setFilters] = useState<OverviewFilters>({})
  const base = useMemo(() => overviewFixture(band, state as OverviewState), [band, state])
  const overview = useMemo(() => ({
    ...base,
    plans: base.plans.filter(plan => (!filters.q || plan.title.toLowerCase().includes(filters.q.toLowerCase())) && (!filters.subjectId || plan.subject?.id === filters.subjectId) && (!filters.kind || plan.kind === filters.kind) && (!filters.status || filters.status === 'PENDING_APPROVAL' ? !filters.status : plan.status === filters.status)),
  }), [base, filters])
  if (state === 'loading') return <LearnSkeleton band={band} label="Loading your plans" />
  // Fake decisions: minors are always pending guardian approval (decision Q05). Nothing is sent anywhere.
  const join = async (code: string): Promise<JoinResult> => {
    if (code.toUpperCase() === 'EXPIRED') throw new LearnApiError(404, 'That code has expired. Ask your teacher for a new one.', 'CODE_EXPIRED')
    return { status: 'PENDING_GUARDIAN_APPROVAL', enrollmentId: 'fixture-enrollment', planId: null }
  }
  return <LearnOverviewView key={`${band}:${state}`} overview={overview} filters={filters} onFiltersChange={setFilters} onJoin={join} initialJoinOpen={state === 'join-code'} />
}

function PlanScreen({ band, state }: { band: LearnBand; state: string }) {
  if (state === 'loading') return <LearnSkeleton band={band} label="Loading your plan" />
  if (state === 'denied') return <LearnLoadError band={band} error={new LearnApiError(404, 'This is unavailable, or you no longer have access to it.')} retry={() => undefined} backHref="/learn" backLabel="Back to Learn" />
  const { detail, expandedTopicId } = planFixture(band, state as PlanState)
  return <PlanDetailView key={`${band}:${state}`} detail={detail} band={band} initialExpandedTopicId={expandedTopicId} />
}
