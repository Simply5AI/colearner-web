import type { LearnBand } from '@/lib/api/learn'
import type { CoReply, CoTurnView, HomeworkDetail, HomeworkPhase, TurnKind, TurnStatus } from '@/lib/api/co'
import { apiBandFor, historyRows, reply, safetyReply, scripts, type HomeworkScript } from './homework-fixtures'

/*
 * A stand-in for the B10 homework endpoints (platform agent CD2 was built in parallel to the contract). It is used by the
 * integration tests (through a stubbed fetch), by /dev/homework, and by the Playwright review (through page.route). It follows
 * the contract: a session starts in RESTATE with a QUEUED restate turn; every model-backed transition is a durable turn that is
 * QUEUED -> RUNNING -> READY (or FAILED) as the session is read; hints are strictly sequential and capped by hintsMax; the
 * learner types their own final answer (3 tries); nothing in any payload is a solution (the expected answers live only in this
 * closure); a client turn id is idempotent. It is a test double, never production behaviour.
 */
export type HomeworkSeed =
  | 'new' | 'restate-pending' | 'restate' | 'capture' | 'steps' | 'steps-2' | 'steps-hint1' | 'steps-hint2' | 'steps-hint3' | 'thinking'
  | 'final' | 'checked-on-track' | 'checked-not-yet' | 'checked-unclear' | 'checked-exhausted' | 'done' | 'done-neutral' | 'abandoned'
  | 'safety' | 'safety-trusted' | 'failed' | 'failed-final'
export const homeworkSeeds: readonly HomeworkSeed[] = [
  'new', 'restate-pending', 'restate', 'capture', 'steps', 'steps-2', 'steps-hint1', 'steps-hint2', 'steps-hint3', 'thinking',
  'final', 'checked-on-track', 'checked-not-yet', 'checked-unclear', 'checked-exhausted', 'done', 'done-neutral', 'abandoned',
  'safety', 'safety-trusted', 'failed', 'failed-final',
]

export interface HomeworkMockOptions {
  band: LearnBand
  seed?: HomeworkSeed
  /** The school's cap on hint rungs (0..3). */
  hintsMax?: number
  /** Number of session reads a new turn stays pending for (the first is QUEUED, the next RUNNING). */
  pendingPolls?: number
  /** Keep the pending turn pending until `release()`. */
  hold?: boolean
  /** The next n turns fail (retryable unless failFinal); `failKind` limits this to one kind of turn. */
  failTurns?: number
  failFinal?: boolean
  failKind?: TurnKind
  /** The first n transition POSTs are processed but their reply is lost (503). */
  dropReplies?: number
  /** The first n session creations are processed but their reply is lost (503). */
  dropCreateReplies?: number
  delayMs?: number
  /** GET session answers this status (403/404 denied, 503 unavailable). */
  sessionStatus?: number
  /** POST sessions answers this error code. */
  createError?: string
  mode?: 'FULL' | 'SUMMARY'
  /** Number of earlier homework sessions in the learner's history. */
  historyCount?: number
  historyStatus?: number
  loading?: boolean
}
export interface MockCall { method: string; path: string; body: unknown }
export interface MockReply { status: number; body: unknown }

/** Platform TEXT_LIMITS: the typed problem (6-9: 300, 10-13: 600, 14-17: 1000) and a step answer (300, 500, 1000). */
const limits: Record<LearnBand, number> = { kids: 300, tweens: 500, teens: 1000 }
const problemLimits: Record<LearnBand, number> = { kids: 300, tweens: 600, teens: 1000 }
const errors: Record<string, { status: number; message: string }> = {
  HOMEWORK_UNAVAILABLE: { status: 409, message: 'Homework help is not enabled.' },
  CO_DISABLED_BY_POLICY: { status: 403, message: 'Switched off by policy.' },
  CO_UNAVAILABLE: { status: 503, message: 'Unavailable.' },
  PROBLEM_INVALID: { status: 400, message: 'Invalid problem.' },
  TURN_LIMIT_REACHED: { status: 429, message: 'Limit reached.' },
  POLICY_BLOCKED: { status: 403, message: 'Homework help is paused until tomorrow because today’s learning time is used up.' },
  CONSENT_REQUIRED: { status: 403, message: 'Consent required.' },
}
const ok = (data: unknown, status = 200): MockReply => ({ status, body: { statusCode: status, data, timestamp: '2026-10-21T09:00:00.000Z' } })
const fail = (status: number, code: string, message = 'Request refused.'): MockReply => ({ status, body: { statusCode: status, code, message } })

