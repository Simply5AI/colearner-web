import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  coApi, coContextInfoSchema, coContextSchema, coHistorySchema, coReplySchema, coTurnViewSchema, contextQuery, createHomeworkResponseSchema, finalBodySchema, hintBodySchema,
  historyQuery, homeworkApi, homeworkDetailSchema, isSafetyReply, leaksAnswerKey, newClientId, pollDelay, sendTurnBodySchema, stepBodySchema, createHomeworkBodySchema,
  coConversationDetailSchema, homeworkListSchema, type CoReply,
} from '@/lib/api/co'
import { learnErrorMessage } from '@/lib/api/learn-request'
import { contextFixture, reply, safetyReply, scripts } from '@/components/homework/dev/homework-fixtures'
import { createHomeworkMock } from '@/components/homework/dev/homework-mock'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', mocks.fetch) })
afterEach(() => { vi.unstubAllGlobals() })
const respond = (body: unknown, status = 200) => new Response(JSON.stringify({ statusCode: status, data: body, timestamp: 'now' }), { status })

const aiReply: CoReply = reply('Roots take in water.', {
  sources: [{ label: 'page 3', anchorRef: 'a1', quote: 'Roots drink water.', link: { route: 'LIBRARY_ITEM', id: 'm1' } }], suggestions: ['What else do roots do?'],
})
const turn = (extra: Record<string, unknown> = {}) => ({
  id: 't1', ordinal: 1, clientTurnId: 'c-1234567890', learnerText: 'hello', kind: 'CHAT', status: 'READY', createdAt: '2026-10-21T09:00:00Z', reply: aiReply, failure: null, ...extra,
})

describe('B10 CoReply schema', () => {
  it('accepts an AI reply and a code-owned redirect, and normalises missing nullable fields to null', () => {
    const { beyondNote: _a, keyPoints: _b, ...loose } = aiReply
    void _a; void _b
    const parsed = coReplySchema.parse(loose)
    expect(parsed.beyondNote).toBeNull(); expect(parsed.keyPoints).toBeNull()
    expect(coReplySchema.parse(safetyReply('kids', 'SAFE_REDIRECT')).generatedBy).toEqual({ kind: 'CODE' })
  })
  it('rejects unknown keys at every level', () => {
    expect(coReplySchema.safeParse({ ...aiReply, surprise: 1 }).success).toBe(false)
    expect(coReplySchema.safeParse({ ...aiReply, safety: { ...aiReply.safety, extra: true } }).success).toBe(false)
    expect(coReplySchema.safeParse({ ...aiReply, sources: [{ ...aiReply.sources[0], extra: 'x' }] }).success).toBe(false)
    expect(coReplySchema.safeParse({ ...aiReply, generatedBy: { kind: 'AI', packVersion: '1', promptRelease: 'r', model: 'x' } }).success).toBe(false)
  })
  it.each(['answer', 'solution', 'key', 'rubric', 'answerKey', 'correctAnswer', 'finalAnswer', 'workedSolution', 'Solution', 'model_answer'])('refuses a reply that carries a field named %s', name => {
    expect(coReplySchema.safeParse({ ...aiReply, [name]: '42' }).success).toBe(false)
    expect(coReplySchema.safeParse({ ...aiReply, safety: { ...aiReply.safety, [name]: '42' } }).success).toBe(false)
    expect(coReplySchema.safeParse({ ...aiReply, sources: [{ ...aiReply.sources[0], [name]: '42' }] }).success).toBe(false)
  })
  it('refuses the closed-set violations: unknown disposition and reason code, too many suggestions or key points, a note without beyondMaterial', () => {
    expect(coReplySchema.safeParse({ ...aiReply, disposition: 'ANSWER' }).success).toBe(false)
    expect(coReplySchema.safeParse({ ...aiReply, safety: { ...aiReply.safety, reasonCodes: ['NOT_A_CODE'] } }).success).toBe(false)
    expect(coReplySchema.safeParse({ ...aiReply, suggestions: ['a', 'b', 'c', 'd'] }).success).toBe(false)
    expect(coReplySchema.safeParse({ ...aiReply, keyPoints: ['a', 'b', 'c', 'd', 'e'] }).success).toBe(false)
    expect(coReplySchema.safeParse({ ...aiReply, beyondMaterial: false, beyondNote: 'Not in your page' }).success).toBe(false)
    expect(coReplySchema.safeParse({ ...aiReply, beyondMaterial: true, beyondNote: 'Not in your page' }).success).toBe(true)
  })
  it('treats SAFE_REDIRECT, TRUSTED_ADULT and a redirected flag as a safety reply', () => {
    expect(isSafetyReply(safetyReply('teens', 'TRUSTED_ADULT'))).toBe(true)
    expect(isSafetyReply({ ...aiReply, safety: { ...aiReply.safety, redirected: true } })).toBe(true)
    expect(isSafetyReply(aiReply)).toBe(false)
    expect(isSafetyReply(null)).toBe(false)
  })
})

