import type { LearnBand } from '@/lib/api/learn'
import type { CoReply, CoTurnView } from '../co-types'
import { beyondReply, clarifyReply, contextFixture, fixtureConversationId, safetyReply, sourcedReply, topics, turnFixture, wordLimit } from './co-fixtures'

/*
 * A stand-in for the B10 Ask Co endpoints (platform agent CD1 was built in parallel to the contract). It is used by the
 * integration tests (through a stubbed fetch), by /dev/co, and by the Playwright review (through page.route). It follows the
 * contract: a turn is a durable row that goes QUEUED, RUNNING, then READY with the whole reply (never partial text); a turn is
 * idempotent by `clientTurnId` (same body: same turn, different body: 409 TURN_CONFLICT); a conversation has at most one
 * pending turn (409 TURN_PENDING); the pre-filter answers a risky message at once with a code-owned reply; message length is
 * limited by band. It is a test double, never production behaviour.
 *
 * Keywords in the learner's message choose the outcome: "beyond" (a beyond-material reply), "fail" (the first run fails, a
 * retry succeeds), "forever" (never finishes, for the stop-waiting path), "clarify", "hurt myself" (the pre-filter, trusted
 * adult) and "phone number" (the pre-filter, safe redirect). Anything else is a sourced answer.
 */
export type MockState = 'fresh' | 'history' | 'pending' | 'unavailable' | 'disabled' | 'not-ready' | 'no-context' | 'denied' | 'ended' | 'unreachable' | 'loading' | 'history-failed'
export interface MockOptions {
  band: LearnBand
  state?: MockState
  /** GETs of a turn before it is READY: the first answers RUNNING, the last READY (default 2). */
  polls?: number
  /** Milliseconds every answer is delayed by. */
  delayMs?: number
  mode?: 'FULL' | 'SUMMARY'
  /** The first N turn sends reach the server but the answer is lost (503): the client must resend the SAME id and get the same turn. */
  lostResponses?: number
  /** The first N turn sends fail with 503 before they reach the server. */
  sendFailures?: number
  /** The first N turn reads fail with 503. */
  pollFailures?: number
  /** Error code returned by POST conversations (for example CO_DISABLED_BY_POLICY). */
  startError?: string
  /** Error code returned by POST turns (for example TURN_LIMIT_REACHED). */
  turnError?: string
}
export interface MockCall { method: string; path: string; body: unknown }
export interface MockReply { status: number; body: unknown }

const errors: Record<string, number> = {
  CO_UNAVAILABLE: 409, CO_DISABLED_BY_POLICY: 403, CONTEXT_NOT_READY: 409, CONTEXT_NOT_FOUND: 404, TURN_PENDING: 409, TURN_LIMIT_REACHED: 429,
  MESSAGE_INVALID: 400, TURN_CONFLICT: 409, CONVERSATION_NOT_FOUND: 404, POLICY_BLOCKED: 403,
}
const limits: Record<LearnBand, number> = { kids: 300, tweens: 500, teens: 1000 }
const NOW = '2026-10-21T09:30:00.000Z'
const ok = (data: unknown, status = 200): MockReply => ({ status, body: { statusCode: status, data, timestamp: '2026-10-21T09:00:00.000Z' } })
const fail = (status: number, code: string, message = 'Request refused.'): MockReply => ({ status, body: { statusCode: status, code, message } })
const refuse = (code: string): MockReply => fail(errors[code] ?? 400, code, code === 'POLICY_BLOCKED' ? 'Ask Co is paused until tomorrow because today’s learning time is used up.' : 'Request refused.')

type Outcome = 'sourced' | 'beyond' | 'clarify' | 'failing' | 'forever'
interface ServerTurn extends CoTurnView { polls: number; outcome: Outcome; style: 'SIMPLE' | 'EXAM' }
interface Conversation { id: string; turns: ServerTurn[] }

const outcomeFor = (text: string): Outcome => /\bforever\b/i.test(text) ? 'forever' : /\bfail\b/i.test(text) ? 'failing' : /\bbeyond\b/i.test(text) ? 'beyond' : /\bclarify\b/i.test(text) ? 'clarify' : 'sourced'
/** The pre-filter: a hit is answered at once with a code-owned reply and no model. */
const preFilter = (text: string, band: LearnBand): CoReply | null =>
  /\b(hurt myself|kill myself)\b/i.test(text) ? safetyReply(band, 'TRUSTED_ADULT') : /\b(phone number|home address)\b/i.test(text) ? safetyReply(band, 'SAFE_REDIRECT') : null

