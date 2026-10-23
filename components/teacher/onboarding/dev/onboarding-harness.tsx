'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { TeachingProvider } from '@/components/teacher/teaching-context'
import { TeacherOnboardingView } from '@/components/teacher/onboarding/onboarding-flow'
import { createOnboardingMock } from './onboarding-mock'

function FixtureControls({ publish }: { publish: () => void }) {
  const client = useQueryClient()
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 bg-muted p-2 text-xs" data-testid="fixture-controls">
      <span>Fixture control, not part of the product:</span>
      <button type="button" data-testid="fixture-publish" className="min-h-9 rounded-lg border border-border bg-card px-3 font-semibold" onClick={() => { publish(); void client.invalidateQueries({ queryKey: ['teaching'] }) }}>
        Simulate: plan published in the editor
      </button>
    </div>
  )
}

/** Development only. Synthetic, stateful fixtures; the real platform is never called. */
export function TeacherOnboardingHarness() {
  const params = useSearchParams()
  const state = params.get('state') ?? 'profile'
  const photo = params.get('photo') !== 'off'
  const conflict = params.get('conflict') === '1'
  const assignFail = params.get('assignFail') === '1'
  const materialFail = params.get('materialFail') === '1'
  const dir = params.get('dir') === 'rtl' ? 'rtl' : 'ltr'
  const mock = useMemo(
    () => createOnboardingMock({ state, photo, conflict, assignFail, materialFail }),
    [state, photo, conflict, assignFail, materialFail],
  )
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const previousDir = document.documentElement.dir
    document.documentElement.dir = dir
    const original = window.fetch
    // The presigned upload target is a fixture host; answer it locally.
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.startsWith('https://fixture-storage.invalid/')) return new Response(null, { status: 200 })
      return original(input, init)
    }
    setReady(true)
    return () => {
      window.fetch = original
      document.documentElement.dir = previousDir
    }
  }, [dir])
  return (
    <div className="min-h-screen bg-background text-foreground">
      <p role="note" data-testid="fixture-banner" className="bg-muted p-3 text-center text-sm">
        B12 development fixtures · synthetic data · no live school, database or AI
      </p>
      {ready && (
        <TeachingProvider schoolId="school-fixture" schoolName="Fixture Public School" requestImpl={mock.request}>
          <FixtureControls publish={mock.publishPlan} />
          <TeacherOnboardingView />
        </TeachingProvider>
      )}
    </div>
  )
}
