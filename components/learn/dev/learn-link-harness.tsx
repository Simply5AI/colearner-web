'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import type { LearnBand } from '@/lib/api/learn'
import { linkStages, type LinkStage } from '@/lib/api/learn-link'
import { LearnIdentityProvider } from '../learn-common'
import { LearnLinkScreen } from '../learn-link'

const bands: LearnBand[] = ['kids', 'tweens', 'teens']

/**
 * Development-only. Renders the real fetching screen; the data comes from whatever answers
 * /api/learn/link-status (Playwright routes it to synthetic fixtures). No credential is used.
 * `?stage=` and `?state=` are echoed in the banner only so a reviewer knows what to route.
 */
export function LearnLinkHarness() {
  const params = useSearchParams()
  const band = bands.find(item => item === params.get('band')) ?? 'teens'
  const stage = linkStages.find((item): item is LinkStage => item === params.get('stage')) ?? 'NEEDS_ROSTER_LINK'
  const state = params.get('state') ?? 'default'
  const dir = params.get('dir') === 'rtl' ? 'rtl' : 'ltr'
  useEffect(() => { const previous = document.documentElement.dir; document.documentElement.dir = dir; return () => { document.documentElement.dir = previous } }, [dir])
  return <div className="min-h-screen bg-background text-foreground">
    <p role="note" className="border-b border-border bg-muted p-3 text-center text-sm font-bold">B03 link development UI qualification · synthetic fixtures only · stage {stage} · {state} · no real learner or API</p>
    <LearnIdentityProvider scope={`dev:link:${band}:${stage}:${state}`} band={band}><LearnLinkScreen /></LearnIdentityProvider>
  </div>
}
