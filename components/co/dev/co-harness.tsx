'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AgeBandScope } from '@/components/design-system'
import { LearnIdentityProvider } from '@/components/learn/learn-common'
import type { LearnBand } from '@/lib/api/learn'
import { installFakeSpeech, removeSpeech } from '@/components/lesson/dev/fake-speech'
import { AskCoEntry, AskCoLauncher } from '../co-launcher'
import { coBands, fixtureLessonId, fixtureMaterialId, topics } from './co-fixtures'
import { createCoMock, type MockState } from './co-mock'

const states: MockState[] = ['fresh', 'history', 'pending', 'unavailable', 'disabled', 'not-ready', 'no-context', 'denied', 'ended', 'unreachable', 'loading', 'history-failed']
const isBand = (value: string | null): value is LearnBand => coBands.includes(value as LearnBand)
const num = (value: string | null) => value !== null && /^\d+$/.test(value) ? Number(value) : undefined

/**
 * Development-only qualification of the real B10 Ask Co panel. All data is synthetic.
 * `mock=page` (default) answers the Ask Co endpoints inside the page; `mock=network` leaves them to Playwright's page.route.
 * `opener=lesson` shows the lesson-style control (always present; the panel says if Ask Co is unavailable), `opener=material` shows
 * the library-item entry (asks the context first, so an unavailable state shows the server's reason instead of a control).
 * Parameters: band, state, opener, open=1, dir=rtl, speech=fake|none|real, parent=full|summary, polls, pollMs, slowMs, delay,
 * lost, sendFailures, pollFailures, startError, turnError, storage=none.
 */
export function CoBrowserHarness() {
  const params = useSearchParams()
  const band: LearnBand = isBand(params.get('band')) ? params.get('band') as LearnBand : 'teens'
  const stateParam = params.get('state') ?? 'fresh'
  const state = states.includes(stateParam as MockState) ? stateParam as MockState : 'fresh'
  const dir = params.get('dir') === 'rtl' ? 'rtl' : 'ltr'
  const speech = params.get('speech') ?? 'fake'
  const mock = params.get('mock') ?? 'page'
  const opener = params.get('opener') === 'material' ? 'material' : 'lesson'
  const [ready, setReady] = useState(false)
  const signature = params.toString()
  useEffect(() => {
    const previousDir = document.documentElement.dir
    const undo: (() => void)[] = [() => { document.documentElement.dir = previousDir }]
    document.documentElement.dir = dir
    if (mock === 'page') {
      const server = createCoMock({
        band, state, polls: num(params.get('polls')), delayMs: num(params.get('delay')), lostResponses: num(params.get('lost')), sendFailures: num(params.get('sendFailures')),
        pollFailures: num(params.get('pollFailures')), startError: params.get('startError') ?? undefined, turnError: params.get('turnError') ?? undefined,
        mode: params.get('parent') === 'summary' ? 'SUMMARY' : params.get('parent') === 'full' ? 'FULL' : undefined,
      })
      const original = window.fetch
      window.fetch = (input, init) => (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).includes('/api/learn/co/') ? server.fetch(input, init) : original(input, init)
      Object.assign(window, { __coMock: server })
      undo.push(() => { window.fetch = original })
    }
    // The fake engine is also reachable as window.__coSpeech so the browser review can prove nothing autoplays.
    if (speech === 'fake') { const fake = installFakeSpeech({ autoplayMs: 260 }); Object.assign(window, { __coSpeech: fake }); undo.push(fake.restore) }
    else if (speech === 'none') undo.push(removeSpeech())
    // A message left unsent by an earlier visit must not leak into the next scenario.
    if (params.get('storage') !== 'keep') { try { Object.keys(window.sessionStorage).filter(key => key.startsWith('colearner:co:')).forEach(key => window.sessionStorage.removeItem(key)) } catch { /* storage may be blocked */ } }
    setReady(true)
    return () => { setReady(false); undo.reverse().forEach(run => run()) }
  // The signature covers every parameter the setup reads.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const tuning = { pollBaseMs: num(params.get('pollMs')) ?? 800, slowAfterMs: num(params.get('slowMs')) ?? 20000, defaultOpen: params.get('open') === '1', storage: params.get('storage') === 'none' ? null : undefined }
  const topic = topics[band]
  return <div className="min-h-screen bg-background text-foreground">
    <p role="note" className="border-b border-border bg-muted p-3 text-center text-sm font-bold">B10 development UI qualification · synthetic fixtures only · no real learner, AI or API</p>
    {ready && <LearnIdentityProvider key={signature} scope="harness:b10" band={band}>
      <AgeBandScope band={band} className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-7">
        <h1 className="text-3xl font-extrabold">{topic.title}</h1>
        <p className="max-w-prose text-muted-foreground">This is a stand-in page for the Ask Co panel. The real panel opens from the lesson player and from a library item.</p>
        {opener === 'material'
          ? <AskCoEntry materialId={fixtureMaterialId} band={band} {...tuning} />
          : <AskCoLauncher band={band} context={{ kind: 'LESSON', lessonId: fixtureLessonId, stepIndex: 1 }} materialHref={`/learn/library/${fixtureMaterialId}`} {...tuning} />}
        <label className="ds-field max-w-sm"><span>A field behind the panel</span><input className="ds-input" aria-label="A field behind the panel" /></label>
      </AgeBandScope>
    </LearnIdentityProvider>}
  </div>
}
