'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { LearnIdentityProvider } from '@/components/learn/learn-common'
import type { LearnBand } from '@/lib/api/learn'
import { AnswerSheetScreen } from '../answer-sheet-screen'
import { HubScreen } from '../hub-screen'
import { StartScreen } from '../start-screen'
import { SummaryScreen } from '../summary-screen'
import { fixtureSessionId, practiceBands, type HubState, type SummaryState } from './practice-fixtures'
import { createPracticeMock, type StartMode } from './practice-mock'

const hubStates: HubState[] = ['default', 'caught-up', 'no-content', 'weak-spots', 'sets-pending']
const summaryStates: SummaryState[] = ['great', 'tough', 'feedback-unavailable', 'no-reward', 'later-release']
const startModes: StartMode[] = ['ready', 'generating', 'failed', 'failed-final', 'cancelled']
const isBand = (value: string | null): value is LearnBand => practiceBands.includes(value as LearnBand)
const num = (value: string | null) => value !== null && /^\d+$/.test(value) ? Number(value) : undefined
const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T => allowed.includes(value as T) ? value as T : fallback

/**
 * Development-only qualification of the real B09 hub, start, summary and answer-sheet screens. All data is synthetic.
 * `mock=page` (default) answers the practice endpoints inside the page, so nothing leaves the browser;
 * `mock=network` leaves the requests alone so the Playwright review can answer them with page.route.
 * Parameters: screen (hub|start|summary|sheet), band, state (hub or summary state), tab (today|past), start (ready|generating|
 * failed|failed-final|cancelled), scope/id/planId (start), setError, sessionError, summaryStatus, hubStatus, loading=1, dir=rtl.
 */
export function PracticeBrowserHarness() {
  const params = useSearchParams()
  const band: LearnBand = isBand(params.get('band')) ? params.get('band') as LearnBand : 'teens'
  const screen = pick(params.get('screen'), ['hub', 'start', 'summary', 'sheet'] as const, 'hub')
  const dir = params.get('dir') === 'rtl' ? 'rtl' : 'ltr'
  const mock = params.get('mock') ?? 'page'
  const [ready, setReady] = useState(false)
  const [started, setStarted] = useState<string | null>(null)
  const signature = params.toString()
  useEffect(() => {
    const previousDir = document.documentElement.dir
    document.documentElement.dir = dir
    const undo: (() => void)[] = [() => { document.documentElement.dir = previousDir }]
    if (mock === 'page') {
      const server = createPracticeMock({
        band, hub: pick(params.get('hubState') ?? (screen === 'hub' ? params.get('state') : null), hubStates, 'default'),
        summary: pick(screen === 'summary' ? params.get('state') : null, summaryStates, 'great'),
        start: pick(params.get('start'), startModes, 'ready'), generatingPolls: num(params.get('polls')),
        setError: params.get('setError') ?? undefined, sessionError: params.get('sessionError') ?? undefined,
        summaryStatus: num(params.get('summaryStatus')), hubStatus: num(params.get('hubStatus')),
        delayMs: num(params.get('delay')), loading: params.get('loading') === '1',
      })
      const original = window.fetch
      window.fetch = (input, init) => (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).includes('/api/learn/practice') ? server.fetch(input, init) : original(input, init)
      undo.push(() => { window.fetch = original })
    }
    setStarted(null)
    setReady(true)
    return () => { setReady(false); undo.reverse().forEach(run => run()) }
  // The signature covers every parameter the setup reads.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])
  return <div className="min-h-screen bg-background text-foreground">
    <p role="note" className="border-b border-border bg-muted p-3 text-center text-sm font-bold">B09 development UI qualification · synthetic fixtures only · no real learner, AI or API</p>
    {ready && <LearnIdentityProvider key={signature} scope="harness:b09" band={band}>
      {screen === 'hub' && <HubScreen initialTab={params.get('tab') === 'past' ? 'past' : 'today'} onTabChange={() => undefined} />}
      {screen === 'start' && (started
        ? <p data-testid="harness-started" className="p-6 font-bold">Moved on to the session player: {started}</p>
        : <StartScreen scope={params.get('scope') ?? 'SET'} id={params.get('id') ?? (params.get('scope') === 'DUE' ? null : 'set-fractions')} planId={params.get('planId')} onStarted={setStarted} pollBaseMs={num(params.get('pollMs')) ?? 700} />)}
      {screen === 'summary' && <SummaryScreen sessionId={params.get('session') ?? fixtureSessionId} />}
      {screen === 'sheet' && <AnswerSheetScreen sessionId={params.get('session') ?? fixtureSessionId} />}
    </LearnIdentityProvider>}
  </div>
}