interface MTurn {
  id: string; ordinal: number; clientTurnId: string; sig: string; learnerText: string; kind: TurnKind
  status: TurnStatus; reply: CoReply | null; failure: { code: string; retryable: boolean } | null; polls: number
  build: () => CoReply; apply: () => void
}
interface MSession {
  id: string; conversationId: string; clientSessionId: string; phase: HomeworkPhase; stepNumber: number; hintLevel: number; hintsUsed: number
  problem: string; steps: { number: number; prompt: string; learnerResponse: string | null }[]; restatement: string | null
  final: { answer: string; verdict: 'on_track' | 'not_yet' | 'unclear' | null; feedback: string | null } | null; finalTries: number
  turns: MTurn[]; ids: Map<string, MTurn>; noTurnIds: Map<string, string>
  hints: { level: 1 | 2 | 3; text: string; stepNumber: number }[]
}

const pending = (turn: MTurn) => turn.status === 'QUEUED' || turn.status === 'RUNNING'
const norm = (value: string) => value.toLowerCase().replace(/[₂]/g, '2').replace(/\s+/g, '')
function judge(script: HomeworkScript, answer: string): 'on_track' | 'not_yet' | 'unclear' {
  const text = norm(answer)
  if (text.length < 2 || /^[?.]+$/.test(text) || /idk|dontknow|noidea/.test(text)) return 'unclear'
  const hits = script.expected.all.every(key => text.includes(norm(key)))
  const bad = (script.expected.none ?? []).some(key => text.includes(norm(key)))
  return hits && !bad ? 'on_track' : 'not_yet'
}

