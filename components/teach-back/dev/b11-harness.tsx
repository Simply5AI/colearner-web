'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { LearnIdentityProvider } from '@/components/learn/learn-common'
import { CoCharacter } from '@/components/design-system'
import { TeachSessionScreen } from '../teach-view'
import { ProgressScreen } from '@/components/learn-progress/progress-view'
import type { LearnBand } from '@/lib/api/learn'
import { createTeachFixtureFlow, progress } from './b11-fixtures'

/** Development only. All responses are synthetic; no platform or model is called. */
export function B11Harness({ kind }: { kind: 'teach' | 'progress' }) {
  const params = useSearchParams()
  const band: LearnBand = params.get('band') === 'kids' ? 'kids' : params.get('band') === 'tweens' ? 'tweens' : 'teens'
  const state = params.get('state') ?? (kind === 'teach' ? 'feedback' : 'ready')
  const signature = params.toString()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const original = window.fetch
    const flow = createTeachFixtureFlow(band, state)
    const envelope = (data: unknown) => Response.json({ statusCode: 200, data, timestamp: '2026-10-21T08:00:00Z' })
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (!url.includes('/api/learn/')) return original(input, init)
      if (state === 'denied') return Response.json({ code: 'FORBIDDEN' }, { status: 403 })
      if (url.endsWith('/progress/export.csv')) return new Response('subject,concept,mastery,evidence,attempts,successRate\nScience,Water cycle,PRACTICING,ENOUGH,5,0.4', { headers: { 'Content-Type': 'text/csv' } })
      if (url.endsWith('/progress')) return envelope(progress(band, state))
      if (url.endsWith('/turns') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { text: string }
        return envelope(flow.submit(body.text))
      }
      if (url.includes('/turns/')) {
        if (state === 'poll-error') return Response.json({ code: 'UNAVAILABLE' }, { status: 503 })
        return envelope(flow.poll())
      }
      return envelope(flow.snapshot())
    }
    const previous = document.documentElement.dir
    document.documentElement.dir = params.get('dir') === 'rtl' ? 'rtl' : 'ltr'
    setReady(true)
    return () => { window.fetch = original; document.documentElement.dir = previous; setReady(false) }
  // Every setup parameter is represented in signature.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, kind])
  return <div className="min-h-screen bg-background text-foreground">
    <p role="note" className="bg-muted p-3 text-center">B11 development qualification · synthetic fixtures · no live learner, database or AI</p>
    <div aria-label="Co identities" className="flex justify-center gap-3">{(['idle', 'thinking', 'explaining', 'celebrating'] as const).map(state => <CoCharacter key={state} state={state} band={band} size={56} />)}</div>
    {ready && <LearnIdentityProvider key={`${kind}:${signature}`} scope={`harness:b11:${signature}`} band={band}>{kind === 'teach' ? <TeachSessionScreen sessionId="session-fixture" pollBaseMs={30} /> : <ProgressScreen />}</LearnIdentityProvider>}
  </div>
}