describe('B10 CoTurnView schema (never partial text)', () => {
  it('accepts READY with a reply and QUEUED/RUNNING/FAILED without one', () => {
    expect(coTurnViewSchema.safeParse(turn()).success).toBe(true)
    for (const status of ['QUEUED', 'RUNNING', 'CANCELLED']) expect(coTurnViewSchema.safeParse(turn({ status, reply: null })).success).toBe(true)
    expect(coTurnViewSchema.safeParse(turn({ status: 'FAILED', reply: null, failure: { code: 'generation_failed', retryable: true } })).success).toBe(true)
  })
  it('refuses reply text on a turn that is not READY, and a READY turn without a reply', () => {
    for (const status of ['QUEUED', 'RUNNING', 'FAILED', 'CANCELLED']) expect(coTurnViewSchema.safeParse(turn({ status })).success, status).toBe(false)
    expect(coTurnViewSchema.safeParse(turn({ reply: null })).success).toBe(false)
  })
  it('rejects unknown keys and answer-key fields in the turn', () => {
    expect(coTurnViewSchema.safeParse(turn({ extra: 1 })).success).toBe(false)
    expect(coTurnViewSchema.safeParse(turn({ solution: '4' })).success).toBe(false)
    expect(coTurnViewSchema.safeParse(turn({ kind: 'HW_HINT' })).success).toBe(true)
    expect(coTurnViewSchema.safeParse(turn({ kind: 'MAGIC' })).success).toBe(false)
  })
  it('requires the kind of the turn', () => {
    const { kind: _kind, ...without } = turn()
    void _kind
    expect(coTurnViewSchema.safeParse(without).success).toBe(false)
  })
})

describe('B10 leaksAnswerKey', () => {
  it('finds answer-key field names at any depth and ignores plain words in text', () => {
    expect(leaksAnswerKey({ a: [{ b: { Solution: 'x' } }] })).toBe(true)
    expect(leaksAnswerKey({ text: 'The answer is a word, and so is solution.' })).toBe(false)
    expect(leaksAnswerKey({ keyPoints: ['a'] })).toBe(false)
    expect(leaksAnswerKey(null)).toBe(false)
  })
})

describe('B10 context and conversation schemas', () => {
  it('reads the context answer, the parent-visibility snapshot and the hint cap', () => {
    const parsed = coContextInfoSchema.parse(contextFixture('tweens', { hintsMax: 2 }))
    expect(parsed.hintsMax).toBe(2); expect(parsed.parentVisibility).toEqual({ mode: 'FULL' }); expect(parsed.photo.available).toBe(false)
    expect(coContextInfoSchema.safeParse({ ...contextFixture('tweens'), hintsMax: 4 }).success).toBe(false)
  })
  it('accepts the three conversation contexts and refuses anything else', () => {
    expect(coContextSchema.safeParse({ kind: 'LESSON', lessonId: 'l1', stepIndex: null }).success).toBe(true)
    expect(coContextSchema.safeParse({ kind: 'MATERIAL', materialId: 'm1' }).success).toBe(true)
    expect(coContextSchema.safeParse({ kind: 'HOMEWORK', homeworkSessionId: 'h1' }).success).toBe(true)
    expect(coContextSchema.safeParse({ kind: 'HOMEWORK', homeworkSessionId: 'h1', extra: 1 }).success).toBe(false)
    expect(coContextSchema.safeParse({ kind: 'OTHER' }).success).toBe(false)
  })
  it('reads the history page under either name and the turn count under either name', () => {
    const row = { id: 'c1', kind: 'HOMEWORK', context: { kind: 'HOMEWORK', homeworkSessionId: 'h1' }, title: 'Fractions', count: 7, lastTurnAt: '2026-10-21T09:00:00Z' }
    expect(coHistorySchema.parse({ conversations: [row], nextCursor: null }).conversations[0]?.turnCount).toBe(7)
    expect(coHistorySchema.parse({ items: [{ ...row, turnCount: 3 }], nextCursor: 'n' }).conversations[0]?.turnCount).toBe(3)
  })
  it('refuses a conversation detail whose pending turn carries text', () => {
    const detail = { conversation: { id: 'c1' }, turns: [turn()], pending: null }
    expect(coConversationDetailSchema.safeParse(detail).success).toBe(true)
    expect(coConversationDetailSchema.safeParse({ ...detail, pending: turn({ status: 'RUNNING' }) }).success).toBe(false)
  })
})

