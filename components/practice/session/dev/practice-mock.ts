import type { LearnBand } from '@/lib/api/learn'
import { answerIssue } from '@/lib/api/practice'
import type { AnswerBody, AnswerReceipt, PracticeAnswer, PracticeMode, QuestionKind, QuestionView } from '../practice-types'
import { apiBandFor, fixtureMaterialId, fixtureQuestions, fixtureSessionId, learnerView, servedKinds, sessionTitle, type AnswerKey, type ServerQuestion } from './practice-fixtures'

/*
 * A stand-in for the B09 session endpoints (platform agent PD2 was built in parallel to the contract). Used by the
 * integration tests (through a stubbed fetch), by /dev/practice-session and by the Playwright review (page.route).
 * It follows the contract: the learner payload never carries a key, hint text only comes from the hint endpoint (one rung
 * at a time), the right answer is revealed only after a correct answer or when the tries are used up, EXAM shows no result
 * until completion, and an answer replayed with the same clientAttemptId returns the stored attempt with replay:true.
 * Written answers are checked by "Co" after a delay (PENDING_FEEDBACK, then GRADED or FEEDBACK_UNAVAILABLE). It is a test
 * double, never production behaviour.
 */
export type PracticeMockState = 'ready' | 'loading' | 'unavailable' | 'denied' | 'expired' | 'completed' | 'abandoned'
export interface PracticeMockOptions {
  band: LearnBand
  mode?: PracticeMode
  /** Kinds in the session, in order. Default: the kinds the server serves to the band. */
  kinds?: QuestionKind[]
  state?: PracticeMockState
  /** Items before this index are already answered (resume). */
  startIndex?: number
  /** Tries per item in PRACTICE/REVIEW (EXAM is always 1). Default 3. */
  attemptsAllowed?: number
  /** Replays of a written answer before Co finishes checking it. Default 2. */
  gradingPolls?: number
  /** Written answers end as FEEDBACK_UNAVAILABLE instead of being graded. */
  feedbackUnavailable?: boolean
  /** The next N answer requests fail with 503 BEFORE being processed. */
  answerFailures?: number
  /** The next N answer requests are processed, but the reply is lost (503): the learner must re-send the same submission. */
  dropReplies?: number
  /** The next N hint requests fail with 503. */
  hintFailures?: number
  /** The next N complete requests fail with 503. */
  completeFailures?: number
  /** Seconds left in a timed session (EXAM, or a timed practice). */
  remainingSec?: number
  delayMs?: number
}
export interface MockCall { method: string; path: string; body: unknown }
export interface MockReply { status: number; body: unknown }

const ok = (data: unknown, status = 200): MockReply => ({ status, body: { statusCode: status, data, timestamp: '2026-10-19T09:00:00.000Z' } })
const fail = (status: number, code: string, message = 'Request refused.'): MockReply => ({ status, body: { statusCode: status, code, message } })
const NOW = '2026-10-19T09:30:00.000Z'
const norm = (value: string) => value.trim().toLowerCase()

interface Attempt {
  id: string; no: number; clientAttemptId: string; answer: PracticeAnswer; score: number | null
  status: 'GRADED' | 'PENDING_FEEDBACK' | 'FEEDBACK_UNAVAILABLE' | 'RECORDED'; replays: number
}
interface Item { question: ServerQuestion; state: 'PENDING' | 'ANSWERED' | 'SKIPPED'; attempts: Attempt[]; hintsUsed: number }