export function createCoMock(options: MockOptions) {
  const { band } = options
  const state = options.state ?? 'fresh'
  const calls: MockCall[] = []
  let conversation: Conversation | null = null
  let sent = 0
  let lost = options.lostResponses ?? 0
  let sendFailures = options.sendFailures ?? 0
  let pollFailures = options.pollFailures ?? 0
  let seq = 0
  /** Failed turns that were retried: the platform hides them from the transcript once a successor exists. */
  const retried = new Set<string>()

  const replyFor = (turn: ServerTurn): CoReply => turn.outcome === 'beyond' ? beyondReply(band) : turn.outcome === 'clarify' ? clarifyReply(band) : sourcedReply(band, turn.style)
  const turnOf = (text: string, over: Partial<ServerTurn> = {}): ServerTurn => {
    seq += 1
    const ordinal = (conversation?.turns.length ?? 0) + 1
    return { ...turnFixture({ id: `turn-${seq}`, ordinal, learnerText: text, clientTurnId: `client-turn-${seq}-fixture`, status: 'QUEUED', createdAt: NOW }), polls: 0, outcome: outcomeFor(text), style: 'SIMPLE', ...over }
  }
  const seed = () => {
    if (state !== 'history' && state !== 'pending' && state !== 'history-failed') return
    const topic = topics[band]
    conversation = { id: fixtureConversationId, turns: [] }
    const first = turnOf(topic.question, { status: 'READY', outcome: 'sourced' }); first.reply = sourcedReply(band)
    conversation.turns.push(first)
    const second = turnOf(topic.beyondQuestion, { status: 'READY', outcome: 'beyond' }); second.reply = beyondReply(band)
    conversation.turns.push(second)
    if (state === 'pending') conversation.turns.push(turnOf('And what about the stem?', { status: 'RUNNING', polls: 0 }))
  }
  seed()

  const view = (turn: ServerTurn): CoTurnView => ({
    id: turn.id, ordinal: turn.ordinal, clientTurnId: turn.clientTurnId, learnerText: turn.learnerText, status: turn.status, createdAt: turn.createdAt,
    reply: turn.status === 'READY' ? turn.reply : null, failure: turn.status === 'FAILED' ? turn.failure : null, kind: 'CHAT',
  })
  const detail = () => {
    const turns = (conversation?.turns ?? []).filter(turn => !retried.has(turn.id))
    const pending = turns.find(turn => turn.status === 'QUEUED' || turn.status === 'RUNNING') ?? null
    return { conversation: { id: conversation!.id, title: topics[band].title, turnCount: turns.length }, turns: turns.filter(turn => turn !== pending).map(view), pending: pending ? view(pending) : null }
  }
  const advance = (turn: ServerTurn) => {
    if (turn.status !== 'QUEUED' && turn.status !== 'RUNNING') return
    turn.polls += 1
    if (turn.outcome === 'forever') { turn.status = 'RUNNING'; return }
    if (turn.outcome === 'failing') { turn.status = 'FAILED'; turn.failure = { code: 'generation_failed', retryable: true }; return }
    if (turn.polls >= (options.polls ?? 2)) { turn.status = 'READY'; turn.reply = replyFor(turn); return }
    turn.status = 'RUNNING'
  }

  const handle = (method: string, rawPath: string, body: unknown): MockReply => {
    const [pathOnly, query = ''] = rawPath.split('?')
    const path = pathOnly!.replace(/^\/api\/learn/, '')
    calls.push({ method, path: pathOnly!.replace(/^\/api\/learn/, '') + (query ? `?${query}` : ''), body })
    const parts = path.split('/').filter(Boolean)
    if (parts[0] !== 'co') return fail(404, 'NOT_FOUND')

    if (method === 'GET' && parts[1] === 'context' && parts.length === 2) {
      if (state === 'denied') return fail(404, 'CONTEXT_NOT_FOUND')
      if (state === 'ended') return { status: 401, body: { message: 'Authentication required.' } }
      if (state === 'unreachable') return fail(503, 'SERVICE_UNAVAILABLE')
      const params = new URLSearchParams(query)
      const hasContext = !!(params.get('lessonId') || params.get('materialId'))
      const open = conversation?.id ?? null
      if (state === 'unavailable') return ok(contextFixture(band, { available: false, reason: 'Ask Co is not switched on for you yet.', mode: options.mode }))
      if (state === 'disabled') return ok(contextFixture(band, { available: false, reason: 'Your school or family settings do not allow Ask Co right now.', mode: options.mode }))
      if (state === 'not-ready') return ok(contextFixture(band, { available: false, reason: 'Your material is still being read. Ask Co can answer when it is ready.', mode: options.mode }))
      if (state === 'no-context' || !hasContext) return ok(contextFixture(band, { available: false, noSource: true, reason: null, mode: options.mode }))
      return ok(contextFixture(band, { openConversationId: open, mode: options.mode }))
    }
    if (method === 'POST' && parts[1] === 'conversations' && parts.length === 2) {
      if (options.startError) return refuse(options.startError)
      const existed = conversation !== null
      conversation ??= { id: fixtureConversationId, turns: [] }
      return ok({ conversation: { id: conversation.id, title: topics[band].title, turnCount: conversation.turns.length } }, existed ? 200 : 201)
    }
    if (parts[1] !== 'conversations' || !conversation || parts[2] !== conversation.id) return fail(404, 'CONVERSATION_NOT_FOUND')
    if (method === 'GET' && parts.length === 3) return state === 'history-failed' ? fail(503, 'SERVICE_UNAVAILABLE') : ok(detail())
    if (parts[3] !== 'turns') return fail(404, 'NOT_FOUND')

    if (method === 'POST' && parts.length === 4) {
      const input = body as { clientTurnId?: unknown; text?: unknown; style?: 'SIMPLE' | 'EXAM'; stepIndex?: number }
      if (typeof input.clientTurnId !== 'string' || input.clientTurnId.length < 8 || typeof input.text !== 'string' || !input.text.trim() || input.text.length > limits[band]) return refuse('MESSAGE_INVALID')
      if (input.style === 'EXAM' && band !== 'teens') return refuse('MESSAGE_INVALID')
      const replay = conversation.turns.find(turn => turn.clientTurnId === input.clientTurnId)
      if (replay) return replay.learnerText === input.text ? ok({ turn: view(replay) }, 202) : refuse('TURN_CONFLICT')
      if (options.turnError) return refuse(options.turnError)
      if (sendFailures > 0) { sendFailures -= 1; return fail(503, 'SERVICE_UNAVAILABLE') }
      if (conversation.turns.some(turn => turn.status === 'QUEUED' || turn.status === 'RUNNING')) return refuse('TURN_PENDING')
      sent += 1
      const hit = preFilter(input.text, band)
      const turn = turnOf(input.text, { clientTurnId: input.clientTurnId, style: input.style ?? 'SIMPLE' })
      if (hit) { turn.status = 'READY'; turn.reply = hit }
      conversation.turns.push(turn)
      if (lost > 0) { lost -= 1; return fail(503, 'SERVICE_UNAVAILABLE') }
      return ok({ turn: view(turn) }, 202)
    }
    const turn = conversation.turns.find(item => item.id === parts[4])
    if (!turn) return fail(404, 'CONVERSATION_NOT_FOUND')
    if (method === 'GET' && parts.length === 5) {
      if (pollFailures > 0) { pollFailures -= 1; return fail(503, 'SERVICE_UNAVAILABLE') }
      advance(turn)
      return ok({ turn: view(turn) })
    }
    if (method === 'POST' && parts[5] === 'retry') {
      // The platform makes a NEW turn from the failed one (same words, not charged) and answers 202 with it. A repeat returns that same turn.
      const successor = conversation.turns.find(item => item.clientTurnId === `retry-${turn.id}`)
      if (successor) return ok({ turn: view(successor) }, 202)
      if (turn.status !== 'FAILED' || !turn.failure?.retryable) return fail(409, 'NOT_RETRYABLE')
      if (conversation.turns.some(item => item.status === 'QUEUED' || item.status === 'RUNNING')) return refuse('TURN_PENDING')
      const next = turnOf(turn.learnerText, { clientTurnId: `retry-${turn.id}`, style: turn.style, outcome: 'sourced' })
      retried.add(turn.id)
      conversation.turns.push(next)
      return ok({ turn: view(next) }, 202)
    }
    if (method === 'POST' && parts[5] === 'cancel') {
      if (turn.status !== 'QUEUED' && turn.status !== 'RUNNING') return fail(409, 'NOT_CANCELLABLE')
      turn.status = 'CANCELLED'
      return ok({ turn: view(turn) })
    }
    return fail(404, 'NOT_FOUND')
  }

  const mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost')
    if (!url.pathname.startsWith('/api/learn/co/')) return new Response(JSON.stringify({ message: 'Not mocked' }), { status: 404 })
    if (state === 'loading' && url.pathname === '/api/learn/co/context') return new Promise<Response>(() => undefined)
    if (options.delayMs) await new Promise(resolve => setTimeout(resolve, options.delayMs))
    const method = (init?.method ?? 'GET').toUpperCase()
    let body: unknown
    if (typeof init?.body === 'string' && init.body) body = JSON.parse(init.body)
    const reply = handle(method, url.pathname + url.search, body)
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'Content-Type': 'application/json' } })
  }

  return {
    calls, handle, fetch: mockFetch,
    /** Every turn the server holds, in order (server view). */
    get turns() { return (conversation?.turns ?? []).map(view) },
    /** How many turns the server created (a replay does not count). */
    get created() { return sent },
    wordLimit: wordLimit[band],
    ids: { conversationId: fixtureConversationId },
  }
}
export type CoMock = ReturnType<typeof createCoMock>
