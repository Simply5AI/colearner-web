import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  answerBodySchema, answerIssue, answerReceiptSchema, answerSheetSchema, hubQuery, historyQuery, isStartScope, leaksQuestionKey, modeForScope, newClientId,
  practiceAnswerSchema, practiceApi, practiceErrorMessage, practiceFailureText, practiceHubSchema, practiceSetSchema, practiceSummarySchema,
  questionViewSchema, sessionHistorySchema, sessionScopeFor, type QuestionView,
} from '@/lib/api/practice'
import { learnErrorMessage } from '@/lib/api/learn-request'
import { linkHref } from '@/lib/api/learn'
import { answerSheetFixture, hubFixture, practiceBands, setFixture, summaryFixture, historyPage } from '@/components/practice/dev/practice-fixtures'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', mocks.fetch) })
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

const base = { itemIndex: 0, questionId: 'q1', prompt: 'Pick one', hintsAvailable: 3, sourceLink: null, timeLimitSec: null, attemptsAllowed: 3, attemptNo: 1 } as const
const opts = [{ id: 'a', text: 'Roots' }, { id: 'b', text: 'Leaf' }]
const views: Record<string, unknown> = {
  MCQ: { ...base, kind: 'MCQ', options: opts },
  MULTI_SELECT: { ...base, kind: 'MULTI_SELECT', options: [...opts, { id: 'c', text: 'Stem' }], minSelect: 2 },
  TRUE_FALSE: { ...base, kind: 'TRUE_FALSE' },
  CLOZE: { ...base, kind: 'CLOZE', parts: [{ type: 'text', text: 'Blue litmus turns ' }, { type: 'blank', id: 'b1', options: opts }, { type: 'text', text: ' in acid. ' }, { type: 'blank', id: 'b2' }] },
  MATCHING: { ...base, kind: 'MATCHING', left: opts, right: [{ id: 'x', text: 'Drinks' }, { id: 'y', text: 'Makes food' }] },
  ORDERING: { ...base, kind: 'ORDERING', items: [...opts, { id: 'c', text: 'Stem' }] },
  SHORT_ANSWER: { ...base, kind: 'SHORT_ANSWER', maxChars: 1000 },
}

describe('B09 QuestionView schema', () => {
  it.each(Object.keys(views))('accepts a %s question and normalises a missing blank option list to null', kind => {
    const parsed = questionViewSchema.parse(views[kind])
    expect(parsed.kind).toBe(kind)
    if (kind === 'CLOZE') expect((parsed as Extract<QuestionView, { kind: 'CLOZE' }>).parts[3]).toEqual({ type: 'blank', id: 'b2', options: null })
  })
  it.each([
    ['answerKey', { answerKey: { optionId: 'a' } }], ['correctOptionId', { correctOptionId: 'a' }], ['explanation', { explanation: 'Because roots drink.' }],
    ['rubric', { rubric: 'Mention water' }], ['modelAnswer', { modelAnswer: 'Roots.' }], ['accepted', { accepted: ['roots'] }], ['hints', { hints: [{ level: 1, text: 'x' }] }],
    ['an unknown extra key', { surprise: 1 }], ['isCorrect', { isCorrect: true }],
  ])('refuses a question that carries %s', (_name, extra) => {
    for (const kind of Object.keys(views)) expect(questionViewSchema.safeParse({ ...(views[kind] as object), ...extra }).success, kind).toBe(false)
  })
  it('refuses a key hidden inside an option, a blank, a pair side or an ordering item', () => {
    expect(questionViewSchema.safeParse({ ...(views.MCQ as object), options: [{ id: 'a', text: 'Roots', correct: true }, opts[1]] }).success).toBe(false)
    expect(questionViewSchema.safeParse({ ...(views.MCQ as object), options: [{ id: 'a', text: 'Roots', feedback: 'Yes' }, opts[1]] }).success).toBe(false)
    expect(questionViewSchema.safeParse({ ...(views.CLOZE as object), parts: [{ type: 'blank', id: 'b1', options: null, accepted: ['red'] }] }).success).toBe(false)
    expect(questionViewSchema.safeParse({ ...(views.ORDERING as object), items: [{ id: 'a', text: 'A', position: 1, correctOrder: 1 }, { id: 'b', text: 'B' }] }).success).toBe(false)
    expect(leaksQuestionKey({ deep: [{ nested: { Explanation: 'x' } }] })).toBe(true)
    expect(leaksQuestionKey({ hintsAvailable: 3 })).toBe(false)
  })
  it('refuses structural nonsense: duplicate ids, a wrong discriminator, too few options, a missing field', () => {
    expect(questionViewSchema.safeParse({ ...(views.MCQ as object), options: [{ id: 'a', text: 'x' }, { id: 'a', text: 'y' }] }).success).toBe(false)
    expect(questionViewSchema.safeParse({ ...(views.MCQ as object), options: [{ id: 'a', text: 'x' }] }).success).toBe(false)
    expect(questionViewSchema.safeParse({ ...(views.MCQ as object), kind: 'CODE' }).success).toBe(false)
    expect(questionViewSchema.safeParse({ ...(views.TRUE_FALSE as object), options: opts }).success).toBe(false)
    expect(questionViewSchema.safeParse({ ...(views.MCQ as object), hintsAvailable: 4 }).success).toBe(false)
    const { prompt: _prompt, ...noPrompt } = views.MCQ as { prompt: string }
    void _prompt
    expect(questionViewSchema.safeParse(noPrompt).success).toBe(false)
  })
})