/** Deterministic scoring from the stored key (B09 decision 1). Null for written answers (Co checks those). */
export function scoreAnswer(key: AnswerKey, answer: PracticeAnswer): number | null {
  if (key.kind !== answer.kind) return 0
  switch (key.kind) {
    case 'MCQ': return answer.kind === 'MCQ' && answer.optionId === key.optionId ? 1 : 0
    case 'TRUE_FALSE': return answer.kind === 'TRUE_FALSE' && answer.value === key.value ? 1 : 0
    case 'MULTI_SELECT': {
      if (answer.kind !== 'MULTI_SELECT') return 0
      const right = answer.optionIds.filter(id => key.optionIds.includes(id)).length
      const wrong = answer.optionIds.length - right
      return Math.max(0, (right - wrong) / key.optionIds.length)
    }
    case 'CLOZE': {
      if (answer.kind !== 'CLOZE') return 0
      const correct = key.blanks.filter(blank => { const given = answer.blanks.find(item => item.blankId === blank.blankId); return !!given && blank.accepted.some(entry => norm(entry) === norm(given.value)) }).length
      return correct / key.blanks.length
    }
    case 'MATCHING': return answer.kind === 'MATCHING' ? answer.pairs.filter(pair => key.pairs.some(item => item.leftId === pair.leftId && item.rightId === pair.rightId)).length / key.pairs.length : 0
    case 'ORDERING': return answer.kind === 'ORDERING' ? answer.order.filter((id, position) => key.order[position] === id).length / key.order.length : 0
    case 'SHORT_ANSWER': return null
  }
}
/** The key in the shape of the answer, for `revealedAnswer`. */
export function revealedOf(key: AnswerKey): unknown {
  switch (key.kind) {
    case 'MCQ': return { kind: 'MCQ', optionId: key.optionId }
    case 'TRUE_FALSE': return { kind: 'TRUE_FALSE', value: key.value }
    case 'MULTI_SELECT': return { kind: 'MULTI_SELECT', optionIds: key.optionIds }
    case 'CLOZE': return { kind: 'CLOZE', blanks: key.blanks.map(blank => ({ blankId: blank.blankId, accepted: blank.accepted, value: blank.accepted[0] })) }
    case 'MATCHING': return { kind: 'MATCHING', pairs: key.pairs }
    case 'ORDERING': return { kind: 'ORDERING', order: key.order }
    case 'SHORT_ANSWER': return { kind: 'SHORT_ANSWER', text: key.modelAnswer }
  }
}
const writtenScore = (key: Extract<AnswerKey, { kind: 'SHORT_ANSWER' }>, answer: PracticeAnswer): number => {
  if (answer.kind !== 'SHORT_ANSWER') return 0
  const text = norm(answer.text)
  const hits = key.keywords.filter(word => text.includes(word)).length
  return hits === key.keywords.length ? 1 : hits > 0 ? 0.5 : 0
}

