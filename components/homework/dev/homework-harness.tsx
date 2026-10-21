'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { LearnIdentityProvider } from '@/components/learn/learn-common'
import { installFakeSpeech, removeSpeech } from '@/components/lesson/dev/fake-speech'
import type { LearnBand } from '@/lib/api/learn'
import type { TurnKind } from '@/lib/api/co'
import { HomeworkEntryScreen } from '../homework-entry'
import { HomeworkSessionScreen } from '../homework-session-screen'
import { homeworkBands } from './homework-fixtures'
import { createHomeworkMock, homeworkSeeds, type HomeworkSeed } from './homework-mock'

const isBand = (value: string | null): value is LearnBand => homeworkBands.includes(value as LearnBand)
const num = (value: string | null) => value !== null && /^\d+$/.test(value) ? Number(value) : undefined
const seeds = homeworkSeeds
const kinds: TurnKind[] = ['CHAT', 'HW_RESTATE', 'HW_STEP', 'HW_HINT', 'HW_CHECK']

type Route = { screen: 'entry' } | { screen: 'session'; sessionId: string } | { screen: 'home' }

/**
 * Development-only qualification of the real B10 homework screens. All data is synthetic and the coach wording is canned.
 * `mock=page` (default) answers the co and homework endpoints inside the page; `mock=network` leaves them to Playwright's page.route.
 * Parameters: band, screen (entry|session), seed (a phase to start in: restate, steps, steps-hint2, final, checked-not-yet, safety,
 * failed, thinking ...), hintsMax (0-3), polls (turns pending for n reads), hold=1 (a pending turn stays pending), fail=n,
 * failFinal=1, failKind (HW_HINT ...), drop=n (lost replies), dropCreate=n, mode (FULL|SUMMARY),
 * history=n, sessionStatus, historyStatus, loading=1, speech
 * (fake|none|real), dir=rtl, pollMs.
 */
export function HomeworkBrowserHarness() {
  const params = useSearchParams()
  const band: LearnBand = isBand(params.get('band')) ? params.get('band') as LearnBand : 'tweens'
  const seedParam = params.get('seed') ?? 'new'
  const seed = (seeds as readonly string[]).includes(seedParam) ? seedParam as HomeworkSeed : 'new'
  const screen = params.get('screen') === 'entry' || (seed === 'new' && params.get('screen') !== 'session') ? 'entry' : 'session'
  const dir = params.get('dir') === 'rtl' ? 'rtl' : 'ltr'
  const speech = params.get('speech') ?? 'fake'
  const mock = params.get('mock') ?? 'page'
  const failKind = params.get('failKind') as TurnKind | null
  const [ready, setReady] = useState(false)
  const [route, setRoute] = useState<Route>(screen === 'entry' ? { screen: 'entry' } : { screen: 'session', sessionId: 'hw-1' })
  const signature = params.toString()
  useEffect(() => {
    const previousDir = document.documentElement.dir
    document.documentElement.dir = dir
    const undo: (() => void)[] = [() => { document.documentElement.dir = previousDir }]
    if (mock === 'page') {
      const server = createHomeworkMock({
        band, seed, hintsMax: num(params.get('hintsMax')), pendingPolls: num(params.get('polls')), hold: params.get('hold') === '1',
        failTurns: num(params.get('fail')), failFinal: params.get('failFinal') === '1', failKind: failKind && kinds.includes(failKind) ? failKind : undefined,
        dropReplies: num(params.get('drop')), dropCreateReplies: num(params.get('dropCreate')), delayMs: num(params.get('delay')),
        sessionStatus: num(params.get('sessionStatus')), historyStatus: num(params.get('historyStatus')),
        createError: params.get('createError') ?? undefined, mode: params.get('mode') === 'FULL' || params.get('mode') === 'SUMMARY' ? params.get('mode') as 'FULL' | 'SUMMARY' : undefined,
        historyCount: num(params.get('history')),
        loading: params.get('loading') === '1',
      })
      const original = window.fetch
      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        return url.includes('/api/learn/co') || url.includes('/api/learn/homework') ? server.fetch(input, init) : original(input, init)
      }
      undo.push(() => { window.fetch = original })
      Object.assign(window, { __homeworkMock: server })
    }
    if (speech === 'fake') { const fake = installFakeSpeech({ autoplayMs: 260 }); Object.assign(window, { __homeworkSpeech: fake }); undo.push(fake.restore) }
    else if (speech === 'none') undo.push(removeSpeech())
    setRoute(screen === 'entry' ? { screen: 'entry' } : { screen: 'session', sessionId: 'hw-1' })
    setReady(true)
    return () => { setReady(false); undo.reverse().forEach(run => run()) }
  // The signature covers every parameter the setup reads.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])
  const pollMs = num(params.get('pollMs'))
  const navigate = (href: string) => {
    const match = /^\/learn\/homework\/([A-Za-z0-9_-]+)$/.exec(href)
    if (match) setRoute({ screen: 'session', sessionId: match[1]! })
    else if (href === '/learn/homework') setRoute({ screen: 'entry' })
    else setRoute({ screen: 'home' })
  }
  return <div className="min-h-screen bg-background text-foreground">
    <p role="note" className="border-b border-border bg-muted p-3 text-center text-sm font-bold">B10 development UI qualification · synthetic fixtures only · no real learner, AI or API</p>
    {ready && <LearnIdentityProvider key={signature} scope="harness:b10" band={band}>
      {route.screen === 'entry' && <HomeworkEntryScreen navigate={navigate} />}
      {route.screen === 'session' && <HomeworkSessionScreen key={route.sessionId} sessionId={route.sessionId} navigate={navigate} pollTiming={pollMs ? { delay: () => pollMs } : undefined} />}
      {route.screen === 'home' && <p role="status" data-testid="harness-home" className="p-6 text-center font-bold">The learn home opens here in the real app.</p>}
    </LearnIdentityProvider>}
  </div>
}
