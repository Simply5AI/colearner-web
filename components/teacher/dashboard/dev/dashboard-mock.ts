import type { TeachingRequestFn } from '@/lib/api/teaching/core'
import {
  assignmentFixture, contextFixture, dashboardFixture, denied, never, notFound, planDetailFixture, serverError, unavailable,
} from './fixtures'


export interface DashboardMockOptions {
  state: string
  /** `fail` makes the assign POST fail once to prove nothing is announced and a retry is safe. */
  assign?: 'ok' | 'fail'
}

/** Stand-in for the platform while P2/P3 are built. Mirrors contract sections 6.1, 6.2 and 6.10 only. */
export function createDashboardMock({ state, assign = 'ok' }: DashboardMockOptions): TeachingRequestFn {
  let dashboardCalls = 0
  let assignFailed = false
  const calls: string[] = []
  const request = (async (suffix: string, method = 'GET', body?: unknown) => {
    calls.push(`${method} ${suffix}`)
    if (suffix === '/dashboard') {
      dashboardCalls += 1
      if (state === 'loading') return never()
      if (state === 'denied') throw denied()
      if (state === 'unavailable') throw unavailable()
      if (state === 'retry' && dashboardCalls === 1) throw serverError()
      if (state === 'malformed') return { state: 'ACTIVE' }
      return dashboardFixture(state === 'retry' ? 'default' : state)
    }
    if (suffix === '/context') return contextFixture({ noClass: state === 'no-class' })
    const assignments = /^\/plans\/([^/]+)\/assignments$/.exec(suffix)
    if (assignments?.[1]) {
      if (method === 'GET') return { items: [] }
      if (method === 'POST') {
        if (assign === 'fail' && !assignFailed) {
          assignFailed = true
          throw serverError()
        }
        const input = body as { classId: string }
        return assignmentFixture(assignments[1], input.classId)
      }
    }
    const plan = /^\/plans\/([^/]+)$/.exec(suffix)
    if (plan?.[1]) return planDetailFixture(plan[1], 'PUBLISHED')
    throw notFound()
  }) as TeachingRequestFn
  ;(request as unknown as { calls: string[] }).calls = calls
  return request
}
