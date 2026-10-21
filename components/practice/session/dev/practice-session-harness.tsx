'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { LearnIdentityProvider } from '@/components/learn/learn-common'
import { installFakeSpeech, removeSpeech } from '@/components/lesson/dev/fake-speech'
import type { LearnBand } from '@/lib/api/learn'
import { PracticeSessionScreen } from '../practice-session-screen'
import { questionKinds, type PracticeMode, type QuestionKind } from '../practice-types'
import { fixtureSessionId, practiceBands } from './practice-fixtures'
import { createPracticeMock, type PracticeMockState } from './practice-mock'

const states: PracticeMockState[] = ['ready', 'loading', 'unavailable', 'denied', 'expired', 'completed', 'abandoned']
const modes: PracticeMode[] = ['PRACTICE', 'REVIEW', 'EXAM']
const isBand = (value: string | null): value is LearnBand => practiceBands.includes(value as LearnBand)
const num = (value: string | null) => value !== null && /^\d+$/.test(value) ? Number(value) : undefined

/**
 * Development-only qualification of the real B09 session player. All data is synthetic.
 * `mock=page` (default) answers the practice endpoints inside the page; `mock=network` leaves them to Playwright's page.route.
 * Parameters: band, mode (PRACTICE|REVIEW|EXAM), kind (one kind) or kinds (comma list), state, startIndex, attempts, polls,
 * unavailable=1 (written answers end FEEDBACK_UNAVAILABLE), failures (answers failing before processing), drops (replies lost),
 * remaining (seconds), speech=fake|none|real, dir=rtl, pollMs.
 */
export function PracticeSessionHarness() {
  const params = useSearchParams()
  const band: LearnBand = isBand(params.get('band')) ? params.get('band') as LearnBand : 'teens'
  const stateParam = params.get('state') ?? 'ready'
  const state = states.includes(stateParam as PracticeMockState) ? stateParam as PracticeMockState : 'ready'
  const modeParam = (params.get('mode') ?? 'PRACTICE').toUpperCase()
  const mode = modes.includes(modeParam as PracticeMode) ? modeParam as PracticeMode : 'PRACTICE'
  const dir = params.get('dir') === 'rtl' ? 'rtl' : 'ltr'
  const speech = params.get('speech') ?? 'fake'
  const mock = params.get('mock') ?? 'page'
  const kindsParam = (params.get('kinds') ?? params.get('kind') ?? '').split(',').map(entry => entry.trim().toUpperCase()).filter((entry): entry is QuestionKind => (questionKinds as readonly string[]).includes(entry))
  const [ready, setReady] = useState(false)
  const [outcome, setOutcome] = useState<'finished' | 'left' | null>(null)
  const signature = params.toString()
  useEffect(() => {
    const previousDir = document.documentElement.dir
    document.documentElement.dir = dir
    const undo: (() => void)[] = [() => { document.documentElement.dir = previousDir }]
    if (mock === 'page') {
      const server = createPracticeMock({
        band, mode, state, kinds: kindsParam.length > 0 ? kindsParam : undefined, startIndex: num(params.get('startIndex')), attemptsAllowed: num(params.get('attempts')),
        gradingPolls: num(params.get('polls')), feedbackUnavailable: params.get('unavailable') === '1', answerFailures: num(params.get('failures')), dropReplies: num(params.get('drops')),
        remainingSec: num(params.get('remaining')), delayMs: num(params.get('delay')),
      })
      const original = window.fetch
      window.fetch = (input, init) => (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).includes('/api/learn/practice') ? server.fetch(input, init) : original(input, init)
      undo.push(() => { window.fetch = original })
      Object.assign(window, { __practiceMock: server })
    }
    if (speech === 'fake') { const fake = installFakeSpeech({ autoplayMs: 260 }); Object.assign(window, { __practiceSpeech: fake }); undo.push(fake.restore) }
    else if (speech === 'none') undo.push(removeSpeech())
    setOutcome(null)
    setReady(true)
    return () => { setReady(false); undo.reverse().forEach(run => run()) }
  // The signature covers every parameter the setup reads.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])
  return <div className="min-h-screen bg-background text-foreground">
    <p role="note" className="border-b border-border bg-muted p-3 text-center text-sm font-bold">B09 development UI qualification · synthetic fixtures only · no real learner, AI or API</p>
    {outcome && <p role="status" data-testid="harness-outcome" className="p-6 text-center font-bold">{outcome === 'finished' ? 'Session finished. The summary page opens here in the real app.' : 'You left the session. The hub opens here in the real app.'}</p>}
    {ready && !outcome && <LearnIdentityProvider key={signature} scope="harness:b09" band={band}>
      <PracticeSessionScreen sessionId={fixtureSessionId} onFinished={() => setOutcome('finished')} onExit={() => setOutcome('left')}
        pollTiming={{ baseMs: num(params.get('pollMs')) ?? 700, capMs: 2000 }} />
    </LearnIdentityProvider>}
  </div>
}