describe('B09 PracticeAnswer schema and answerIssue', () => {
  it('accepts each answer kind and refuses unknown keys, empty selections and over-long text', () => {
    const good = [{ kind: 'MCQ', optionId: 'a' }, { kind: 'MULTI_SELECT', optionIds: ['a', 'b'] }, { kind: 'TRUE_FALSE', value: false }, { kind: 'CLOZE', blanks: [{ blankId: 'b1', value: 'a' }] },
      { kind: 'MATCHING', pairs: [{ leftId: 'a', rightId: 'x' }] }, { kind: 'ORDERING', order: ['a', 'b'] }, { kind: 'SHORT_ANSWER', text: 'roots' }]
    for (const answer of good) expect(practiceAnswerSchema.safeParse(answer).success, answer.kind).toBe(true)
    expect(practiceAnswerSchema.safeParse({ kind: 'MCQ', optionId: 'a', correct: true }).success).toBe(false)
    expect(practiceAnswerSchema.safeParse({ kind: 'MULTI_SELECT', optionIds: [] }).success).toBe(false)
    expect(practiceAnswerSchema.safeParse({ kind: 'CLOZE', blanks: [{ blankId: 'b', value: 'x'.repeat(81) }] }).success).toBe(false)
    expect(practiceAnswerSchema.safeParse({ kind: 'CODE', text: 'x' }).success).toBe(false)
    expect(answerBodySchema.safeParse({ clientAttemptId: 'short', answer: good[0], timeSpentMs: 10 }).success).toBe(false)
    expect(answerBodySchema.safeParse({ clientAttemptId: 'attempt-12345', answer: good[0], timeSpentMs: 10 }).success).toBe(true)
  })
  it('checks that the kind equals the item kind and that every id belongs to the question', () => {
    const q = (kind: string) => questionViewSchema.parse(views[kind])
    expect(answerIssue(q('MCQ'), { kind: 'TRUE_FALSE', value: true })).toBe('ANSWER_KIND_MISMATCH')
    expect(answerIssue(q('MCQ'), { kind: 'MCQ', optionId: 'a' })).toBeNull()
    expect(answerIssue(q('MCQ'), { kind: 'MCQ', optionId: 'zzz' })).toBe('ANSWER_INVALID')
    expect(answerIssue(q('MULTI_SELECT'), { kind: 'MULTI_SELECT', optionIds: ['a'] })).toBe('ANSWER_INVALID')
    expect(answerIssue(q('MULTI_SELECT'), { kind: 'MULTI_SELECT', optionIds: ['a', 'b'] })).toBeNull()
    expect(answerIssue(q('CLOZE'), { kind: 'CLOZE', blanks: [{ blankId: 'b1', value: 'a' }, { blankId: 'b2', value: 'red' }] })).toBeNull()
    expect(answerIssue(q('CLOZE'), { kind: 'CLOZE', blanks: [{ blankId: 'b1', value: 'nope' }, { blankId: 'b2', value: 'red' }] })).toBe('ANSWER_INVALID')
    expect(answerIssue(q('MATCHING'), { kind: 'MATCHING', pairs: [{ leftId: 'a', rightId: 'x' }, { leftId: 'b', rightId: 'y' }] })).toBeNull()
    expect(answerIssue(q('MATCHING'), { kind: 'MATCHING', pairs: [{ leftId: 'a', rightId: 'x' }] })).toBe('ANSWER_INVALID')
    expect(answerIssue(q('ORDERING'), { kind: 'ORDERING', order: ['c', 'a', 'b'] })).toBeNull()
    expect(answerIssue(q('ORDERING'), { kind: 'ORDERING', order: ['a', 'a', 'b'] })).toBe('ANSWER_INVALID')
    expect(answerIssue(q('SHORT_ANSWER'), { kind: 'SHORT_ANSWER', text: '   ' })).toBe('ANSWER_INVALID')
    expect(answerIssue(q('SHORT_ANSWER'), { kind: 'SHORT_ANSWER', text: 'x'.repeat(1001) })).toBe('ANSWER_INVALID')
    expect(answerIssue(q('SHORT_ANSWER'), { kind: 'SHORT_ANSWER', text: 'roots' })).toBeNull()
  })
})

