import { describe, expect, it, vi } from 'vitest'
import { createTeachFixtureFlow, detail, progress, turn } from '@/components/teach-back/dev/b11-fixtures'
import { teachDetailSchema, teachPollDelay } from '@/lib/api/teach-back'
import { progressSchema, isProgressCsv } from '@/lib/api/learn-progress'
import { TeachSender, type TeachPending } from '@/components/teach-back/teach-sender'
import { mergeTeachTurns } from '@/components/teach-back/teach-model'
import { LearnApiError } from '@/lib/api/learn-request'

describe('B11 contracts', () => {
  it.each(['kids', 'tweens', 'teens'] as const)('accepts school %s fixtures', band => {
    expect(teachDetailSchema.safeParse(detail(band)).success).toBe(true)
    expect(progressSchema.safeParse(progress(band)).success).toBe(true)
  })
  it('rejects kid numbers, model percentages and failure counts, but preserves learner text', () => {
    const child = progress('kids')
    expect(progressSchema.safeParse({ ...child, subjects: [{ ...child.subjects[0], readiness: 50 }] }).success).toBe(false)
    expect(progressSchema.safeParse({ ...child, focusNext: { kind: 'UNAVAILABLE', reason: '50% ready' } }).success).toBe(false)
    const teach = detail('kids')
    teach.turns[0]!.learnerText = 'I think 50% means half'
    expect(teachDetailSchema.safeParse(teach).success).toBe(true)
    teach.turns[0]!.reply!.text = 'You had 3 failures'
    expect(teachDetailSchema.safeParse(teach).success).toBe(false)
  })
  it('rejects partial pending text and feedback without saved evidence', () => {
    const pending = detail('teens', 'pending')
    pending.pending!.reply = turn().reply
    expect(teachDetailSchema.safeParse(pending).success).toBe(false)
    expect(teachDetailSchema.safeParse({ ...detail('teens'), result: null }).success).toBe(false)
  })
  it('requires sample evidence for readiness and forbids tween exports', () => {
    const teen = progress('teens', 'insufficient')
    teen.subjects[0]!.readiness = 70
    expect(progressSchema.safeParse(teen).success).toBe(false)
    expect(progressSchema.safeParse({ ...progress('tweens'), export: { available: true, reason: null } }).success).toBe(false)
  })
  it('polls at the specified backoff and ignores stale nonterminal snapshots', () => {
    expect([0, 1, 2, 50].map(n => teachPollDelay(n))).toEqual([800, 1200, 1600, 4000])
    expect(mergeTeachTurns([turn()], [turn('RUNNING')])[0]!.status).toBe('READY')
  })
  it('validates CSV header before download', () => {
    expect(isProgressCsv('subject,concept,mastery,evidence,attempts,successRate\n')).toBe(true)
    expect(isProgressCsv('<html>Sign in</html>')).toBe(false)
  })
})

describe('B11 idempotent sends', () => {
  it('restores an ambiguous request and reuses its exact text and id across a remount', async () => {
    const values = new Map<string, TeachPending>()
    const storage = { get: (key: string) => values.get(key) ?? null, set: (key: string, value: TeachPending) => { values.set(key, value) }, remove: (key: string) => { values.delete(key) } }
    const post = vi.fn().mockRejectedValueOnce(new LearnApiError(503, 'lost response')).mockResolvedValue(turn('QUEUED'))
    const first = new TeachSender(post, { key: 'actor:session', storage, newId: () => 'same-client-id' })
    expect((await first.send('My explanation')).status).toBe('unconfirmed')
    const second = new TeachSender(post, { key: 'actor:session', storage })
    expect(second.restore()?.text).toBe('My explanation')
    expect((await second.resend()).status).toBe('accepted')
    expect(post.mock.calls[0]).toEqual(post.mock.calls[1])
    expect(values.size).toBe(0)
  })
  it('locks a double press and releases ids after a definite refusal', async () => {
    let reject!: (error: Error) => void
    const post = vi.fn(() => new Promise<never>((_, no) => { reject = no }))
    const sender = new TeachSender(post, { key: 'session' })
    const request = sender.send('My explanation')
    expect((await sender.send('another')).status).toBe('busy')
    reject(new LearnApiError(400, 'Invalid'))
    expect((await request).status).toBe('refused')
    expect(sender.unconfirmed).toBeNull()
  })
})

it('harness follow-up preserves EXPLAIN and completes its own second turn without terminal regression', () => {
  const flow = createTeachFixtureFlow('tweens', 'follow-up')
  const explain = flow.snapshot().turns[0]!
  const pending = flow.submit('Cooling makes droplets.')
  expect(pending).toMatchObject({ ordinal: 2, kind: 'FOLLOW_UP', status: 'RUNNING' })
  expect(pending.id).not.toBe(explain.id)
  expect(pending.clientTurnId).not.toBe(explain.clientTurnId)
  expect(mergeTeachTurns([explain], [pending])).toHaveLength(2)
  expect(flow.poll().status).toBe('RUNNING')
  expect(flow.poll().status).toBe('RUNNING')
  const ready = flow.poll()
  expect(ready).toMatchObject({ id: pending.id, ordinal: 2, kind: 'FOLLOW_UP', status: 'READY' })
  expect(teachDetailSchema.parse(flow.snapshot()).session.phase).toBe('FEEDBACK')
  expect(flow.snapshot().turns.map(item => item.id)).toEqual([explain.id, pending.id])
  expect(mergeTeachTurns([explain, pending], [ready]).every(item => item.status === 'READY')).toBe(true)
})

it('refuses a Taught it label for a partial rubric', () => {
  const partial = detail('teens')
  partial.result!.effortLabel = 'TAUGHT_IT'
  expect(teachDetailSchema.safeParse(partial).success).toBe(false)
  expect(detail('kids').result!.missing).toEqual([])
  expect(detail('tweens').result!.missing).toEqual([])
  expect(detail('teens').result!.effortLabel).toBeNull()
})
