'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { CoReviewQueue } from '@/components/teacher/questions/co-review-queue'
import { QuestionBankList } from '@/components/teacher/questions/question-bank-list'
import { QuestionEditor } from '@/components/teacher/questions/question-editor'
import { TeachingProvider } from '@/components/teacher/teaching-context'
import { createMockQuestions } from './mock-server'

/**
 * Development only. Every response is a synthetic fixture shaped like the B13 contract; no platform, database or model is called.
 * Views: list, editor (question=q-1), new (plan=plan-fractions&topic=topic-add), review (batch=<id>; create one from the list's Co dialog).
 * States: default, empty, denied, error, co-unavailable, conflict, batch-running, batch-failed, slow.
 */
export function QuestionsHarness() {
  const params = useSearchParams()
  const client = useQueryClient()
  const view = params.get('view') ?? 'list'
  const state = params.get('state') ?? 'default'
  const signature = [...params.entries()].map(([key, value]) => `${key}=${value}`).join('&')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const original = window.fetch
    const server = createMockQuestions(state)
    client.clear()
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.includes('/api/auth/session')) return Response.json({ user: { id: 'teacher-1', name: 'Ms. Rao' }, accessToken: 'fixture-token', expires: '2099-01-01T00:00:00Z' })
      const marker = '/schools/school-1/teaching'
      const at = url.indexOf(marker)
      if (at === -1) return original(input, init)
      const [path = '', search = ''] = url.slice(at + marker.length).split('?')
      const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>))
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined
      await new Promise(resolve => setTimeout(resolve, state === 'slow' ? 700 : 20))
      const result = server.handle(init?.method ?? 'GET', path, new URLSearchParams(search), body, headers)
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

  return <div className="min-h-screen bg-background p-4 text-foreground sm:p-6">
    <p role="note" className="mb-4 rounded-lg bg-muted p-3 text-center text-sm">B13 development qualification · synthetic fixtures, including the &ldquo;Co&rdquo; drafts · no live platform, database or AI</p>
    {ready && <TeachingProvider key={signature} schoolId="school-1" schoolName="Green Valley School">
      <main className="mx-auto max-w-7xl">
        {view === 'list' && <QuestionBankList initialPlanId={params.get('plan') ?? ''} />}
        {view === 'editor' && <QuestionEditor questionId={params.get('question') ?? 'q-1'} />}
        {view === 'new' && <QuestionEditor planId={params.get('plan') ?? undefined} topicId={params.get('topic') ?? undefined} />}
        {view === 'review' && <CoReviewQueue batchId={params.get('batch') ?? 'batch-101'} />}
      </main>
    </TeachingProvider>}
  </div>
}
