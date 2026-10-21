'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { LearnIdentityProvider } from '@/components/learn/learn-common'
import type { LearnBand } from '@/lib/api/learn'
import { LessonScreen, LessonStartScreen } from '../lesson-screen'
import { installFakeSpeech, removeSpeech } from './fake-speech'
import { fixtureLessonId, fixtureMaterialId, lessonBands } from './lesson-fixtures'
import { createLessonMock, type MockState } from './lesson-mock'

const states: MockState[] = ['ready', 'generating', 'failed', 'failed-final', 'cancelled', 'access-changed', 'done', 'denied', 'unavailable', 'loading']
const isBand = (value: string | null): value is LearnBand => lessonBands.includes(value as LearnBand)
const num = (value: string | null) => value !== null && /^\d+$/.test(value) ? Number(value) : undefined

/**
 * Development-only qualification of the real B08 lesson screens. All data is synthetic.
 * `mock=page` (default) answers the lesson endpoints inside the page, so nothing leaves the browser;
 * `mock=network` leaves the requests alone so the Playwright review can answer them with page.route.
 * `speech=fake` (default) installs a fake local voice with word-boundary events, `none` removes speech,
 * `real` leaves the browser's own engine. Parameters: band, state, step, completed, notes, view, startError, dir.
 */
export function LessonBrowserHarness() {
  const params = useSearchParams()
  const band: LearnBand = isBand(params.get('band')) ? params.get('band') as LearnBand : 'teens'
  const stateParam = params.get('state') ?? 'ready'
  const state = states.includes(stateParam as MockState) ? stateParam as MockState : 'ready'
  const dir = params.get('dir') === 'rtl' ? 'rtl' : 'ltr'
  const speech = params.get('speech') ?? 'fake'
  const mock = params.get('mock') ?? 'page'
  const view = params.get('view') === 'start' ? 'start' : 'lesson'
  const [ready, setReady] = useState(false)
  const [started, setStarted] = useState(false)
  const [lessonId, setLessonId] = useState(fixtureLessonId)
  const signature = params.toString()
  useEffect(() => {
    const previousDir = document.documentElement.dir
    document.documentElement.dir = dir
    const undo: (() => void)[] = [() => { document.documentElement.dir = previousDir }]
    if (mock === 'page') {
      const server = createLessonMock({
        band, state, step: num(params.get('step')), notes: params.get('notes') === '1', startError: params.get('startError') ?? undefined,
        completed: params.get('completed')?.split(',').map(Number).filter(Number.isInteger), delayMs: num(params.get('delay')),
        progressFailures: num(params.get('progressFailures')), conflictOnce: params.get('conflictOnce') === '1', generatingPolls: num(params.get('polls')),
      })
      const original = window.fetch
      window.fetch = (input, init) => (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).includes('/api/learn/lessons') ? server.fetch(input, init) : original(input, init)
      undo.push(() => { window.fetch = original })
    }
    // The fake engine is also reachable as window.__lessonSpeech so the browser review can prove nothing autoplays.
    if (speech === 'fake') { const fake = installFakeSpeech({ autoplayMs: 260 }); Object.assign(window, { __lessonSpeech: fake }); undo.push(fake.restore) }
    else if (speech === 'none') undo.push(removeSpeech())
    setReady(true)
    return () => { setReady(false); undo.reverse().forEach(run => run()) }
  // The signature covers every parameter the setup reads.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])
  return <div className="min-h-screen bg-background text-foreground">
    <p role="note" className="border-b border-border bg-muted p-3 text-center text-sm font-bold">B08 development UI qualification · synthetic fixtures only · no real learner, AI or API</p>
    {ready && <LearnIdentityProvider key={signature} scope="harness:b08" band={band}>
      {view === 'start' && !started
        ? <LessonStartScreen materialId={fixtureMaterialId} onStarted={() => setStarted(true)} />
        : <LessonScreen lessonId={lessonId} onLessonChanged={setLessonId} pollBaseMs={num(params.get('pollMs')) ?? 700} />}
    </LearnIdentityProvider>}
  </div>
}
