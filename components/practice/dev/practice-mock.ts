import type { LearnBand } from '@/lib/api/learn'
import type { PracticeSetSummary } from '@/lib/api/practice'
import {
  answerSheetFixture, fixtureSessionId, fixtureSetId, historyPage, hubFixture, setFixture, summaryFixture,
  type HubState, type SummaryState,
} from './practice-fixtures'

/*
 * A stand-in for the B09 hub/start/summary endpoints (platform agents PD1/PD2 were built in parallel to the contract).
 * It is used by the integration tests (through a stubbed fetch), by /dev/practice, and by the Playwright review (through
 * page.route). It follows the contract: get-or-create of a set is idempotent, a session is idempotent per clientSessionId,
 * the answer sheet is for completed sessions only. It is a test double, never production behaviour.
 */
export type StartMode = 'ready' | 'generating' | 'failed' | 'failed-final' | 'cancelled'
export interface PracticeMockOptions {
  band: LearnBand
  hub?: HubState
  /** Status of every HTTP call to the hub: 403/404 denied, 503 unavailable. */
  hubStatus?: number
  /** What POST /practice/sets and GET /practice/sets/:id answer. */
  start?: StartMode
  /** Number of GETs before a generating set becomes ready (the first is QUEUED, the next RUNNING). */
  generatingPolls?: number
  /** Error code returned by POST /practice/sets (for example DAILY_PRACTICE_LIMIT). */
  setError?: string
  /** Error code returned by POST /practice/sessions (for example NO_QUESTIONS_AVAILABLE). */
  sessionError?: string
  summary?: SummaryState
  /** GET summary answers this status (409 = the session is still running). */
  summaryStatus?: number
  /** Regrade answers 429 REGRADE_LIMIT. */
  regradeLimit?: boolean
  /** Milliseconds every answer is delayed by. */
  delayMs?: number
  loading?: boolean
}
export interface MockCall { method: string; path: string; body: unknown }
export interface MockReply { status: number; body: unknown }

const errors: Record<string, { status: number; message: string }> = {
  MATERIAL_NOT_READY: { status: 409, message: 'The material is not ready.' },
  CONSENT_REQUIRED: { status: 403, message: 'Consent is required.' },
  CHILD_PROFILE_REQUIRED: { status: 403, message: 'A child profile is required.' },
  POLICY_BLOCKED: { status: 403, message: 'Practice is paused until tomorrow because today’s learning time is used up.' },
  PRACTICE_UNAVAILABLE: { status: 409, message: 'Practice is not enabled.' },
  DAILY_PRACTICE_LIMIT: { status: 429, message: 'Daily limit reached.' },
  DAILY_PRACTICE_SET_LIMIT: { status: 429, message: 'Daily limit reached.' },
  NO_QUESTIONS_AVAILABLE: { status: 409, message: 'No questions.' },
}
const ok = (data: unknown, status = 200): MockReply => ({ status, body: { statusCode: status, data, timestamp: '2026-10-19T09:00:00.000Z' } })
const fail = (status: number, code: string, message = 'Request refused.'): MockReply => ({ status, body: { statusCode: status, code, message } })