describe('B10 homework session schema', () => {
  const detail = () => JSON.parse(JSON.stringify(createHomeworkMock({ band: 'tweens', seed: 'steps-hint2' }).handle('GET', '/api/learn/homework/sessions/hw-1', undefined).body)).data
  it('reads a session the mock serves for every seed and band', () => {
    for (const band of ['kids', 'tweens', 'teens'] as const) {
      for (const seed of ['restate', 'capture', 'steps', 'steps-hint3', 'final', 'checked-on-track', 'checked-not-yet', 'checked-unclear', 'done', 'done-neutral', 'abandoned', 'safety', 'safety-trusted', 'failed'] as const) {
        const body = createHomeworkMock({ band, seed }).handle('GET', '/api/learn/homework/sessions/hw-1', undefined).body as { data: unknown }
        expect(homeworkDetailSchema.safeParse(body.data).success, `${band} ${seed}`).toBe(true)
      }
    }
  })
  it('allows the learner\'s OWN typed answer under final.answer but nothing else named like a key', () => {
    const d = detail()
    expect(homeworkDetailSchema.safeParse({ ...d, final: { answer: '7/8', verdict: 'on_track', feedback: 'Well done.' } }).success).toBe(true)
    expect(homeworkDetailSchema.safeParse({ ...d, solution: '7/8' }).success).toBe(false)
    expect(homeworkDetailSchema.safeParse({ ...d, steps: [{ number: 1, prompt: 'x', learnerResponse: null, answer: '7/8' }] }).success).toBe(false)
    expect(homeworkDetailSchema.safeParse({ ...d, session: { ...d.session, correctAnswer: '7/8' } }).success).toBe(false)
    expect(homeworkDetailSchema.safeParse({ ...d, turns: [{ ...d.turns[0], rubric: 'x' }] }).success).toBe(false)
    expect(homeworkDetailSchema.safeParse({ ...d, workedSolution: ['a'] }).success).toBe(false)
  })
  it('reads the verdict in either case, the visibility as a string or an object, and the band as null when absent', () => {
    const d = detail()
    const parsed = homeworkDetailSchema.parse({ ...d, final: { answer: 'x', verdict: 'ON_TRACK', feedback: null }, session: { ...d.session, parentVisibility: 'SUMMARY', band: undefined } })
    expect(parsed.final?.verdict).toBe('on_track'); expect(parsed.session.parentVisibility).toEqual({ mode: 'SUMMARY' })
    expect(parsed.session.band).toBeNull()
    expect(homeworkDetailSchema.safeParse({ ...d, final: { answer: 'x', verdict: 'correct', feedback: null } }).success).toBe(false)
  })
  it('requires the conversation id, the served hints and the final attempts', () => {
    const d = detail()
    expect(d.session.conversationId).toBe('conv-1')
    expect(homeworkDetailSchema.safeParse({ ...d, session: { ...d.session, conversationId: undefined } }).success).toBe(false)
    const { hints: _hints, ...noHints } = d
    void _hints
    expect(homeworkDetailSchema.safeParse(noHints).success).toBe(false)
    const { finalAttempts: _attempts, ...sessionNoAttempts } = d.session
    void _attempts
    expect(homeworkDetailSchema.safeParse({ ...d, session: sessionNoAttempts }).success).toBe(false)
    expect(homeworkDetailSchema.safeParse({ ...d, session: { ...d.session, finalAttempts: 4 } }).success).toBe(false)
  })
  it('reads hints and finalAttempts from the top of the state or from the session', () => {
    const d = detail()
    const { hints, ...top } = d
    const { finalAttempts, ...inner } = d.session
    const moved = homeworkDetailSchema.parse({ ...top, session: { ...inner, hints, finalAttempts: 2 } })
    expect(moved.hints).toHaveLength(hints.length); expect(moved.session.finalAttempts).toBe(2)
    const topLevel = homeworkDetailSchema.parse({ ...top, session: inner, hints, finalAttempts })
    expect(topLevel.session.finalAttempts).toBe(finalAttempts)
  })
  it('reads the served hints strictly (level 1..3, the step they belong to, no extra fields)', () => {
    const d = detail()
    expect(d.hints.map((hint: { level: number; stepNumber: number }) => [hint.level, hint.stepNumber])).toEqual([[1, 1], [2, 1]])
    expect(homeworkDetailSchema.safeParse({ ...d, hints: [{ level: 4, text: 'x', stepNumber: 1 }] }).success).toBe(false)
    expect(homeworkDetailSchema.safeParse({ ...d, hints: [{ level: 1, text: 'x', stepNumber: 1, solution: '7/8' }] }).success).toBe(false)
    expect(homeworkDetailSchema.safeParse({ ...d, hints: [{ level: 1, text: 'x' }] }).success).toBe(false)
  })
  it('reads the list of earlier sessions', () => {
    const row = { id: 'hw-1', conversationId: 'c1', phase: 'STEPS', problemPreview: '3/4 + 1/8', stepNumber: 2, hintsUsed: 1, startedAt: '2026-10-21T09:00:00Z', finalVerdict: null }
    const parsed = homeworkListSchema.parse({ items: [row, { ...row, id: 'hw-2', phase: 'DONE', finalVerdict: 'ON_TRACK' }], nextCursor: 'n' })
    expect(parsed.items[1]!.finalVerdict).toBe('on_track'); expect(parsed.nextCursor).toBe('n')
    expect(homeworkListSchema.safeParse({ items: [{ ...row, phase: 'SOLVED' }], nextCursor: null }).success).toBe(false)
    expect(homeworkListSchema.safeParse({ items: [{ ...row, conversationId: undefined }], nextCursor: null }).success).toBe(false)
  })
  it('refuses a phase the contract does not define and a hint level above three', () => {
    const d = detail()
    expect(homeworkDetailSchema.safeParse({ ...d, session: { ...d.session, phase: 'SOLVED' } }).success).toBe(false)
    expect(homeworkDetailSchema.safeParse({ ...d, session: { ...d.session, hintLevel: 4 } }).success).toBe(false)
  })
  it('reads the create answer as { session } or the session itself', () => {
    expect(createHomeworkResponseSchema.parse({ session: { id: 'hw-9', phase: 'RESTATE' } })).toEqual({ id: 'hw-9' })
    expect(createHomeworkResponseSchema.parse({ id: 'hw-8' })).toEqual({ id: 'hw-8' })
    expect(createHomeworkResponseSchema.safeParse({}).success).toBe(false)
  })
  it('never carries the expected answers anywhere in the payloads the mock serves', () => {
    for (const band of ['kids', 'tweens', 'teens'] as const) {
      const mock = createHomeworkMock({ band, seed: 'steps-hint3' })
      // The problem text is the learner's own and may name the things to sort (kids); everything else must be free of the answer.
      const payload = JSON.stringify(mock.handle('GET', '/api/learn/homework/sessions/hw-1', undefined).body).toLowerCase().split(JSON.stringify(scripts[band].problem).slice(1, -1).toLowerCase()).join('')
      for (const answer of scripts[band].expected.all) expect(payload.includes(answer.toLowerCase()), `${band}: ${answer}`).toBe(false)
    }
  })
})

