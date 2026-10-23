'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { AssignClassPanel } from '@/components/teacher/plans/assign-class-panel'
import { NewPlanOptions } from '@/components/teacher/plans/new-plan-options'
import { PlanTopicScreen } from '@/components/teacher/plans/plan-topic-screen'
import { PlanWorkspace } from '@/components/teacher/plans/plan-workspace'
import { TeachingPlansList } from '@/components/teacher/plans/teaching-plans-list'
import { TeachingProvider } from '@/components/teacher/teaching-context'
import { createMockTeaching } from './mock-server'

/** Development only. Every response is a synthetic fixture shaped like the B12 contract; no platform, database or model is called. */
export function PlansHarness() {
  const params = useSearchParams()
  const client = useQueryClient()
  const view = params.get('view') ?? 'list'
  const state = params.get('state') ?? 'default'
  const planId = params.get('plan') ?? 'plan-fractions'
  // Selecting a topic only changes `topic`; it must not rebuild the fixture server or remount the screen.
  const signature = [...params.entries()].filter(([key]) => key !== 'topic').map(([key, value]) => `${key}=${value}`).join('&')
  const [ready, setReady] = useState(false)
  const [created, setCreated] = useState<string | null>(null)

  useEffect(() => {
    const original = window.fetch
    const server = createMockTeaching(state)
    client.clear()
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.includes('/api/auth/session')) return Response.json({ user: { id: 'teacher-1', name: 'Ms. Rao' }, accessToken: 'fixture-token', expires: '2099-01-01T00:00:00Z' })
      const marker = '/schools/school-1/teaching'
      const at = url.indexOf(marker)
      if (at === -1) return original(input, init)
      const rest = url.slice(at + marker.length)
      const [path = '', search = ''] = rest.split('?')
      const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>))
      const method = init?.method ?? 'GET'
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined
      await new Promise(resolve => setTimeout(resolve, state === 'slow' ? 700 : 20))
      const result = server.handle(method, path, new URLSearchParams(search), body, headers)
      if (result.status === 204) return new Response(null, { status: 204 })
      return Response.json(result.body, { status: result.status })
    }
    const previous = document.documentElement.dir
    document.documentElement.dir = params.get('dir') === 'rtl' ? 'rtl' : 'ltr'
    setReady(true)
    return () => { window.fetch = original; document.documentElement.dir = previous; setReady(false) }
  // Every setup parameter is represented in signature.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const topic = params.get('topic')
  return <div className="min-h-screen bg-background p-4 text-foreground sm:p-6">
    <p role="note" className="mb-4 rounded-lg bg-muted p-3 text-center text-sm">B12 development qualification · synthetic fixtures · no live platform, database or AI</p>
    {ready && <TeachingProvider key={signature} schoolId="school-1" schoolName="Green Valley School">
      <main className="mx-auto max-w-7xl">
        {view === 'list' && <TeachingPlansList />}
        {view === 'new' && <div className="mx-auto max-w-3xl space-y-4">
          <NewPlanOptions onCreated={plan => setCreated(plan.id)} defaultClassId={params.get('class') ?? undefined} />
          {created && <p role="status" data-testid="created-plan">Created plan {created}</p>}
        </div>}
        {view === 'editor' && <PlanWorkspace planId={planId} initialTopicId={topic} assignOpen={params.get('assign') === '1'} topicUrl={id => `/dev/teacher/plans?${new URLSearchParams({ ...Object.fromEntries(params.entries()), topic: id })}`} />}
        {view === 'topic' && <PlanTopicScreen planId={planId} topicId={topic ?? 'topic-add'} />}
        {view === 'assign' && <div className="mx-auto max-w-2xl"><AssignClassPanel planId={planId} defaultClassId={params.get('class') ?? undefined} onAssigned={() => undefined} /></div>}
      </main>
    </TeachingProvider>}
  </div>
}
