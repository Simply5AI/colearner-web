'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { CsvImportFlow } from '@/components/teacher/questions/csv-import-flow'
import { TeachingProvider } from '@/components/teacher/teaching-context'
import { WorksheetBuilder } from '@/components/teacher/worksheets/worksheet-builder'
import { WorksheetDocument } from '@/components/teacher/worksheets/worksheet-document'
import { WorksheetsList } from '@/components/teacher/worksheets/worksheets-list'
import { SAMPLE_CSV, createMockWorksheets } from './mock-server'

/**
 * Development only. Every response is a labelled synthetic fixture shaped like B13 contract sections 6.1, 6.5 and 6.6; no
 * platform, database or model is called. `?view=import|list|builder|print|answer-key&state=default|empty|denied|unavailable|slow|expired|conflict&ws=ws-final`
 */
export function WorksheetsHarness() {
  const params = useSearchParams()
  const client = useQueryClient()
  const view = params.get('view') ?? 'list'
  const state = params.get('state') ?? 'default'
  const ws = params.get('ws') ?? 'ws-final'
  const importId = params.get('importId')
  const signature = [...params.entries()].map(([key, value]) => `${key}=${value}`).join('&')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const original = window.fetch
    const server = createMockWorksheets(state)
    client.clear()
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.includes('/api/auth/session')) return Response.json({ user: { id: 'teacher-1', name: 'Ms. Rao' }, accessToken: 'fixture-token', expires: '2099-01-01T00:00:00Z' })
      const marker = '/schools/school-1/teaching'
      const at = url.indexOf(marker)
      if (at === -1) return original(input, init)
      const [path = '', search = ''] = url.slice(at + marker.length).split('?')
      const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>))
      const method = init?.method ?? 'GET'
      let body: Record<string, unknown> | undefined
      if (init?.body instanceof FormData) {
        const file = init.body.get('file')
        body = file instanceof File ? { fileName: file.name, text: await file.text() } : {}
      } else if (typeof init?.body === 'string') body = JSON.parse(init.body) as Record<string, unknown>
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

  function useSample() {
    const input = document.getElementById('csv-file') as HTMLInputElement | null
    if (!input) return
    const transfer = new DataTransfer()
    transfer.items.add(new File([SAMPLE_CSV], 'sample-questions.csv', { type: 'text/csv' }))
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }

  return <div className="min-h-screen bg-background p-4 text-foreground sm:p-6">
    <p role="note" className="ws-no-print mb-4 rounded-lg bg-muted p-3 text-center text-sm">B13 development qualification · synthetic fixtures (labelled) · no live platform, database or AI</p>
    {ready && <TeachingProvider key={signature} schoolId="school-1" schoolName="Green Valley School">
      <main className="mx-auto max-w-7xl space-y-4">
        {view === 'import' && <>
          {!importId && <div className="ws-no-print flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border p-3 text-sm">
            <span>Fixture helper:</span>
            <button type="button" onClick={useSample} data-testid="harness-use-sample" className="rounded-lg border border-border px-3 py-1.5 font-medium">Choose the sample CSV</button>
            <a download="sample-questions.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE_CSV)}`} className="underline">Download it</a>
          </div>}
          <CsvImportFlow initialPlanId={params.get('planId') ?? 'plan-fractions'} initialImportId={importId} />
        </>}
        {view === 'list' && <WorksheetsList planId="plan-fractions" />}
        {view === 'builder' && <WorksheetBuilder planId="plan-fractions" worksheetId={ws} />}
        {view === 'print' && <WorksheetDocument planId="plan-fractions" worksheetId={ws} mode="student" />}
        {view === 'answer-key' && <WorksheetDocument planId="plan-fractions" worksheetId={ws} mode="answer-key" />}
      </main>
    </TeachingProvider>}
  </div>
}
