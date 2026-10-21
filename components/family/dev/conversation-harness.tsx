'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { SchoolPolicyScreen } from '@/components/school/policy-screen'
import { ConversationAccess } from '../conversation-access'
import { harnessProfileId, harnessSchoolId } from './conversation-fixtures'
import { conversationScenarios, createConversationMock, type ConversationScenario } from './conversation-mock'

const num = (value: string | null) => value !== null && /^\d+(\.\d+)?$/.test(value) ? Number(value) : undefined
const urlOf = (input: RequestInfo | URL) => typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

/**
 * Development-only qualification of the B10 parent conversations view and school policy controls; every record is
 * synthetic. `mock=page` (default) answers the family/school endpoints and the session inside the page;
 * `mock=network` leaves requests alone so the Playwright review can answer them with page.route.
 * Parameters: screen (conversations|policy), scenario (under14|teen|empty|teen-empty|denied|error|page-error|teen-leak|grant-denied),
 * teen=1|0 (defaults from the scenario), policy (default|set), grantMinutes, dir=rtl, mock.
 */
export function FamilyConversationsHarness() {
  const params = useSearchParams()
  const scenario: ConversationScenario = conversationScenarios.includes(params.get('scenario') as ConversationScenario) ? params.get('scenario') as ConversationScenario : 'under14'
  const screen = params.get('screen') === 'policy' ? 'policy' : 'conversations'
  const teen = params.has('teen') ? params.get('teen') === '1' : scenario.startsWith('teen') || scenario === 'grant-denied'
  const dir = params.get('dir') === 'rtl' ? 'rtl' : 'ltr'
  const mock = params.get('mock') ?? 'page'
  const [ready, setReady] = useState(false)
  const signature = params.toString()
  useEffect(() => {
    const previousDir = document.documentElement.dir
    document.documentElement.dir = dir
    const undo: (() => void)[] = [() => { document.documentElement.dir = previousDir }]
    if (mock === 'page') {
      const server = createConversationMock({ scenario, grantMinutes: num(params.get('grantMinutes')), policy: params.get('policy') === 'set' ? 'set' : 'default' })
      const original = window.fetch
      window.fetch = (input, init) => {
        const target = urlOf(input)
        const known = target.includes('/api/auth/session') || /\/(family\/profiles|schools)\//.test(target)
        if (!known) return original(input, init)
        const reply = server.handle(init?.method ?? 'GET', new URL(target, window.location.origin).pathname + new URL(target, window.location.origin).search, init?.body ? JSON.parse(String(init.body)) : undefined)
        return Promise.resolve(new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } }))
      }
      undo.push(() => { window.fetch = original })
    }
    setReady(true)
    return () => { setReady(false); undo.reverse().forEach(run => run()) }
  // The signature covers every parameter the setup reads.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])
  return <div data-age-band="tweens" className="min-h-screen bg-background text-foreground">
    <p role="note" className="border-b border-border bg-muted p-3 text-center text-sm font-bold">B10 development UI qualification · synthetic fixtures only · no real child, AI or API</p>
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      {ready && (screen === 'policy'
        ? <SchoolPolicyScreen key={signature} schoolId={harnessSchoolId} />
        : <ConversationAccess key={signature} profileId={harnessProfileId} teen={teen} />)}
    </main>
  </div>
}