describe('B09 AnswerReceipt schema', () => {
  const receipt = { attempt: { id: 'at1', attemptNo: 1, status: 'GRADED' }, canRetry: true, attemptsLeft: 2, isLastItem: false, replay: false }
  const result = { correct: false, partial: false, score: 0, feedback: null, explanation: null, correctAnswerRevealed: false, revealedAnswer: null, sourceLink: null }
  it('accepts a graded receipt, a replay and an EXAM receipt with no result', () => {
    expect(answerReceiptSchema.safeParse({ ...receipt, result }).success).toBe(true)
    expect(answerReceiptSchema.parse({ ...receipt, replay: true, result: { ...result, correct: true, correctAnswerRevealed: true, revealedAnswer: { optionId: 'a' } } }).replay).toBe(true)
    expect(answerReceiptSchema.parse({ ...receipt, result: null }).result).toBeNull()
  })
  it('refuses an answer that arrives without being revealed, and bad statuses', () => {
    expect(answerReceiptSchema.safeParse({ ...receipt, result: { ...result, revealedAnswer: { optionId: 'a' } } }).success).toBe(false)
    expect(answerReceiptSchema.safeParse({ ...receipt, attempt: { id: 'at1', attemptNo: 1, status: 'DONE' }, result: null }).success).toBe(false)
  })
})

describe('B09 hub, set, session, summary and answer sheet schemas', () => {
  it.each(practiceBands)('accept every %s hub state, the summaries and the answer sheet', band => {
    for (const state of ['default', 'caught-up', 'no-content', 'weak-spots', 'sets-pending'] as const) expect(practiceHubSchema.safeParse(hubFixture(band, state)).success, state).toBe(true)
    for (const state of ['great', 'tough', 'feedback-unavailable', 'no-reward', 'later-release'] as const) expect(practiceSummarySchema.safeParse(summaryFixture(band, state)).success, state).toBe(true)
    expect(answerSheetSchema.safeParse(answerSheetFixture(band)).success).toBe(true)
    expect(sessionHistorySchema.safeParse(historyPage(band, null)).success).toBe(true)
  })
  it('accepts every set status and failure shape', () => {
    for (const status of ['QUEUED', 'RUNNING', 'READY', 'FAILED', 'CANCELLED'] as const) expect(practiceSetSchema.safeParse(setFixture(status)).success).toBe(true)
    const { lessonId: _lesson, ...withoutLesson } = setFixture('READY')
    void _lesson
    expect(practiceSetSchema.parse(withoutLesson).lessonId).toBeNull()
  })
  it('reads a null question count (a set that is not READY yet) as zero', () => {
    const generating = { ...setFixture('RUNNING'), questionCount: null }
    expect(practiceSetSchema.parse(generating).questionCount).toBe(0)
    expect(practiceSetSchema.safeParse({ ...generating, questionCount: -1 }).success).toBe(false)
  })
  it('keeps XP, level and readiness null in B09 and passes a number through only when one is sent', () => {
    const great = practiceSummarySchema.parse(summaryFixture('teens', 'great'))
    expect([great.xp, great.level, great.readiness]).toEqual([null, null, null])
    expect(practiceSummarySchema.parse({ ...summaryFixture('teens'), xp: 'lots', level: { n: 1 }, readiness: undefined }).xp).toBeNull()
    expect(practiceSummarySchema.parse(summaryFixture('teens', 'later-release')).xp).toBe(80)
  })
  it('refuses unknown modes, stars out of range and bad link scopes', () => {
    const hub = hubFixture('teens')
    expect(practiceHubSchema.safeParse({ ...hub, recent: [{ ...hub.recent[0], mode: 'QUIZ' }] }).success).toBe(false)
    expect(practiceHubSchema.safeParse({ ...hub, sets: [{ ...hub.sets[0], bestStars: 4 }] }).success).toBe(false)
    expect(practiceHubSchema.safeParse({ ...hub, sets: [{ ...hub.sets[0], start: { link: { route: 'PRACTICE', id: 'x', scope: 'EVERYTHING' }, enabled: true, disabledReason: null } }] }).success).toBe(false)
    expect(practiceSummarySchema.safeParse({ ...summaryFixture('kids'), stars: 5 }).success).toBe(false)
  })
  it('accepts `items` as an alias of `sessions` in the history page', () => {
    expect(sessionHistorySchema.parse({ items: historyPage('teens', 'c').sessions, nextCursor: null }).sessions).toHaveLength(1)
  })
})

