import { afterEach, describe, expect, it, vi } from 'vitest'
import { coPollDelay, coApi } from '@/components/co/co-client'
import { coReplySchema, coTurnViewSchema, pollDelay } from '@/lib/api/co'
import { createCoMock } from '@/components/co/dev/co-mock'
import { coBands, fixtureConversationId, fixtureLessonId, sourcedReply } from '@/components/co/dev/co-fixtures'
import { LearnApiError } from '@/lib/api/learn-request'

afterEach(() => vi.unstubAllGlobals())
const stub = (options: Parameters<typeof createCoMock>[0]) => {
  const server = createCoMock(options)
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => server.fetch(input, init)))
  return server
}
const lesson = { kind: 'LESSON' as const, lessonId: fixtureLessonId, stepIndex: 2 }

describe('B10 polling backoff', () => {
  it('is 800 ms, 1.2 s, 1.6 s, 2 s and capped at 4 s', () => {
    expect([0, 1, 2, 3, 4, 8, 20].map(attempt => coPollDelay(attempt))).toEqual([800, 1200, 1600, 2000, 2400, 4000, 4000])
    expect([0, 1, 2, 3].map(pollDelay)).toEqual([800, 1200, 1600, 2000])
  })
  it('scales for tests without changing the shape', () => {
    expect([0, 1, 2, 30].map(attempt => coPollDelay(attempt, 20))).toEqual([20, 30, 40, 100])
  })
})

describe('Ask Co schemas refuse what must never be shown', () => {
  const reply = sourcedReply('teens')
  it('accepts a contract reply', () => { expect(coReplySchema.safeParse(reply).success).toBe(true) })
  it('refuses a beyond-material note without the flag', () => {
    expect(coReplySchema.safeParse({ ...reply, beyondMaterial: false, beyondNote: 'Sneaky.' }).success).toBe(false)
    expect(coReplySchema.safeParse({ ...reply, beyondMaterial: true, beyondNote: 'Honest.' }).success).toBe(true)
  })
  it('refuses a partial reply on an unfinished turn and a missing reply on a finished one', () => {
    const turn = { id: 't', ordinal: 1, clientTurnId: 'client-0001', learnerText: 'Q', createdAt: '2026-10-21T09:00:00Z', failure: null, kind: 'CHAT' }
    expect(coTurnViewSchema.safeParse({ ...turn, status: 'RUNNING', reply }).success).toBe(false)
    expect(coTurnViewSchema.safeParse({ ...turn, status: 'QUEUED', reply: null }).success).toBe(true)
    expect(coTurnViewSchema.safeParse({ ...turn, status: 'READY', reply: null }).success).toBe(false)
  })
  it('refuses a reply that carries an answer-key-like field', () => {
    expect(coReplySchema.safeParse({ ...reply, answerKey: 'x' }).success).toBe(false)
    expect(coReplySchema.safeParse({ ...reply, unknownField: 1 }).success).toBe(false)
  })
  it('refuses more than three suggestions', () => {
    expect(coReplySchema.safeParse({ ...reply, suggestions: ['a', 'b', 'c', 'd'] }).success).toBe(false)
  })
})