export function createPracticeMock(options: PracticeMockOptions) {
  const { band } = options
  const mode = options.mode ?? 'PRACTICE'
  const exam = mode === 'EXAM'
  const state = options.state ?? 'ready'
  const allowed = exam ? 1 : (options.attemptsAllowed ?? 3)
  const calls: MockCall[] = []
  const bank = fixtureQuestions(band)
  const kinds = options.kinds ?? [...servedKinds[band]]
  const items: Item[] = kinds.map(kind => ({ question: bank.find(question => question.kind === kind)!, state: 'PENDING', attempts: [], hintsUsed: 0 }))
  const startIndex = Math.min(options.startIndex ?? 0, items.length)
  items.slice(0, startIndex).forEach(item => { item.state = 'ANSWERED' })
  let status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED' | 'EXPIRED' = state === 'completed' ? 'COMPLETED' : state === 'expired' ? 'EXPIRED' : state === 'abandoned' ? 'ABANDONED' : 'IN_PROGRESS'
  const deadline = (exam || options.remainingSec !== undefined) ? Date.now() + (options.remainingSec ?? 900) * 1000 : null
  let answerFailures = options.answerFailures ?? 0
  let dropReplies = options.dropReplies ?? 0
  let hintFailures = options.hintFailures ?? 0
  let completeFailures = options.completeFailures ?? 0
  let attemptSeq = 0

  /** Like the platform: the place is the first open item, clamped to the last question; `answered` counts attempted items only (a skip is not one). */
  const current = () => { const open = items.findIndex(item => item.state === 'PENDING'); return open < 0 ? items.length : open }
  const hintCount = (): 0 | 1 | 2 | 3 => 3
  const row = () => ({
    id: fixtureSessionId, mode, status, title: sessionTitle[band], subject: null, startedAt: '2026-10-19T09:00:00.000Z',
    completedAt: status === 'COMPLETED' ? NOW : null, durationSec: null, itemCount: items.length,
    answered: items.filter(item => item.state === 'ANSWERED').length, correct: null, stars: null,
  })
  const sessionState = () => {
    if (status === 'IN_PROGRESS' && deadline !== null && Date.now() >= deadline) status = 'EXPIRED'
    const remainingSec = deadline === null || status !== 'IN_PROGRESS' ? null : Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
    return { session: row(), progress: { answered: items.filter(item => item.state === 'ANSWERED').length, total: items.length, currentIndex: Math.min(current(), Math.max(0, items.length - 1)) }, remainingSec }
  }

  const receiptFor = (index: number, attempt: Attempt, replay: boolean): AnswerReceipt => {
    const item = items[index]!
    const key = item.question.key
    const last = index === items.length - 1
    if (exam) return { attempt: { id: attempt.id, attemptNo: attempt.no, status: 'RECORDED' }, result: null, canRetry: false, attemptsLeft: 0, isLastItem: last, replay }
    if (attempt.status === 'PENDING_FEEDBACK') {
      return { attempt: { id: attempt.id, attemptNo: attempt.no, status: 'PENDING_FEEDBACK' }, result: { correct: null, partial: false, score: null, feedback: null, explanation: null, correctAnswerRevealed: false, revealedAnswer: null, sourceLink: null }, canRetry: false, attemptsLeft: allowed - attempt.no, isLastItem: last, replay }
    }
    if (attempt.status === 'FEEDBACK_UNAVAILABLE') {
      return { attempt: { id: attempt.id, attemptNo: attempt.no, status: 'FEEDBACK_UNAVAILABLE' }, result: { correct: null, partial: false, score: null, feedback: null, explanation: null, correctAnswerRevealed: false, revealedAnswer: null, sourceLink: null }, canRetry: false, attemptsLeft: allowed - attempt.no, isLastItem: last, replay }
    }
    const score = attempt.score ?? 0
    const correct = score === 1
    const left = allowed - attempt.no
    // The right answer is shown only after a correct answer, or when the tries are used up.
    const reveal = correct || left <= 0
    return {
      attempt: { id: attempt.id, attemptNo: attempt.no, status: attempt.status },
      result: {
        correct, partial: score > 0 && score < 1, score, feedback: correct ? item.question.right : item.question.wrong, explanation: item.question.explanation,
        correctAnswerRevealed: reveal, revealedAnswer: reveal ? revealedOf(key) : null, sourceLink: { route: 'LIBRARY_ITEM', id: fixtureMaterialId },
      },
      canRetry: !correct && left > 0, attemptsLeft: Math.max(0, left), isLastItem: last, replay,
    }
  }

  /** Co's check of a written answer finishes after a few replays/polls. */
  const advanceGrading = (attempt: Attempt, item: Item) => {
    if (attempt.status !== 'PENDING_FEEDBACK') return
    attempt.replays += 1
    if (attempt.replays < (options.gradingPolls ?? 2)) return
    if (options.feedbackUnavailable) { attempt.status = 'FEEDBACK_UNAVAILABLE'; return }
    attempt.score = writtenScore(item.question.key as Extract<AnswerKey, { kind: 'SHORT_ANSWER' }>, attempt.answer)
    attempt.status = 'GRADED'
  }

  const handle = (method: string, rawPath: string, body: unknown): MockReply => {
    const path = rawPath.split('?')[0]!.replace(/^\/api\/learn/, '')
    calls.push({ method, path, body })
    const parts = path.split('/').filter(Boolean)
    if (parts[0] !== 'practice' || parts[1] !== 'sessions') return fail(404, 'NOT_FOUND')
    if (state === 'denied') return fail(404, 'SESSION_NOT_FOUND')
    if (state === 'unavailable') return fail(503, 'SERVICE_UNAVAILABLE')
    if (parts[2] !== fixtureSessionId) return fail(404, 'SESSION_NOT_FOUND')
    const tail = parts.slice(3)
    if (method === 'GET' && tail.length === 0) return ok(sessionState())
    // Any read can end a timed session at its deadline.
    sessionState()
    if (method === 'POST' && tail[0] === 'complete') {
      if (completeFailures > 0) { completeFailures -= 1; return fail(503, 'SERVICE_UNAVAILABLE') }
      if (status === 'IN_PROGRESS') status = 'COMPLETED'
      return ok({ session: row() })
    }
    if (tail[0] !== 'items') return fail(404, 'NOT_FOUND')
    if (status === 'EXPIRED') return fail(409, 'SESSION_EXPIRED')
    if (status === 'COMPLETED') return fail(409, 'SESSION_COMPLETED')
    const index = Number(tail[1])
    const item = Number.isInteger(index) ? items[index] : undefined
    if (!item) return fail(404, 'NOT_FOUND')
    const action = tail[2]
    if (method === 'GET' && !action) {
      if (index > current()) return fail(409, 'ITEM_OUT_OF_ORDER')
      return ok(learnerView(item.question, index, item.attempts.length + 1, { attemptsAllowed: allowed, hintsAvailable: exam ? 0 : hintCount() }))
    }
    if (method === 'POST' && action === 'answer') {
      const input = body as AnswerBody
      if (index > current()) return fail(409, 'ITEM_OUT_OF_ORDER')
      // Replay: same clientAttemptId returns the stored attempt, never a second one.
      const stored = item.attempts.find(attempt => attempt.clientAttemptId === input.clientAttemptId)
      if (stored) { advanceGrading(stored, item); return ok(receiptFor(index, stored, true)) }
      if (answerFailures > 0) { answerFailures -= 1; return fail(503, 'SERVICE_UNAVAILABLE') }
      if (input.answer.kind !== item.question.kind) return fail(400, 'ANSWER_KIND_MISMATCH')
      const view = learnerView(item.question, index, 1, { attemptsAllowed: allowed, hintsAvailable: 0 })
      if (answerIssue(view, input.answer)) return fail(400, 'ANSWER_INVALID')
      if (item.attempts.length >= allowed) return fail(409, 'ATTEMPTS_EXHAUSTED')
      const written = item.question.key.kind === 'SHORT_ANSWER'
      const score = scoreAnswer(item.question.key, input.answer)
      attemptSeq += 1
      const attempt: Attempt = {
        id: `attempt-${attemptSeq}`, no: item.attempts.length + 1, clientAttemptId: input.clientAttemptId, answer: input.answer, score, replays: 0,
        status: exam ? 'RECORDED' : written ? 'PENDING_FEEDBACK' : 'GRADED',
      }
      item.attempts.push(attempt)
      item.state = 'ANSWERED'
      if (dropReplies > 0) { dropReplies -= 1; return fail(503, 'SERVICE_UNAVAILABLE') }
      return ok(receiptFor(index, attempt, false))
    }
    if (method === 'POST' && action === 'hint') {
      if (exam) return fail(409, 'HINTS_DISABLED_IN_EXAM')
      if (hintFailures > 0) { hintFailures -= 1; return fail(503, 'SERVICE_UNAVAILABLE') }
      const level = (body as { level: number }).level
      if (![1, 2, 3].includes(level)) return fail(400, 'BAD_REQUEST')
      if (level > item.hintsUsed + 1) return fail(409, 'HINT_OUT_OF_ORDER')
      item.hintsUsed = Math.max(item.hintsUsed, level)
      return ok({ level, text: item.question.hints[level - 1] })
    }
    if (method === 'POST' && action === 'skip') {
      if (exam) return fail(409, 'SKIP_NOT_ALLOWED')
      if (item.state === 'PENDING') item.state = 'SKIPPED'
      return ok({ skipped: true })
    }
    return fail(404, 'NOT_FOUND')
  }

  const mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost')
    if (!url.pathname.startsWith('/api/learn/practice')) return new Response(JSON.stringify({ message: 'Not mocked' }), { status: 404 })
    if (state === 'loading') return new Promise<Response>(() => undefined)
    if (options.delayMs) await new Promise(resolve => setTimeout(resolve, options.delayMs))
    const method = (init?.method ?? 'GET').toUpperCase()
    let body: unknown
    if (typeof init?.body === 'string' && init.body) body = JSON.parse(init.body)
    const reply = handle(method, url.pathname + url.search, body)
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'Content-Type': 'application/json' } })
  }

  return {
    calls, handle, fetch: mockFetch,
    /** Server-side facts for assertions. */
    get attempts() { return items.map(item => item.attempts.map(attempt => ({ no: attempt.no, clientAttemptId: attempt.clientAttemptId, status: attempt.status, score: attempt.score }))) },
    get status() { return status },
    get itemStates() { return items.map(item => item.state) },
    get hintsUsed() { return items.map(item => item.hintsUsed) },
    state: sessionState,
    ids: { sessionId: fixtureSessionId, materialId: fixtureMaterialId, apiBand: apiBandFor(band) },
  }
}
export type PracticeMock = ReturnType<typeof createPracticeMock>
export type { QuestionView }