describe('B09 PRACTICE links (linkHref)', () => {
  it('maps every scope to a real web route', () => {
    expect(linkHref({ route: 'PRACTICE', id: null, scope: 'HUB' })).toBe('/learn/practice')
    expect(linkHref({ route: 'PRACTICE', id: null, scope: 'DUE' })).toBe('/learn/practice')
    expect(linkHref({ route: 'PRACTICE', id: null })).toBe('/learn/practice')
    expect(linkHref({ route: 'PRACTICE', id: 'm-1', scope: 'MATERIAL' })).toBe('/learn/practice/start?scope=MATERIAL&id=m-1')
    expect(linkHref({ route: 'PRACTICE', id: 'l-1', scope: 'LESSON' })).toBe('/learn/practice/start?scope=LESSON&id=l-1')
    expect(linkHref({ route: 'PRACTICE', id: 't-1', planId: 'p-1', scope: 'TOPIC' })).toBe('/learn/practice/start?scope=TOPIC&id=t-1&planId=p-1')
    expect(linkHref({ route: 'PRACTICE', id: 'p-1', scope: 'PLAN_EXAM' })).toBe('/learn/practice/start?scope=PLAN_EXAM&id=p-1')
    expect(linkHref({ route: 'PRACTICE', id: 's-1', scope: 'SET' })).toBe('/learn/practice/start?scope=SET&id=s-1')
  })
  it('does not guess: no scope with an id, a scope without its id, a hub link with an id, or an id that could escape', () => {
    expect(linkHref({ route: 'PRACTICE', id: 'p-1' })).toBeNull()
    expect(linkHref({ route: 'PRACTICE', id: null, scope: 'SET' })).toBeNull()
    expect(linkHref({ route: 'PRACTICE', id: 'x', scope: 'HUB' })).toBeNull()
    expect(linkHref({ route: 'PRACTICE', id: '../admin', scope: 'SET' })).toBeNull()
    expect(linkHref({ route: 'PRACTICE', id: 's-1', planId: 'a/b', scope: 'SET' })).toBe('/learn/practice/start?scope=SET&id=s-1')
  })
})

