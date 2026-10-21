import { describe, expect, it, vi } from 'vitest'
import { LearnApiError } from '@/lib/api/learn-request'
import { SubmissionController, newAttemptId, type Submission, type SubmissionStorage } from '@/components/practice/session/submission'
import { isUnconfirmed } from '@/components/practice/session/session-model'
import type { AnswerBody, AnswerReceipt, PracticeAnswer } from '@/components/practice/session/practice-types'

const answer: PracticeAnswer = { kind: 'MCQ', optionId: 'a' }
const receipt = (replay = false): AnswerReceipt => ({ attempt: { id: 'att', attemptNo: 1, status: 'GRADED' }, result: null, canRetry: false, attemptsLeft: 0, isLastItem: false, replay })
const memory = (): SubmissionStorage & { data: Map<string, Submission> } => {
  const data = new Map<string, Submission>()
  return { data, get: key => data.get(key) ?? null, set: (key, value) => { data.set(key, value) }, remove: key => { data.delete(key) } }
}
const controller = (send: (body: AnswerBody) => Promise<AnswerReceipt>, storage?: SubmissionStorage, ids = ['id-1', 'id-2', 'id-3']) => {
  const queue = [...ids]
  return new SubmissionController(send, { key: 'k', attemptNo: 1, storage, newId: () => queue.shift() ?? 'id-x' })
}

describe('F-L10-08 idempotent submission: the clientAttemptId is reused on re-send', () => {
  it('sends one id, clears on a receipt and gives the next submission a new id', async () => {
    const sent: AnswerBody[] = []
    const c = controller(async body => { sent.push(body); return receipt() })
    const first = await c.submit(answer, 1200)
    expect(first.status).toBe('receipt')
    expect(sent).toHaveLength(1)
    expect(sent[0]).toEqual({ clientAttemptId: 'id-1', answer, timeSpentMs: 1200 })
    expect(c.unconfirmed).toBeNull()
    await c.submit({ kind: 'MCQ', optionId: 'b' }, 900)
    expect(sent[1]!.clientAttemptId).toBe('id-2')
  })
  it('an unknown outcome (503 / network) keeps the SAME id and answer for the re-send', async () => {
    const sent: AnswerBody[] = []
    let calls = 0
    const c = controller(async body => { sent.push(body); calls += 1; if (calls < 3) throw new LearnApiError(503, 'unavailable'); return receipt(true) })
    expect((await c.submit(answer, 500)).status).toBe('unconfirmed')
    expect((await c.resend()).status).toBe('unconfirmed')
    const done = await c.resend()
    expect(done.status).toBe('receipt')
    expect(new Set(sent.map(body => body.clientAttemptId))).toEqual(new Set(['id-1']))
    expect(sent.map(body => JSON.stringify(body.answer))).toEqual(Array(3).fill(JSON.stringify(answer)))
    expect(sent.map(body => body.timeSpentMs)).toEqual([500, 500, 500])
  })
  it('a changed answer cannot ride on an unconfirmed id: the original is re-sent', async () => {
    const sent: AnswerBody[] = []
    let calls = 0
    const c = controller(async body => { sent.push(body); calls += 1; if (calls === 1) throw new LearnApiError(503, 'x'); return receipt(true) })
    await c.submit(answer, 100)
    await c.submit({ kind: 'MCQ', optionId: 'zzz' }, 200)
    expect(sent[1]).toEqual(sent[0])
    expect(c.carries(answer)).toBe(false) // cleared after the receipt
  })
  it('a typed refusal (400/409) is definite: the id is dropped and the next submission is new', async () => {
    const sent: AnswerBody[] = []
    let calls = 0
    const c = controller(async body => { sent.push(body); calls += 1; if (calls === 1) throw new LearnApiError(400, 'bad', 'ANSWER_INVALID'); return receipt() })
    const refused = await c.submit(answer, 1)
    expect(refused.status).toBe('refused')
    expect(c.unconfirmed).toBeNull()
    await c.submit(answer, 1)
    expect(sent.map(body => body.clientAttemptId)).toEqual(['id-1', 'id-2'])
  })
  it('a double press while in flight sends nothing more', async () => {
    let release: (value: AnswerReceipt) => void = () => undefined
    const send = vi.fn(() => new Promise<AnswerReceipt>(resolve => { release = resolve }))
    const c = controller(send)
    const first = c.submit(answer, 1)
    expect(c.busy).toBe(true)
    expect(await c.submit(answer, 1)).toEqual({ status: 'busy' })
    expect(await c.resend()).toEqual({ status: 'busy' })
    release(receipt())
    await first
    expect(send).toHaveBeenCalledTimes(1)
  })
  it('stores the in-flight submission and restores it after a refresh, then forgets it', async () => {
    const storage = memory()
    const c1 = controller(async () => { throw new LearnApiError(503, 'x') }, storage)
    await c1.submit(answer, 321)
    expect(storage.data.get('k')).toMatchObject({ clientAttemptId: 'id-1', answer, timeSpentMs: 321 })
    const sent: AnswerBody[] = []
    const c2 = controller(async body => { sent.push(body); return receipt(true) }, storage)
    expect(c2.restore()).toMatchObject({ clientAttemptId: 'id-1' })
    await c2.resend()
    expect(sent[0]!.clientAttemptId).toBe('id-1')
    expect(storage.data.has('k')).toBe(false)
  })
  it('works without storage', async () => {
    const c = controller(async () => receipt())
    expect(c.restore()).toBeNull()
    expect((await c.submit(answer, 1)).status).toBe('receipt')
  })
  it('generates UUID-shaped ids', () => {
    expect(newAttemptId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(newAttemptId()).not.toBe(newAttemptId())
  })
})

describe('which failures leave the outcome unknown', () => {
  it.each([[503, true], [500, true], [502, true], [408, true], [429, true], [400, false], [403, false], [404, false], [409, false]])('status %i unconfirmed=%s', (status, expected) => {
    expect(isUnconfirmed(new LearnApiError(status, 'x'))).toBe(expected)
  })
  it('network failures are unknown; a client-side Zod refusal is not', () => {
    expect(isUnconfirmed(new TypeError('Failed to fetch'))).toBe(true)
    const zod = new Error('bad body'); zod.name = 'ZodError'
    expect(isUnconfirmed(zod)).toBe(false)
  })
})