export function createPracticeMock(options: PracticeMockOptions) {
  const { band } = options
  const calls: MockCall[] = []
  let start = options.start ?? 'ready'
  let polls = 0
  let setId = fixtureSetId
  let version = 1
  let cancelled = false
  let createdOnce = false
  const sessions = new Map<string, string>()
  const regraded = new Set<string>()

  const currentSet = (): PracticeSetSummary => {
    if (cancelled || start === 'cancelled') return setFixture('CANCELLED', { id: setId, version })
    if (start === 'failed') return setFixture('FAILED', { id: setId, version, failure: { code: 'generation_failed', retryable: true } })
    if (start === 'failed-final') return setFixture('FAILED', { id: setId, version, failure: { code: 'insufficient_source', retryable: false } })
    if (start === 'generating') {
      const limit = options.generatingPolls ?? 2
      if (polls < 1) return setFixture('QUEUED', { id: setId, version })
      if (polls < limit) return setFixture('RUNNING', { id: setId, version })
    }
    return setFixture('READY', { id: setId, version })
  }

  const handle = (method: string, rawPath: string, body: unknown): MockReply => {
    const [pathOnly, query = ''] = rawPath.split('?')
    const path = pathOnly!.replace(/^\/api\/learn/, '')
    calls.push({ method, path: path + (query ? `?${query}` : ''), body })
    const parts = path.split('/').filter(Boolean)
    if (parts[0] !== 'practice') return fail(404, 'NOT_FOUND')
    if (method === 'GET' && parts[1] === 'hub') {
      if (options.hubStatus && options.hubStatus >= 400) return fail(options.hubStatus, options.hubStatus === 503 ? 'UNAVAILABLE' : 'FORBIDDEN')
      return ok(hubFixture(band, options.hub ?? 'default'))
    }
    if (parts[1] === 'sets') {
      if (method === 'POST' && parts.length === 2) {
        if (options.setError) { const failure = errors[options.setError] ?? { status: 400, message: 'Refused.' }; return { status: failure.status, body: { statusCode: failure.status, code: options.setError, message: failure.message } } }
        // The platform keeps a cancelled set as history and answers a new request with the next version.
        if (createdOnce && (cancelled || start === 'cancelled')) { version += 1; setId = `${fixtureSetId}-v${version}`; polls = 0; cancelled = false; start = 'generating' }
        createdOnce = true
        return ok({ set: currentSet() }, 200)
      }
      if (method === 'GET' && parts.length === 3) {
        polls += 1
        return ok({ set: currentSet() })
      }
      if (method === 'POST' && parts[3] === 'retry') { version += 1; setId = `${fixtureSetId}-v${version}`; polls = 0; cancelled = false; start = 'generating'; return ok({ set: { ...setFixture('QUEUED', { id: setId, version }) } }) }
      if (method === 'POST' && parts[3] === 'cancel') { cancelled = true; return ok({ set: setFixture('CANCELLED', { id: setId, version }) }) }
    }
    if (parts[1] === 'sessions') {
      if (method === 'GET' && parts.length === 2) {
        const cursor = new URLSearchParams(query).get('cursor')
        return ok(historyPage(band, cursor))
      }
      if (method === 'POST' && parts.length === 2) {
        if (options.sessionError) { const failure = errors[options.sessionError] ?? { status: 400, message: 'Refused.' }; return { status: failure.status, body: { statusCode: failure.status, code: options.sessionError, message: failure.message } } }
        const clientSessionId = (body as { clientSessionId?: string } | undefined)?.clientSessionId ?? ''
        if (!sessions.has(clientSessionId)) sessions.set(clientSessionId, sessions.size === 0 ? fixtureSessionId : `${fixtureSessionId}-${sessions.size + 1}`)
        return ok({ session: { id: sessions.get(clientSessionId) } }, 201)
      }
      if (method === 'GET' && parts[3] === 'summary') {
        if (options.summaryStatus && options.summaryStatus >= 400) return fail(options.summaryStatus, options.summaryStatus === 409 ? 'SESSION_NOT_COMPLETED' : 'FORBIDDEN')
        return ok(summaryFixture(band, options.summary ?? 'great'))
      }
      if (method === 'GET' && parts[3] === 'answer-sheet') return ok(answerSheetFixture(band))
    }
    if (parts[1] === 'attempts' && method === 'POST' && parts[3] === 'regrade') {
      if (options.regradeLimit || regraded.has(parts[2]!)) return fail(429, 'REGRADE_LIMIT')
      regraded.add(parts[2]!)
      return ok({ queued: true }, 202)
    }
    return fail(404, 'NOT_FOUND')
  }

  const mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost')
    if (!url.pathname.startsWith('/api/learn/practice')) return new Response(JSON.stringify({ message: 'Not mocked' }), { status: 404 })
    if (options.loading) return new Promise<Response>(() => undefined)
    if (options.delayMs) await new Promise(resolve => setTimeout(resolve, options.delayMs))
    const method = (init?.method ?? 'GET').toUpperCase()
    let body: unknown
    if (typeof init?.body === 'string' && init.body) body = JSON.parse(init.body)
    const reply = handle(method, url.pathname + url.search, body)
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'Content-Type': 'application/json' } })
  }

  return { calls, handle, fetch: mockFetch, sessions, options, ids: { setId: fixtureSetId, sessionId: fixtureSessionId } }
}
export type PracticeMock = ReturnType<typeof createPracticeMock>