describe('B09 start helpers', () => {
  it('derives the mode from the scope: review, timed mock test, practice', () => {
    expect([modeForScope('DUE'), modeForScope('PLAN_EXAM'), modeForScope('SET'), modeForScope('MATERIAL'), modeForScope('TOPIC'), modeForScope('LESSON')]).toEqual(['REVIEW', 'EXAM', 'PRACTICE', 'PRACTICE', 'PRACTICE', 'PRACTICE'])
    expect(isStartScope('HUB')).toBe(false)
    expect(isStartScope('PLAN_EXAM')).toBe(true)
  })
  it('names the session scope the server expects', () => {
    expect(sessionScopeFor('DUE', null, null, null)).toEqual({ kind: 'DUE' })
    expect(sessionScopeFor('SET', 's1', null, null)).toEqual({ kind: 'SET', id: 's1' })
    expect(sessionScopeFor('MATERIAL', 'm1', null, 'set-9')).toEqual({ kind: 'SET', id: 'set-9' })
    expect(sessionScopeFor('MATERIAL', 'm1', null, null)).toBeNull()
    expect(sessionScopeFor('TOPIC', 't1', 'p1', null)).toEqual({ kind: 'TOPIC', id: 't1', planId: 'p1' })
    // The server refuses a TOPIC session without its plan (400 scope_invalid), so the client never sends one.
    expect(sessionScopeFor('TOPIC', 't1', null, null)).toBeNull()
    expect(sessionScopeFor('PLAN_EXAM', 'p1', null, null)).toEqual({ kind: 'PLAN_EXAM', id: 'p1', planId: 'p1' })
  })
  it('makes distinct client ids and builds only allowed queries', () => {
    expect(newClientId('s')).not.toBe(newClientId('s'))
    expect(newClientId('s').length).toBeLessThanOrEqual(64)
    expect(hubQuery({ subjectId: 'sub-1', planId: '../x' })).toBe('?subjectId=sub-1')
    expect(hubQuery({})).toBe('')
    expect(historyQuery('abc', 500)).toBe('limit=50&cursor=abc')
    expect(historyQuery(null, 0)).toBe('limit=1')
  })
})

describe('B09 client requests', () => {
  it('sends each call to the BFF path and verb the allowlist expects, with unwrapped data', async () => {
    mocks.fetch.mockImplementation(async () => reply({ data: hubFixture('teens') }))
    await practiceApi.hub({ planId: 'plan-1' })
    expect(mocks.fetch.mock.calls[0]![0]).toBe('/api/learn/practice/hub?planId=plan-1')
    mocks.fetch.mockImplementation(async () => reply({ data: { set: setFixture('QUEUED') } }))
    await practiceApi.createSet({ materialId: 'm-1' })
    expect(mocks.fetch.mock.calls[1]![0]).toBe('/api/learn/practice/sets')
    expect(mocks.fetch.mock.calls[1]![1]).toMatchObject({ method: 'POST', body: '{"materialId":"m-1"}' })
    await practiceApi.set('set-1'); await practiceApi.retrySet('set-1')
    expect(mocks.fetch.mock.calls[2]![0]).toBe('/api/learn/practice/sets/set-1')
    expect(mocks.fetch.mock.calls[3]![0]).toBe('/api/learn/practice/sets/set-1/retry')
    mocks.fetch.mockImplementation(async () => reply({ data: { session: { id: 's-9', extra: 'ignored' } } }))
    expect((await practiceApi.createSession({ clientSessionId: 'client-1234', mode: 'REVIEW', scope: { kind: 'DUE' } })).session.id).toBe('s-9')
    expect(JSON.parse(mocks.fetch.mock.calls[4]![1].body)).toEqual({ clientSessionId: 'client-1234', mode: 'REVIEW', scope: { kind: 'DUE' } })
    mocks.fetch.mockImplementation(async () => reply({ data: historyPage('teens', null) }))
    await practiceApi.history('cur 1')
    expect(mocks.fetch.mock.calls[5]![0]).toBe('/api/learn/practice/sessions?limit=20&cursor=cur+1')
  })
  it('encodes ids and refuses to send a malformed answer', async () => {
    mocks.fetch.mockImplementation(async () => reply({ data: {} }))
    await practiceApi.regrade('a/b').catch(() => undefined)
    expect(mocks.fetch.mock.calls[0]![0]).toBe('/api/learn/practice/attempts/a%2Fb/regrade')
    expect(() => practiceApi.answer('s1', 0, { clientAttemptId: 'x', answer: { kind: 'MCQ', optionId: 'a' }, timeSpentMs: 5 })).toThrow()
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })
  it('turns a question that carries the answer into a refusal, so it is never held', async () => {
    mocks.fetch.mockImplementation(async () => reply({ data: { ...(views.MCQ as object), correctOptionId: 'a' } }))
    await expect(practiceApi.item('s1', 0)).rejects.toMatchObject({ status: 502 })
    mocks.fetch.mockImplementation(async () => reply({ data: views.MCQ }))
    expect((await practiceApi.item('s1', 2)).kind).toBe('MCQ')
    expect(mocks.fetch.mock.calls[1]![0]).toBe('/api/learn/practice/sessions/s1/items/2')
  })
})

