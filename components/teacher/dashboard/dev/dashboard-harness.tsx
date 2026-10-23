'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { TeachingProvider } from '@/components/teacher/teaching-context'
import { TeacherDashboardView } from '@/components/teacher/dashboard/dashboard-view'
import { createDashboardMock } from './dashboard-mock'

/** Development only. Synthetic fixtures; the real platform is never called. */
export function TeacherDashboardHarness() {
  const params = useSearchParams()
  const state = params.get('state') ?? 'default'
  const assign = params.get('assign') === 'fail' ? 'fail' : 'ok'
  const dir = params.get('dir') === 'rtl' ? 'rtl' : 'ltr'
  const requestImpl = useMemo(() => createDashboardMock({ state, assign }), [state, assign])
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const previous = document.documentElement.dir
    document.documentElement.dir = dir
    setReady(true)
    return () => {
      document.documentElement.dir = previous
    }
  }, [dir])
  return (
    <div className="min-h-screen bg-background text-foreground">
      <p role="note" data-testid="fixture-banner" className="bg-muted p-3 text-center text-sm">
        B12 development fixtures · synthetic data · no live school, database or AI
      </p>
      {ready && (
        <TeachingProvider schoolId="school-fixture" schoolName="Fixture Public School" requestImpl={requestImpl}>
          <TeacherDashboardView />
        </TeachingProvider>
      )}
    </div>
  )
}
