import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { TeachingApiError } from '@/lib/api/teaching/core'
import { createMockTeaching, type MockTeaching } from '@/app/dev/teacher/plans/mock-server'

export type Req = (suffix: string, method?: string, body?: unknown, headers?: Record<string, string>) => Promise<unknown>
/** A `useTeaching().request` backed by the fixture server, shaped like the transport (error codes on failures). */
export function requestFor(server: MockTeaching, log: { suffix: string; method: string; body: unknown; headers?: Record<string, string> }[] = []): Req {
  return async (suffix, method = 'GET', body, headers) => {
    log.push({ suffix, method, body, headers })
    const [path = '', search = ''] = suffix.split('?')
    const result = server.handle(method, path, new URLSearchParams(search), body as Record<string, unknown> | undefined, headers ?? {})
    if (result.status >= 400) throw new TeachingApiError(result.status, 'failed', (result.body as { code?: string }).code ?? null, (result.body as { currentRevision?: number }).currentRevision ?? null)
    return result.status === 204 ? undefined : (result.body as { data: unknown }).data
  }
}
export function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}
export { createMockTeaching }