describe('B09 safe error copy', () => {
  const codes = ['SESSION_NOT_FOUND', 'SESSION_COMPLETED', 'SESSION_EXPIRED', 'ITEM_OUT_OF_ORDER', 'ATTEMPTS_EXHAUSTED', 'HINT_OUT_OF_ORDER', 'HINTS_DISABLED_IN_EXAM',
    'ANSWER_KIND_MISMATCH', 'ANSWER_INVALID', 'NO_QUESTIONS_AVAILABLE', 'PRACTICE_UNAVAILABLE', 'DAILY_PRACTICE_LIMIT', 'MATERIAL_NOT_READY', 'REGRADE_LIMIT']
  it.each(codes)('%s has its own safe text and never echoes the server message', code => {
    const message = learnErrorMessage(409, code, { code, message: 'secret internal text: select * from answers' })
    expect(message).not.toContain('secret')
    expect(message.length).toBeGreaterThan(10)
    expect(message).not.toBe(learnErrorMessage(409, undefined))
  })
  // Every code in the platform's PRACTICE_ERRORS and SESSION_ERRORS maps (practice-contracts.ts, practice-sessions.contracts.ts).
  const platformCodes = ['CHILD_PROFILE_REQUIRED', 'AGE_OUT_OF_SCOPE', 'CONSENT_REQUIRED', 'PRACTICE_ACCESS_CHANGED', 'PRACTICE_UNAVAILABLE', 'SET_NOT_READY', 'NO_QUESTIONS_AVAILABLE',
    'EXAM_NOT_AVAILABLE', 'SESSION_NOT_FOUND', 'SET_NOT_FOUND', 'TOPIC_NOT_FOUND', 'ITEM_NOT_FOUND', 'SESSION_COMPLETED', 'SESSION_EXPIRED', 'SESSION_NOT_COMPLETED', 'SESSION_CONFLICT',
    'ITEM_OUT_OF_ORDER', 'ITEM_CLOSED', 'ATTEMPTS_EXHAUSTED', 'ATTEMPT_PENDING', 'ATTEMPT_CONFLICT', 'HINT_OUT_OF_ORDER', 'HINT_UNAVAILABLE', 'HINTS_DISABLED_IN_EXAM', 'SKIP_DISABLED_IN_EXAM',
    'ANSWER_KIND_MISMATCH', 'ANSWER_INVALID', 'MATERIAL_NOT_READY', 'LESSON_NOT_READY', 'NOT_RETRYABLE', 'NOT_CANCELLABLE', 'NOT_REGRADABLE', 'DAILY_PRACTICE_SET_LIMIT']
  it.each(platformCodes)('the platform code %s has its own safe copy', code => {
    const message = learnErrorMessage(409, code, { code, message: 'secret internal text' })
    expect(message).not.toContain('secret')
    for (const status of [400, 403, 404, 409, 429]) expect(message, code).not.toBe(learnErrorMessage(status, undefined))
  })
  it('answers 410 with its own line and keeps the 503 line', () => {
    expect(learnErrorMessage(410, undefined)).toBe('This is no longer available.')
    expect(learnErrorMessage(503, undefined)).toMatch(/unavailable right now/)
  })
  it('keeps POLICY_BLOCKED as the only server-text exception', () => {
    expect(learnErrorMessage(403, 'POLICY_BLOCKED', { message: 'Practice is paused until tomorrow.' })).toBe('Practice is paused until tomorrow.')
    expect(learnErrorMessage(403, 'SESSION_EXPIRED', { message: 'Practice is paused until tomorrow.' })).not.toContain('paused')
  })
  it('describes failed sets without raw codes and reads the message off an error', () => {
    expect(practiceFailureText({ code: 'insufficient_source' })).toMatch(/not enough/)
    expect(practiceFailureText({ code: 'weird_internal' })).toBe('Co could not finish these questions. You can try again.')
    expect(practiceFailureText(null)).toMatch(/try again/)
    expect(practiceErrorMessage(new Error('Shown'))).toBe('Shown')
    expect(practiceErrorMessage(null)).toMatch(/unavailable/)
  })
})