describe('B10 request bodies', () => {
  const id = 'abcd1234-abcd-4234-8234-abcd12345678'
  it('limits the final answer to 200 characters and the hint level to 1..3', () => {
    expect(finalBodySchema.safeParse({ clientTurnId: id, answerText: 'x'.repeat(200) }).success).toBe(true)
    expect(finalBodySchema.safeParse({ clientTurnId: id, answerText: 'x'.repeat(201) }).success).toBe(false)
    expect(finalBodySchema.safeParse({ clientTurnId: id, answerText: '   ' }).success).toBe(false)
    for (const level of [0, 4, 1.5]) expect(hintBodySchema.safeParse({ clientTurnId: id, level }).success, String(level)).toBe(false)
    for (const level of [1, 2, 3]) expect(hintBodySchema.safeParse({ clientTurnId: id, level }).success).toBe(true)
  })
  it('refuses unknown fields and trims the text', () => {
    expect(stepBodySchema.safeParse({ clientTurnId: id, learnerResponse: 'x', solution: 'y' }).success).toBe(false)
    expect(stepBodySchema.parse({ clientTurnId: id, learnerResponse: '  add the tops  ' }).learnerResponse).toBe('add the tops')
    expect(createHomeworkBodySchema.safeParse({ problem: '3/4 + 1/8', clientSessionId: id, referenceMaterialId: 'm1' }).success).toBe(true)
    expect(createHomeworkBodySchema.safeParse({ problem: 'x'.repeat(1001), clientSessionId: id }).success).toBe(false)
    expect(sendTurnBodySchema.safeParse({ clientTurnId: id, text: 'hi', style: 'EXAM', stepIndex: 2 }).success).toBe(true)
    expect(sendTurnBodySchema.safeParse({ clientTurnId: id, text: 'hi', style: 'LOUD' }).success).toBe(false)
  })
})

