'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ApprovalsScreen } from '../approvals-screen'
import { ApprovalDetail } from '../approval-detail'
import { ApprovalsEntry } from '../approvals-entry'
import { approvalScenarios, createApprovalsMock, type ApprovalScenario } from './approvals-mock'

const urlOf = (input: RequestInfo | URL) => typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

/**
 * Development-only qualification of the B12A guardian approvals screens; every record is synthetic. `mock=page` (default)
 * answers /api/family-approvals inside the page and exposes the calls on window.__approvalCalls; `mock=network` leaves requests alone.
 * Parameters: screen (list|detail|entry), scenario, id (detail), dir=rtl, mock.
 */
export function ApprovalsHarness() {
  const params = useSearchParams()
  const scenario: ApprovalScenario = approvalScenarios.includes(params.get('scenario') as ApprovalScenario) ? params.get('scenario') as ApprovalScenario : 'default'
  const screen = params.get('screen') ?? 'list'
  const dir = params.get('dir') === 'rtl' ? 'rtl' : 'ltr'
  const mock = params.get('mock') ?? 'page'
  const [ready, setReady] = useState(false)
  const signature = params.toString()
  useEffect(() => {
    const previousDir = document.documentElement.dir
    document.documentElement.dir = dir
    const undo: (() => void)[] = [() => { document.documentElement.dir = previousDir }]
    if (mock === 'page') {
      const server = createApprovalsMock(scenario)
      const original = window.fetch
      ;(window as unknown as { __approvalCalls: unknown }).__approvalCalls = server.calls
      window.fetch = (input, init) => {
        const target = urlOf(input)
        if (!target.includes('/api/family-approvals')) return original(input, init)
        const headers = new Headers(init?.headers)
        const parsed = new URL(target, window.location.origin)
        const reply = server.handle(init?.method ?? 'GET', parsed.pathname + parsed.search, headers.get('Idempotency-Key'), init?.body ? JSON.parse(String(init.body)) : undefined)
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
    <p role="note" className="border-b border-border bg-muted p-3 text-center text-sm font-bold">B12A development UI qualification · synthetic fixtures only · no real child or API</p>
    {ready && (screen === 'detail' ? <ApprovalDetail key={signature} requestId={params.get('id') ?? '00000000-0000-4000-8000-000000000001'} />
      : screen === 'entry' ? <main className="p-6"><ApprovalsEntry key={signature} /></main>
        : <ApprovalsScreen key={signature} />)}
  </div>
}
