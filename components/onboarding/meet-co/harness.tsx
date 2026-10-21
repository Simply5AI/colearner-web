'use client'

import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { SessionContext } from 'next-auth/react'
import { onboardingSteps, type OnboardingBand, type OnboardingState, type OnboardingStep } from '@/lib/api/onboarding'
import { applyFixtureSave, onboardingFixture, type OnboardingScenario } from './fixtures'
import { MeetCoIdentityProvider } from './identity'
import { MeetCoFlow } from './meet-co-flow'

const bands: OnboardingBand[] = ['kids', 'tweens', 'teens']
const scenarios: OnboardingScenario[] = ['default', 'preload', 'resume', 'no-subjects', 'suggestions', 'completed']
const names: Record<OnboardingBand, string> = { kids: 'Aarav', tweens: 'Mariam', teens: 'Rohan' }
const json = (data: unknown, status = 200) => new Response(JSON.stringify(status < 300 ? { data } : data), { status, headers: { 'Content-Type': 'application/json' } })

/** Optional in-page fixture server for `?mock=local`. Playwright instead routes real HTTP. */
function installLocalFixtures(initial: OnboardingState) {
  if (typeof window === 'undefined') return
  const flagged = window as unknown as { __meetCoFixtures?: boolean }
  if (flagged.__meetCoFixtures) return
  flagged.__meetCoFixtures = true
  let state = initial
  const original = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.origin)
    if (!url.pathname.startsWith('/api/onboarding')) return original(input, init)
    const method = (init?.method ?? 'GET').toUpperCase()
    if (url.pathname.endsWith('/complete')) return json({ nextRoute: 'IMPORT' })
    if (url.pathname.endsWith('/skip')) return state.skipAllowed ? json({ skipped: true }) : json({ code: 'SKIP_NOT_ALLOWED', message: 'Skip is not allowed.' }, 400)
    if (method === 'PUT') { state = applyFixtureSave(state, JSON.parse(String(init?.body))); return json(state) }
    return json(state)
  }
}

/** Development-only. Fixtures are synthetic and never reach production routes. */
export function MeetCoHarness() {
  const params = useSearchParams()
  const band = bands.find(item => item === params.get('band')) ?? 'teens'
  const scenario = scenarios.find(item => item === params.get('scenario')) ?? 'default'
  const step = onboardingSteps.find((item): item is OnboardingStep => item === params.get('step'))
  const dir = params.get('dir') === 'rtl' ? 'rtl' : 'ltr'
  const session = { expires: '2030-01-01T00:00:00.000Z', accessToken: 'b07-browser-fixture-session', user: { id: 'b07-browser-learner', email: 'fixture@example.invalid', name: names[band], onboardingCompleted: true } }
  useState(() => { if (params.get('mock') === 'local') installLocalFixtures(onboardingFixture({ band, scenario, ...(step ? { step } : {}) })) })
  return <SessionContext.Provider value={{ data: session, status: 'authenticated', update: async () => session }}>
    <div dir={dir} lang={dir === 'rtl' ? 'ar' : 'en'} className="min-h-screen bg-background text-foreground">
      <p role="note" className="border-b border-border bg-muted p-3 text-center text-sm font-bold">B07 development UI qualification · synthetic fixtures only · no real learner, school or AI data</p>
      <MeetCoIdentityProvider value={{ scope: `dev:${band}:${scenario}:${step ?? 'start'}`, learnerName: names[band], kind: 'account' }}><MeetCoFlow /></MeetCoIdentityProvider>
    </div>
  </SessionContext.Provider>
}