describe('B10 polling and ids', () => {
  it('backs off 800 ms, 1.2 s, 1.6 s, 2 s and caps at 4 s', () => {
    expect([0, 1, 2, 3].map(pollDelay)).toEqual([800, 1200, 1600, 2000])
    expect(pollDelay(8)).toBe(4000); expect(pollDelay(50)).toBe(4000); expect(pollDelay(-3)).toBe(800); expect(pollDelay(2.9)).toBe(1600)
  })
  it('makes unique UUID v4 ids, with and without crypto.randomUUID', () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    const seen = new Set(Array.from({ length: 50 }, () => newClientId()))
    expect(seen.size).toBe(50); for (const id of seen) expect(id).toMatch(uuid)
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => { bytes.forEach((_, index) => { bytes[index] = (index * 37 + 11) % 256 }); return bytes } })
    expect(newClientId()).toMatch(uuid)
    vi.stubGlobal('crypto', undefined)
    expect(newClientId()).toMatch(uuid)
  })
  it('builds only the allowlisted query strings', () => {
    expect(contextQuery({ lessonId: 'l1', materialId: 'm1', stepIndex: 2 })).toBe('?lessonId=l1&materialId=m1&stepIndex=2')
    expect(contextQuery({})).toBe(''); expect(contextQuery({ lessonId: '../x', stepIndex: -1 })).toBe(''); expect(contextQuery({ stepIndex: 1.5 })).toBe('')
    expect(historyQuery('abc', 20)).toBe('limit=20&cursor=abc'); expect(historyQuery(null, 500)).toBe('limit=50'); expect(historyQuery(undefined, 0)).toBe('limit=1')
  })
})

describe('B10 error copy', () => {
  const codes = ['CO_UNAVAILABLE', 'CO_DISABLED_BY_POLICY', 'CONTEXT_NOT_READY', 'CONTEXT_NOT_FOUND', 'TURN_PENDING', 'TURN_LIMIT_REACHED', 'MESSAGE_INVALID', 'TURN_CONFLICT',
    'CONVERSATION_NOT_FOUND', 'HOMEWORK_UNAVAILABLE', 'HOMEWORK_PHASE_INVALID', 'HINT_OUT_OF_ORDER', 'HINTS_DISABLED', 'FINAL_ATTEMPTS_EXHAUSTED', 'PROBLEM_INVALID']
  it.each(codes)('%s has its own learner-safe line and never shows server text', code => {
    const message = learnErrorMessage(409, code, { message: 'LEAK: internal database detail 42' })
    expect(message).not.toContain('LEAK'); expect(message).not.toMatch(/database|stack|undefined/i)
    expect(message).not.toBe(learnErrorMessage(409, undefined)); expect(message.length).toBeGreaterThan(20)
    expect(message).not.toMatch(/[A-Z_]{8,}/)
  })
  it('keeps POLICY_BLOCKED as the only server text', () => {
    expect(learnErrorMessage(403, 'POLICY_BLOCKED', { message: 'Paused until tomorrow.' })).toBe('Paused until tomorrow.')
    expect(learnErrorMessage(403, 'CO_DISABLED_BY_POLICY', { message: 'Paused until tomorrow.' })).not.toContain('Paused')
  })
})

