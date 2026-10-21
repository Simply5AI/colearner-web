import { describe, expect, it, vi } from 'vitest'
import { LearnApiError } from '@/lib/api/learn-request'
import { TurnSender, sendStorageKey, type PendingSend, type SendStorage } from '@/components/co/turn-sender'
import { turnFixture } from '@/components/co/dev/co-fixtures'
import type { CoTurnBody, CoTurnView } from '@/components/co/co-types'

const memory = (): SendStorage & { data: Map<string, PendingSend> } => {
  const data = new Map<string, PendingSend>()
  return { data, get: key => data.get(key) ?? null, set: (key, value) => { data.set(key, value) }, remove: key => { data.delete(key) } }
}
const turn = (body: CoTurnBody): CoTurnView => turnFixture({ id: 'turn-1', ordinal: 1, learnerText: body.text, clientTurnId: body.clientTurnId, status: 'QUEUED' })
const server = (script: (call: number, body: CoTurnBody) => 'ok' | 'lost' | Error) => {
  const bodies: CoTurnBody[] = []
  const conversationId = vi.fn(async () => 'conversation-1')
  const send = vi.fn(async (_id: string, body: CoTurnBody) => {
    bodies.push(body)
    const result = script(bodies.length, body)
    if (result === 'ok') return turn(body)
    throw result === 'lost' ? new LearnApiError(503, 'unavailable') : result
  })
  return { bodies, ports: { conversationId, send }, conversationId, send }
}
let ids = 0
const newId = () => `client-turn-${++ids}-aaaaaaaa`
const options = (storage?: SendStorage) => ({ key: sendStorageKey('lesson:l1'), storage, newId })

describe('B10 never double-sends a message', () => {
  it('uses one clientTurnId per message and reuses it, with the same text, when the first answer is lost', async () => {
    const api = server(call => call === 1 ? 'lost' : 'ok')
    const sender = new TurnSender(api.ports, options())
    const first = await sender.send('  What do roots do?  ', 'SIMPLE', 1)
    expect(first.status).toBe('unconfirmed')
    expect(sender.unconfirmed).toMatchObject({ text: 'What do roots do?', style: 'SIMPLE', stepIndex: 1 })
    // Even if the learner changed their mind in the field, the resend carries the original message.
    const second = await sender.send('Something else entirely', null, null)
    expect(second.status).toBe('accepted')
    expect(api.bodies).toHaveLength(2)
    expect(api.bodies[1]).toEqual(api.bodies[0])
    expect(api.bodies[0]).toEqual({ clientTurnId: expect.any(String), text: 'What do roots do?', style: 'SIMPLE', stepIndex: 1 })
    expect(sender.unconfirmed).toBeNull()
  })
  it('resend() sends the stored message again without a new id', async () => {
    const api = server(call => call < 3 ? 'lost' : 'ok')
    const sender = new TurnSender(api.ports, options())
    await sender.send('Hello', null, null)
    await sender.resend()
    const done = await sender.resend()
    expect(done.status).toBe('accepted')
    expect(new Set(api.bodies.map(body => body.clientTurnId)).size).toBe(1)
  })
  it('starts a NEW id only after the server took the message or definitely refused it', async () => {
    const api = server(call => call === 2 ? new LearnApiError(400, 'bad', 'MESSAGE_INVALID') : 'ok')
    const sender = new TurnSender(api.ports, options())
    await sender.send('One', null, null)
    const refused = await sender.send('Two', null, null)
    expect(refused.status).toBe('refused')
    expect(sender.unconfirmed).toBeNull()
    await sender.send('Two', null, null)
    expect(new Set(api.bodies.map(body => body.clientTurnId)).size).toBe(3)
  })
  it('sends nothing while a send is in flight, and nothing for an empty message', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>(resolve => { release = resolve })
    const slow = { conversationId: async () => 'c1', send: vi.fn(async (_id: string, body: CoTurnBody) => { await gate; return turn(body) }) }
    const sender = new TurnSender(slow, options())
    const pending = sender.send('Hi', null, null)
    expect((await sender.send('Hi again', null, null)).status).toBe('busy')
    expect((await sender.resend()).status).toBe('busy')
    release?.()
    await pending
    expect(slow.send).toHaveBeenCalledTimes(1)
    expect((await new TurnSender(slow, options()).send('   ', null, null)).status).toBe('refused')
    expect(slow.send).toHaveBeenCalledTimes(1)
  })
  it('keeps an unconfirmed message across a page refresh and sends it with the same id', async () => {
    const storage = memory()
    const first = server(() => 'lost')
    await new TurnSender(first.ports, options(storage)).send('Why is the sky blue?', 'EXAM', null)
    expect(storage.data.get(sendStorageKey('lesson:l1'))).toMatchObject({ text: 'Why is the sky blue?', style: 'EXAM' })
    const reloaded = server(() => 'ok')
    const sender = new TurnSender(reloaded.ports, options(storage))
    expect(sender.restore()).toMatchObject({ text: 'Why is the sky blue?' })
    const outcome = await sender.resend()
    expect(outcome.status).toBe('accepted')
    expect(reloaded.bodies[0]!.clientTurnId).toBe(first.bodies[0]!.clientTurnId)
    expect(storage.data.size).toBe(0)
  })
  it('treats a failed conversation lookup like a failed send: the message and its id are kept', async () => {
    let calls = 0
    const send = vi.fn(async (_id: string, body: CoTurnBody) => turn(body))
    const sender = new TurnSender({ conversationId: async () => { calls += 1; if (calls === 1) throw new LearnApiError(503, 'down'); return 'c1' }, send }, options())
    expect((await sender.send('Hello', null, null)).status).toBe('unconfirmed')
    expect(send).not.toHaveBeenCalled()
    expect((await sender.resend()).status).toBe('accepted')
    expect(send).toHaveBeenCalledTimes(1)
  })
  it('drops stored values that are not a message', () => {
    const storage: SendStorage = { get: () => null, set: () => undefined, remove: () => undefined }
    expect(new TurnSender(server(() => 'ok').ports, options(storage)).restore()).toBeNull()
  })
})