export function createHomeworkMock(options: HomeworkMockOptions) {
  const { band } = options
  const script = scripts[band]
  const calls: MockCall[] = []
  const sessions = new Map<string, MSession>()
  const byClientSession = new Map<string, MSession>()
  let hold = options.hold ?? false
  let failuresLeft = options.failTurns ?? 0
  let dropsLeft = options.dropReplies ?? 0
  let dropCreatesLeft = options.dropCreateReplies ?? 0
  let counter = 0
  const pendingPolls = options.pendingPolls ?? 2
  const hintsMax = options.hintsMax ?? 3
  const nextId = (prefix: string) => `${prefix}-${++counter}`

  const view = (turn: MTurn): CoTurnView => ({
    id: turn.id, ordinal: turn.ordinal, clientTurnId: turn.clientTurnId, learnerText: turn.learnerText, status: turn.status,
    createdAt: '2026-10-21T09:00:00.000Z', reply: turn.status === 'READY' ? turn.reply : null, failure: turn.status === 'FAILED' ? turn.failure : null,
    kind: turn.kind,
  })
  const detail = (session: MSession): HomeworkDetail => {
    const open = session.turns.find(pending) ?? null
    return {
      session: {
        id: session.id, phase: session.phase, stepNumber: session.stepNumber, hintLevel: session.hintLevel, hintsUsed: session.hintsUsed, hintsMax, finalAttempts: session.finalTries,
        parentVisibility: { mode: options.mode ?? (band === 'teens' ? 'SUMMARY' : 'FULL') }, problem: session.problem,
        conversationId: session.conversationId, band: apiBandFor(band),
      },
      turns: session.turns.filter(turn => !pending(turn)).map(view), pending: open ? view(open) : null,
      steps: session.steps.map(step => ({ ...step })), restatement: session.restatement, final: session.final ? { ...session.final } : null,
      hints: session.hints.map(hint => ({ ...hint })),
    }
  }

  const settle = (turn: MTurn) => {
    if (failuresLeft > 0 && (!options.failKind || options.failKind === turn.kind)) {
      failuresLeft -= 1
      turn.status = 'FAILED'; turn.failure = { code: 'generation_failed', retryable: !options.failFinal }
      return
    }
    turn.reply = turn.build(); turn.apply(); turn.status = 'READY'; turn.failure = null
  }
  const settleAll = () => { for (const session of sessions.values()) for (const turn of session.turns) if (pending(turn)) settle(turn) }
  const advance = (session: MSession) => {
    const turn = session.turns.find(pending)
    if (!turn || hold) return
    turn.polls += 1
    if (turn.polls > pendingPolls) settle(turn); else turn.status = turn.polls >= 1 ? 'RUNNING' : 'QUEUED'
  }
  const enqueue = (session: MSession, kind: TurnKind, learnerText: string, clientTurnId: string, sig: string, build: () => CoReply, apply: () => void): MTurn => {
    const turn: MTurn = { id: nextId('turn'), ordinal: session.turns.length + 1, clientTurnId, sig, learnerText, kind, status: 'QUEUED', reply: null, failure: null, polls: 0, build, apply }
    session.turns.push(turn); session.ids.set(clientTurnId, turn)
    return turn
  }
  const blocked = (session: MSession) => session.turns.some(pending)

  const nextStep = (session: MSession) => {
    const index = session.steps.length
    const planned = script.steps[index]
    if (!planned) { session.phase = 'FINAL'; return }
    session.stepNumber = index + 1; session.hintLevel = 0
    session.steps.push({ number: index + 1, prompt: planned.prompt, learnerResponse: null })
  }
  const stepText = (session: MSession) => script.steps[session.steps.length]?.prompt ?? 'That was the last step. Now it is your turn to give your answer.'

  const create = (body: { problem?: string; clientSessionId?: string }): MockReply => {
    const problem = (body.problem ?? '').trim()
    if (!body.clientSessionId || body.clientSessionId.length < 8) return fail(400, 'MESSAGE_INVALID')
    const existing = byClientSession.get(body.clientSessionId)
    if (existing) return ok({ session: { id: existing.id } }, 200)
    if (!problem || problem.length > problemLimits[band]) return fail(400, 'PROBLEM_INVALID')
    const session: MSession = {
      id: sessions.size === 0 ? 'hw-1' : `hw-${sessions.size + 1}`, conversationId: `conv-${sessions.size + 1}`, clientSessionId: body.clientSessionId, phase: 'RESTATE',
      stepNumber: 0, hintLevel: 0, hintsUsed: 0, problem, steps: [], restatement: null, final: null, finalTries: 0, turns: [], ids: new Map(), noTurnIds: new Map(), hints: [],
    }
    sessions.set(session.id, session); byClientSession.set(body.clientSessionId, session)
    enqueue(session, 'HW_RESTATE', problem, nextId('restate-turn-id'), '', () => reply(script.restatement), () => { session.restatement = script.restatement })
    return ok({ session: { id: session.id, phase: 'RESTATE' }, turn: view(session.turns[0]!) }, 201)
  }

  /** Idempotent by clientTurnId: the same body returns the same turn; another body under the same id is a conflict. */
  const replay = (session: MSession, clientTurnId: string, sig: string): MockReply | null => {
    const known = session.ids.get(clientTurnId)
    if (!known) return null
    return known.sig === sig ? ok({ turn: view(known) }, 202) : fail(409, 'TURN_CONFLICT')
  }

  const transition = (session: MSession, action: string, body: Record<string, unknown>): MockReply => {
    if (session.phase === 'ABANDONED' && action !== 'abandon') return fail(409, 'HOMEWORK_PHASE_INVALID')
    switch (action) {
      case 'restatement': {
        const clientTurnId = String(body.clientTurnId ?? '')
        if (typeof body.confirmed !== 'boolean' || clientTurnId.length < 8) return fail(400, 'MESSAGE_INVALID')
        const sig = String(body.confirmed)
        const again = replay(session, clientTurnId, sig)
        if (again) return again
        const noTurn = session.noTurnIds.get(clientTurnId)
        if (noTurn !== undefined) return noTurn === sig ? ok({ session: { id: session.id, phase: session.phase } }, 200) : fail(409, 'TURN_CONFLICT')
        if (session.phase !== 'RESTATE' || blocked(session) || !session.restatement) return fail(409, 'HOMEWORK_PHASE_INVALID')
        // "Not quite" only moves the phase back to CAPTURE: no model call. The new text arrives with PUT .../problem.
        if (!body.confirmed) { session.noTurnIds.set(clientTurnId, sig); session.phase = 'CAPTURE'; session.restatement = null; return ok({ session: { id: session.id, phase: 'CAPTURE' } }, 200) }
        session.phase = 'STEPS'
        const turn = enqueue(session, 'HW_STEP', '', clientTurnId, sig, () => reply(stepText(session)), () => nextStep(session))
        return ok({ turn: view(turn) }, 202)
      }
      case 'problem': {
        const clientTurnId = String(body.clientTurnId ?? ''); const problem = String(body.problem ?? '').trim()
        if (clientTurnId.length < 8) return fail(400, 'MESSAGE_INVALID')
        const again = replay(session, clientTurnId, problem)
        if (again) return again
        if (session.phase !== 'CAPTURE' || blocked(session)) return fail(409, 'HOMEWORK_PHASE_INVALID')
        if (!problem || problem.length > problemLimits[band]) return fail(400, 'PROBLEM_INVALID')
        session.problem = problem; session.phase = 'RESTATE'; session.restatement = null
        const turn = enqueue(session, 'HW_RESTATE', problem, clientTurnId, problem, () => reply(script.restatement), () => { session.restatement = script.restatement })
        return ok({ turn: view(turn) }, 202)
      }
      case 'finish': {
        if (session.phase !== 'CHECKED' || blocked(session)) return fail(409, 'HOMEWORK_PHASE_INVALID')
        session.phase = 'DONE'
        return ok({ session: { id: session.id, phase: 'DONE' } }, 200)
      }
      case 'steps': {
        const clientTurnId = String(body.clientTurnId ?? ''); const text = String(body.learnerResponse ?? '').trim()
        if (clientTurnId.length < 8 || !text || text.length > limits[band]) return fail(400, 'MESSAGE_INVALID')
        const again = replay(session, clientTurnId, text)
        if (again) return again
        if (blocked(session)) return fail(409, 'TURN_PENDING')
        const step = session.steps.find(candidate => candidate.learnerResponse === null)
        if (session.phase !== 'STEPS' || !step) return fail(409, 'HOMEWORK_PHASE_INVALID')
        // The deterministic pre-filter runs before any model call: a hit is a READY, code-owned redirect and the step stays open.
        const hit = /hurt myself|end my life|kill myself/i.test(text) ? 'SAFE_REDIRECT' : /someone is hurting me|being abused/i.test(text) ? 'TRUSTED_ADULT' : null
        if (hit) {
          const turn = enqueue(session, 'HW_STEP', text, clientTurnId, text, () => safetyReply(band, hit), () => undefined)
          turn.status = 'READY'; turn.reply = safetyReply(band, hit)
          return ok({ turn: view(turn) }, 202)
        }
        step.learnerResponse = text
        const turn = enqueue(session, 'HW_STEP', text, clientTurnId, text, () => reply(stepText(session)), () => nextStep(session))
        return ok({ turn: view(turn) }, 202)
      }
      case 'hint': {
        const clientTurnId = String(body.clientTurnId ?? ''); const level = body.level
        if (clientTurnId.length < 8 || (level !== 1 && level !== 2 && level !== 3)) return fail(400, 'MESSAGE_INVALID')
        const again = replay(session, clientTurnId, String(level))
        if (again) return again
        if (session.phase !== 'STEPS') return fail(409, 'HOMEWORK_PHASE_INVALID')
        if (blocked(session)) return fail(409, 'TURN_PENDING')
        if (hintsMax <= 0 || level > hintsMax) return fail(403, 'HINTS_DISABLED')
        if (level !== session.hintLevel + 1) return fail(409, 'HINT_OUT_OF_ORDER')
        const planned = script.steps[session.stepNumber - 1]
        const turn = enqueue(session, 'HW_HINT', '', clientTurnId, String(level), () => reply(planned?.hints[level - 1] ?? 'Look at the step again.'), () => { const text = planned?.hints[level - 1] ?? 'Look at the step again.'; session.hintLevel = level; session.hintsUsed += 1; session.hints.push({ level, text, stepNumber: session.stepNumber }) })
        return ok({ turn: view(turn) }, 202)
      }
      case 'final-phase': {
        if (session.phase !== 'STEPS' || blocked(session)) return fail(409, 'HOMEWORK_PHASE_INVALID')
        session.phase = 'FINAL'
        return ok({ session: { id: session.id, phase: 'FINAL' } }, 200)
      }
      case 'final': {
        const clientTurnId = String(body.clientTurnId ?? ''); const text = String(body.answerText ?? '').trim()
        if (clientTurnId.length < 8 || !text || text.length > 200) return fail(400, 'MESSAGE_INVALID')
        const again = replay(session, clientTurnId, text)
        if (again) return again
        if (blocked(session)) return fail(409, 'TURN_PENDING')
        if (session.finalTries >= 3) return fail(409, 'FINAL_ATTEMPTS_EXHAUSTED')
        if (session.phase !== 'FINAL' && !(session.phase === 'CHECKED' && session.final?.verdict !== 'on_track')) return fail(409, 'HOMEWORK_PHASE_INVALID')
        session.finalTries += 1
        session.final = { answer: text, verdict: null, feedback: null }
        const verdict = judge(script, text)
        const note = verdict === 'on_track' ? script.feedback.onTrack : verdict === 'not_yet' ? script.feedback.notYet : script.feedback.unclear
        const turn = enqueue(session, 'HW_CHECK', text, clientTurnId, text, () => reply(note), () => {
          session.final = { answer: text, verdict, feedback: note }
          session.phase = verdict === 'on_track' || session.finalTries >= 3 ? 'DONE' : 'CHECKED'
        })
        session.phase = 'CHECKED'
        return ok({ turn: view(turn) }, 202)
      }
      case 'retry': {
        // A NEW turn from the newest failed one (same kind, same words); a repeat makes no second turn.
        const failed = [...session.turns].reverse().find(turn => turn.status === 'FAILED')
        if (!failed) return fail(409, 'HOMEWORK_PHASE_INVALID')
        if (session.ids.has(`retry-${failed.id}`)) return ok(detail(session), 200)
        if (session.turns[session.turns.length - 1] !== failed || !failed.failure?.retryable || blocked(session)) return fail(409, 'HOMEWORK_PHASE_INVALID')
        enqueue(session, failed.kind, failed.learnerText, `retry-${failed.id}`, failed.sig, failed.build, failed.apply)
        return ok(detail(session), 200)
      }
      case 'abandon': {
        session.phase = 'ABANDONED'
        return ok({ session: { id: session.id, phase: 'ABANDONED' } }, 200)
      }
      default: return fail(404, 'NOT_FOUND')
    }
  }

  const list = (cursor: string | null): MockReply => {
    if (options.historyStatus && options.historyStatus >= 400) return fail(options.historyStatus, 'CO_UNAVAILABLE')
    const mine = [...sessions.values()].map(session => ({
      id: session.id, conversationId: session.conversationId, phase: session.phase, problemPreview: session.problem.slice(0, 80), stepNumber: session.stepNumber,
      hintsUsed: session.hintsUsed, startedAt: '2026-10-21T09:00:00.000Z', finalVerdict: session.final?.verdict ?? null,
    }))
    const older = historyRows(band, options.historyCount ?? 3)
    if (cursor === 'cursor-2') return ok({ items: [{ ...older[0]!, id: 'hw-older-1', conversationId: 'conv-older-1', problemPreview: 'An older problem' }], nextCursor: null })
    return ok({ items: [...mine, ...older], nextCursor: (options.historyCount ?? 3) > 0 ? 'cursor-2' : null })
  }

  const handle = (method: string, rawPath: string, body: unknown): MockReply => {
    const [pathOnly, query = ''] = rawPath.split('?')
    const path = pathOnly!.replace(/^\/api\/learn/, '')
    calls.push({ method, path: path + (query ? `?${query}` : ''), body })
    const parts = path.split('/').filter(Boolean)
    const record = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
    if (parts[0] === 'co') {
      // The platform's context call is for ONE lesson or material: without a lessonId or materialId it answers 400.
      if (method === 'GET' && parts[1] === 'context' && parts.length === 2) return fail(400, 'context_required')
      // The shared turn retry is for Ask Co chat only; a homework conversation is refused (use POST homework/sessions/:id/retry).
      if (method === 'POST' && parts[1] === 'conversations' && parts[3] === 'turns' && parts[5] === 'retry') return fail(409, 'HOMEWORK_CONVERSATION')
      return fail(404, 'NOT_FOUND')
    }
    if (parts[0] !== 'homework' || parts[1] !== 'sessions') return fail(404, 'NOT_FOUND')
    if (method === 'GET' && parts.length === 2) return list(new URLSearchParams(query).get('cursor'))
    if (method === 'POST' && parts.length === 2) {
      if (options.createError) { const failure = errors[options.createError] ?? { status: 400, message: 'Refused.' }; return { status: failure.status, body: { statusCode: failure.status, code: options.createError, message: failure.message } } }
      const before = sessions.size
      const result = create(record)
      if (result.status < 300 && sessions.size > before && dropCreatesLeft > 0) { dropCreatesLeft -= 1; return fail(503, 'CO_UNAVAILABLE') }
      return result
    }
    const session = sessions.get(parts[2] ?? '')
    if (method === 'GET' && parts.length === 3) {
      if (options.sessionStatus && options.sessionStatus >= 400) return fail(options.sessionStatus, options.sessionStatus === 404 ? 'SESSION_NOT_FOUND' : options.sessionStatus === 403 ? 'FORBIDDEN' : 'CO_UNAVAILABLE')
      if (!session) return fail(404, 'SESSION_NOT_FOUND')
      advance(session)
      return ok(detail(session))
    }
    if ((method === 'POST' || (method === 'PUT' && parts[3] === 'problem')) && parts.length === 4) {
      if (!session) return fail(404, 'SESSION_NOT_FOUND')
      const result = transition(session, parts[3]!, record)
      if (result.status < 300 && dropsLeft > 0 && parts[3] !== 'abandon') { dropsLeft -= 1; return fail(503, 'CO_UNAVAILABLE') }
      return result
    }
    return fail(404, 'NOT_FOUND')
  }

  const mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost')
    if (!url.pathname.startsWith('/api/learn/co') && !url.pathname.startsWith('/api/learn/homework')) return new Response(JSON.stringify({ message: 'Not mocked' }), { status: 404 })
    if (options.loading) return new Promise<Response>(() => undefined)
    if (options.delayMs) await new Promise(resolve => setTimeout(resolve, options.delayMs))
    const method = (init?.method ?? 'GET').toUpperCase()
    let body: unknown
    if (typeof init?.body === 'string' && init.body) body = JSON.parse(init.body)
    const result = handle(method, url.pathname + url.search, body)
    return new Response(JSON.stringify(result.body), { status: result.status, headers: { 'Content-Type': 'application/json' } })
  }

  /* ----- seeds: fast-forward a session to a phase through the same contract calls ----- */
  const post = (path: string, body: unknown) => handle('POST', `/api/learn${path}`, body)
  const settleSession = () => settleAll()
  const seedTo = (seed: HomeworkSeed) => {
    if (seed === 'new') return
    const savedHold = hold; const savedFail = failuresLeft; const savedDrops = dropsLeft; const savedCreateDrops = dropCreatesLeft
    hold = false; dropsLeft = 0; dropCreatesLeft = 0
    failuresLeft = seed === 'failed' || seed === 'failed-final' ? 1 : 0
    if (seed === 'failed-final') options.failFinal = true
    const created = post('/homework/sessions', { problem: script.problem, clientSessionId: 'seed-session-0001' })
    const sessionId = (created.body as { data: { session: { id: string } } }).data.session.id
    const base = `/homework/sessions/${sessionId}`
    const settleNow = () => settleSession()
    let n = 0
    const turnId = () => `seed-turn-${String(++n).padStart(4, '0')}`
    if (seed === 'restate-pending') { hold = savedHold; failuresLeft = savedFail; dropsLeft = savedDrops; dropCreatesLeft = savedCreateDrops; return }
    settleNow()
    if (seed === 'failed' || seed === 'failed-final') { failuresLeft = savedFail; dropsLeft = savedDrops; dropCreatesLeft = savedCreateDrops; hold = savedHold; return }
    if (seed === 'restate') { failuresLeft = savedFail; dropsLeft = savedDrops; dropCreatesLeft = savedCreateDrops; hold = savedHold; return }
    if (seed === 'capture') { post(`${base}/restatement`, { clientTurnId: 'seed-restatement-no', confirmed: false }); failuresLeft = savedFail; dropsLeft = savedDrops; dropCreatesLeft = savedCreateDrops; hold = savedHold; return }
    post(`${base}/restatement`, { clientTurnId: 'seed-restatement-yes', confirmed: true }); settleNow()
    const answerStep = (text: string) => { post(`${base}/steps`, { clientTurnId: turnId(), learnerResponse: text }); settleNow() }
    const hint = (level: number) => { post(`${base}/hint`, { clientTurnId: turnId(), level }); settleNow() }
    const answers = band === 'kids' ? ['Under the ground', 'The ones that grow under the ground'] : band === 'tweens' ? ['Make the bottoms the same', 'Multiply the top and bottom by 2', 'Add the tops'] : ['A neutralisation reaction', 'A salt and water', 'It is balanced']
    const toFinal = () => { script.steps.forEach((_, index) => { if (sessions.get(sessionId)!.phase === 'STEPS') answerStep(answers[index] ?? 'I think so') }); if (sessions.get(sessionId)!.phase === 'STEPS') post(`${base}/final-phase`, {}) }
    const correct = band === 'kids' ? 'carrot, potato, radish, beetroot' : band === 'tweens' ? '7/8' : 'NaOH + HCl -> NaCl + H2O'
    const wrong = band === 'kids' ? 'carrot, apple' : band === 'tweens' ? '4/12' : 'NaOH + HCl -> NaCl'
    const finalAnswer = (text: string) => { post(`${base}/final`, { clientTurnId: turnId(), answerText: text }); settleNow() }
    const target = sessions.get(sessionId)!
    switch (seed) {
      case 'steps': break
      case 'steps-2': answerStep(answers[0]!); break
      case 'steps-hint1': hint(1); break
      case 'steps-hint2': hint(1); hint(2); break
      case 'steps-hint3': hint(1); hint(2); hint(3); break
      case 'thinking': hold = true; post(`${base}/steps`, { clientTurnId: turnId(), learnerResponse: answers[0] }); break
      case 'final': toFinal(); break
      case 'checked-on-track': toFinal(); finalAnswer(correct); target.phase = 'CHECKED'; break
      case 'done': toFinal(); finalAnswer(correct); break
      case 'checked-not-yet': toFinal(); finalAnswer(wrong); break
      case 'checked-unclear': toFinal(); finalAnswer('idk'); break
      case 'checked-exhausted': toFinal(); finalAnswer(wrong); finalAnswer(wrong); finalAnswer(wrong); target.phase = 'CHECKED'; break
      case 'done-neutral': toFinal(); finalAnswer(wrong); finalAnswer(wrong); finalAnswer(wrong); break
      case 'abandoned': post(`${base}/abandon`, {}); break
      case 'safety': post(`${base}/steps`, { clientTurnId: turnId(), learnerResponse: 'I want to hurt myself' }); break
      case 'safety-trusted': post(`${base}/steps`, { clientTurnId: turnId(), learnerResponse: 'someone is hurting me' }); break
      default: break
    }
    if (seed !== 'thinking') hold = savedHold
    failuresLeft = savedFail; dropsLeft = savedDrops; dropCreatesLeft = savedCreateDrops
    calls.length = 0
  }
  seedTo(options.seed ?? 'new')
  if (options.seed && options.seed !== 'new') calls.length = 0

  return {
    calls, handle, fetch: mockFetch, sessions, options, script,
    /** The id of the seeded (or first created) session. */
    sessionId: 'hw-1',
    /** Lets a held pending turn finish. */
    release: () => { hold = false },
    /** The answers the coach is checking against. They exist only here: a test scans every payload to prove they are never sent. */
    expected: script.expected.all,
  }
}
export type HomeworkMock = ReturnType<typeof createHomeworkMock>