describe('B10 API calls', () => {
  const id = 'abcd1234-abcd-4234-8234-abcd12345678'
  it('calls the exact BFF paths with the right method and checked bodies', async () => {
    mocks.fetch.mockImplementation(async () => respond({ session: { id: 'hw-1' } }))
    await homeworkApi.create({ problem: ' 3/4 + 1/8 ', clientSessionId: id })
    expect(mocks.fetch.mock.calls[0]![0]).toBe('/api/learn/homework/sessions')
    expect(mocks.fetch.mock.calls[0]![1].method).toBe('POST')
    expect(JSON.parse(mocks.fetch.mock.calls[0]![1].body)).toEqual({ problem: '3/4 + 1/8', clientSessionId: id })
    mocks.fetch.mockImplementation(async () => respond({}))
    await homeworkApi.restatement('hw-1', { clientTurnId: id, confirmed: false }); await homeworkApi.finalPhase('hw-1'); await homeworkApi.abandon('hw-1')
    await homeworkApi.step('hw-1', { clientTurnId: id, learnerResponse: 'x' }); await homeworkApi.hint('hw-1', { clientTurnId: id, level: 2 }); await homeworkApi.final('hw-1', { clientTurnId: id, answerText: '7' })
    await homeworkApi.updateProblem('hw-1', { clientTurnId: id, problem: ' 3/4 + 1/8 ' }); await homeworkApi.finish('hw-1')
    expect(mocks.fetch.mock.calls.slice(1).map(call => `${call[1].method} ${call[0]}`)).toEqual([
      'POST /api/learn/homework/sessions/hw-1/restatement', 'POST /api/learn/homework/sessions/hw-1/final-phase', 'POST /api/learn/homework/sessions/hw-1/abandon',
      'POST /api/learn/homework/sessions/hw-1/steps', 'POST /api/learn/homework/sessions/hw-1/hint', 'POST /api/learn/homework/sessions/hw-1/final',
      'PUT /api/learn/homework/sessions/hw-1/problem', 'POST /api/learn/homework/sessions/hw-1/finish',
    ])
    expect(JSON.parse(mocks.fetch.mock.calls[1]![1].body)).toEqual({ clientTurnId: id, confirmed: false })
    expect(JSON.parse(mocks.fetch.mock.calls[7]![1].body)).toEqual({ clientTurnId: id, problem: '3/4 + 1/8' })
    expect(JSON.parse(mocks.fetch.mock.calls[5]![1].body)).toEqual({ clientTurnId: id, level: 2 })
  })
  it('reads the list from the exact path with the cursor and limit', async () => {
    mocks.fetch.mockImplementation(async () => respond({ items: [], nextCursor: null }))
    await homeworkApi.list('abc', 20)
    expect(mocks.fetch.mock.calls[0]![0]).toBe('/api/learn/homework/sessions?limit=20&cursor=abc')
  })
  it('checks a body before it leaves the browser', () => {
    expect(() => homeworkApi.restatement('hw-1', { clientTurnId: 'x', confirmed: true })).toThrow()
    expect(() => homeworkApi.updateProblem('hw-1', { clientTurnId: id, problem: '   ' })).toThrow()
    expect(() => homeworkApi.updateProblem('hw-1', { clientTurnId: id, problem: 'x'.repeat(1001) })).toThrow()
    expect(() => homeworkApi.final('hw-1', { clientTurnId: id, answerText: 'x'.repeat(201) })).toThrow()
    expect(() => homeworkApi.hint('hw-1', { clientTurnId: id, level: 4 as 1 })).toThrow()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it('reads co endpoints and refuses a reply that smuggles a solution', async () => {
    mocks.fetch.mockImplementation(async () => respond(contextFixture('kids')))
    expect((await coApi.context({ lessonId: 'l1', stepIndex: 1 })).hintsMax).toBe(3)
    expect(mocks.fetch.mock.calls[0]![0]).toBe('/api/learn/co/context?lessonId=l1&stepIndex=1')
    mocks.fetch.mockImplementation(async () => respond({ turn: turn({ reply: { ...aiReply, solution: '42' } }) }))
    await expect(coApi.turn('c1', 't1')).rejects.toMatchObject({ status: 502 })
    mocks.fetch.mockImplementation(async () => respond({ turn: turn() }))
    expect((await coApi.sendTurn('c1', { clientTurnId: id, text: 'hello' })).turn.reply?.text).toBe('Roots take in water.')
    expect(mocks.fetch.mock.calls[2]![0]).toBe('/api/learn/co/conversations/c1/turns')
  })
  it('turns a typed failure into the learner-safe copy', async () => {
    mocks.fetch.mockImplementation(async () => new Response(JSON.stringify({ code: 'HINT_OUT_OF_ORDER', message: 'private detail' }), { status: 409 }))
    await expect(homeworkApi.hint('hw-1', { clientTurnId: id, level: 1 })).rejects.toMatchObject({ code: 'HINT_OUT_OF_ORDER', message: 'Open the hints one at a time, starting with the first.' })
  })
})

describe('B10 integration review: the platform answers that the web must match', () => {
  it('reads the retry and cancel answers as the new / cancelled turn', async () => {
    const turn = { id: 'new-turn', ordinal: 3, clientTurnId: 'retry-old-turn', kind: 'CHAT', learnerText: 'Why?', status: 'QUEUED', createdAt: '2026-10-21T09:00:00.000Z', reply: null, failure: null }
    mocks.fetch.mockImplementationOnce(async () => respond({ turn }, 202))
    await expect(coApi.retryTurn('c1', 'old-turn')).resolves.toMatchObject({ turn: { id: 'new-turn', status: 'QUEUED' } })
    expect(mocks.fetch.mock.calls.at(-1)![0]).toBe('/api/learn/co/conversations/c1/turns/old-turn/retry')
    mocks.fetch.mockImplementationOnce(async () => respond({ turn: { ...turn, id: 'old-turn', status: 'CANCELLED' } }))
    await expect(coApi.cancelTurn('c1', 'old-turn')).resolves.toMatchObject({ turn: { status: 'CANCELLED' } })
  })
  it('retries a homework turn through the homework route, never the shared turn route', async () => {
    mocks.fetch.mockImplementationOnce(async () => respond({}))
    await homeworkApi.retry('hw-1')
    const [url, init] = mocks.fetch.mock.calls.at(-1)!
    expect(url).toBe('/api/learn/homework/sessions/hw-1/retry')
    expect(init).toMatchObject({ method: 'POST', body: '{}' })
  })
  it('sends a step index the platform accepts (0 to 4) and drops anything else from the context query', () => {
    expect(sendTurnBodySchema.safeParse({ clientTurnId: 'client-turn-0001', text: 'Hi', stepIndex: 4 }).success).toBe(true)
    expect(sendTurnBodySchema.safeParse({ clientTurnId: 'client-turn-0001', text: 'Hi', stepIndex: 5 }).success).toBe(false)
    expect(contextQuery({ lessonId: 'l1', stepIndex: 5 })).toBe('?lessonId=l1')
    expect(contextQuery({ lessonId: 'l1', stepIndex: 4 })).toBe('?lessonId=l1&stepIndex=4')
  })
})

describe('B10 integration review: every platform error code of the co and homework modules has its own safe copy', () => {
  // CO_ERRORS (co-contracts.ts) and HOMEWORK_ERRORS (homework-contracts.ts), minus the shared B07 codes tested elsewhere.
  const codes = ['CO_UNAVAILABLE', 'CO_DISABLED_BY_POLICY', 'CONTEXT_NOT_READY', 'CONTEXT_NOT_FOUND', 'CONVERSATION_NOT_FOUND', 'TURN_NOT_FOUND', 'TURN_PENDING', 'TURN_LIMIT_REACHED', 'MESSAGE_INVALID',
    'TURN_CONFLICT', 'NOT_RETRYABLE', 'NOT_CANCELLABLE', 'HOMEWORK_CONVERSATION', 'CONVERSATION_CLOSED', 'HOMEWORK_UNAVAILABLE', 'HOMEWORK_PHASE_INVALID', 'HINT_OUT_OF_ORDER', 'HINTS_DISABLED',
    'FINAL_ATTEMPTS_EXHAUSTED', 'PROBLEM_INVALID', 'SESSION_NOT_FOUND', 'SESSION_CONFLICT', 'MATERIAL_NOT_FOUND', 'MATERIAL_NOT_READY', 'DAILY_HOMEWORK_LIMIT']
  it.each(codes)('%s never echoes the server text and is not the generic status line', code => {
    const message = learnErrorMessage(409, code, { code, message: 'secret internal text' })
    expect(message).not.toContain('secret')
    for (const status of [400, 404, 409, 429]) expect(message, code).not.toBe(learnErrorMessage(status, undefined))
  })
  it('does not call a missing homework session a practice', () => {
    expect(learnErrorMessage(404, 'SESSION_NOT_FOUND')).not.toMatch(/practice/i)
    expect(learnErrorMessage(409, 'SESSION_CONFLICT')).not.toMatch(/practice/i)
  })
})