describe('the contract-faithful mock and client', () => {
  it.each(coBands)('runs a turn QUEUED, RUNNING, READY for the %s band with no partial text', async band => {
    const server = stub({ band })
    const context = await coApi.context(lesson)
    expect(context).toMatchObject({ available: true, voice: { available: false }, hintsMax: 3 })
    expect(server.calls[0]!.path).toBe(`/co/context?lessonId=${fixtureLessonId}&stepIndex=2`)
    const { id } = await coApi.conversation(lesson)
    const queued = await coApi.send(id, { clientTurnId: 'client-turn-0001', text: 'What do roots do?' })
    expect(queued).toMatchObject({ status: 'QUEUED', reply: null })
    const running = await coApi.turn(id, queued.id)
    expect(running).toMatchObject({ status: 'RUNNING', reply: null })
    const ready = await coApi.turn(id, queued.id)
    expect(ready.status).toBe('READY')
    expect(ready.reply?.sources.length).toBeGreaterThan(0)
  })
  it('is idempotent by clientTurnId: the same body is the same turn, a different body is a 409', async () => {
    const server = stub({ band: 'tweens' })
    const { id } = await coApi.conversation(lesson)
    const body = { clientTurnId: 'client-turn-0002', text: 'Why?' }
    const one = await coApi.send(id, body)
    const two = await coApi.send(id, body)
    expect(two.id).toBe(one.id)
    expect(server.created).toBe(1)
    await expect(coApi.send(id, { ...body, text: 'Something else' })).rejects.toMatchObject({ status: 409, code: 'TURN_CONFLICT' })
  })
  it('allows one pending turn per conversation', async () => {
    stub({ band: 'tweens' })
    const { id } = await coApi.conversation(lesson)
    await coApi.send(id, { clientTurnId: 'client-turn-0003', text: 'First' })
    await expect(coApi.send(id, { clientTurnId: 'client-turn-0004', text: 'Second' })).rejects.toMatchObject({ status: 409, code: 'TURN_PENDING' })
  })
  it('answers a risky message at once with a code-owned reply and no model', async () => {
    stub({ band: 'kids' })
    const { id } = await coApi.conversation(lesson)
    const turn = await coApi.send(id, { clientTurnId: 'client-turn-0005', text: 'I want to hurt myself' })
    expect(turn.status).toBe('READY')
    expect(turn.reply).toMatchObject({ disposition: 'TRUSTED_ADULT', generatedBy: { kind: 'CODE' }, safety: { redirected: true } })
  })
  it('limits a message by band', async () => {
    stub({ band: 'kids' })
    const { id } = await coApi.conversation(lesson)
    await expect(coApi.send(id, { clientTurnId: 'client-turn-0006', text: 'x'.repeat(301) })).rejects.toMatchObject({ code: 'MESSAGE_INVALID' })
    await expect(coApi.send(id, { clientTurnId: 'client-turn-0007', text: 'x'.repeat(300) })).resolves.toMatchObject({ status: 'QUEUED' })
  })
  it('retries a failed turn as a NEW turn (202 with the new turn), idempotently, and hides the failed one from the transcript', async () => {
    const server = stub({ band: 'teens' })
    const { id } = await coApi.conversation(lesson)
    const queued = await coApi.send(id, { clientTurnId: 'client-turn-0008', text: 'please fail' })
    expect((await coApi.turn(id, queued.id)).status).toBe('FAILED')
    const retried = await coApi.retry(id, queued.id)
    expect(retried.id).not.toBe(queued.id)
    expect(retried).toMatchObject({ status: 'QUEUED', learnerText: 'please fail', reply: null })
    expect((await coApi.retry(id, queued.id)).id).toBe(retried.id)
    expect(server.created).toBe(1)
    const detail = await coApi.history(id)
    expect(detail.turns.map(turn => turn.id)).not.toContain(queued.id)
    expect(detail.pending?.id).toBe(retried.id)
    // The failed turn is still readable on its own (the poll of an old id), and stays FAILED.
    expect((await coApi.turn(id, queued.id)).status).toBe('FAILED')
  })
  it('cancel answers with the CANCELLED turn', async () => {
    stub({ band: 'tweens' })
    const { id } = await coApi.conversation(lesson)
    const queued = await coApi.send(id, { clientTurnId: 'client-turn-0009', text: 'stop this forever' })
    expect(queued.status).toBe('QUEUED')
    expect(await coApi.cancel(id, queued.id)).toMatchObject({ id: queued.id, status: 'CANCELLED', reply: null })
  })
  it('surfaces a policy refusal as a typed error', async () => {
    stub({ band: 'kids', startError: 'CO_DISABLED_BY_POLICY' })
    await expect(coApi.conversation(lesson)).rejects.toBeInstanceOf(LearnApiError)
    await expect(coApi.conversation(lesson)).rejects.toMatchObject({ code: 'CO_DISABLED_BY_POLICY' })
  })
  it('opens the open conversation after the first message', async () => {
    stub({ band: 'tweens' })
    expect((await coApi.context({ kind: 'MATERIAL', materialId: 'material-fixture' })).openConversationId).toBeNull()
    await coApi.conversation(lesson)
    expect((await coApi.context({ kind: 'MATERIAL', materialId: 'material-fixture' })).openConversationId).toBe(fixtureConversationId)
  })
})
