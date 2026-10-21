import { beforeEach, describe, expect, it } from 'vitest'
import { charsLeft, deriveView, hintButtonLabel, hintLabels, journeyIndex, parentNotice, parentNotices, problemLimit, responseLimit, safetyText } from '@/components/homework/homework-model'
import { forgetActionId, idKeys, resetActionIds, stableActionId, type IdStorage } from '@/components/homework/homework-ids'
import { safetyReply, reply } from '@/components/homework/dev/homework-fixtures'
import { createHomeworkMock } from '@/components/homework/dev/homework-mock'
import { homeworkDetailSchema, type HomeworkDetail } from '@/lib/api/co'

const detailOf = (seed: Parameters<typeof createHomeworkMock>[0]['seed'], extra: Partial<Parameters<typeof createHomeworkMock>[0]> = {}): HomeworkDetail => {
  const body = createHomeworkMock({ band: 'tweens', seed, ...extra }).handle('GET', '/api/learn/homework/sessions/hw-1', undefined).body as { data: unknown }
  return homeworkDetailSchema.parse(body.data)
}

describe('B10 band wording and limits', () => {
  it('uses the contract parent-visibility copy per band', () => {
    expect(parentNotices.kids).toBe('Your grown-up can see your homework help.')
    expect(parentNotices.tweens).toBe('Your parent can see your homework help sessions.')
    expect(parentNotices.teens).toBe('Your parent can see a summary of your homework help and any safety alerts.')
    expect(parentNotice('kids', 'FULL')).toBe(parentNotices.kids)
    expect(parentNotice('tweens', 'FULL')).toBe(parentNotices.tweens)
    expect(parentNotice('teens', 'SUMMARY')).toBe(parentNotices.teens)
    // The server snapshot wins over the band default.
    expect(parentNotice('tweens', 'SUMMARY')).toBe(parentNotices.teens)
    expect(parentNotice('teens', 'FULL')).not.toBe(parentNotices.teens)
    expect(parentNotice('teens', null)).toBe(parentNotices.teens)
    expect(parentNotice('kids', undefined)).toBe(parentNotices.kids)
  })
  it('limits the problem by band and labels the three rungs per band', () => {
    // Platform TEXT_LIMITS (homework-contracts.ts): problem 300/600/1000, step answer 300/500/1000.
    expect(problemLimit).toEqual({ kids: 300, tweens: 600, teens: 1000 })
    expect(responseLimit).toEqual({ kids: 300, tweens: 500, teens: 1000 })
    expect(hintLabels.kids).toEqual(['A little help', 'More help', 'Look at this'])
    expect(hintButtonLabel('kids', 0)).toBe('Need a hint?'); expect(hintButtonLabel('kids', 1)).toBe('More help'); expect(hintButtonLabel('kids', 2)).toBe('Look at this')
  })
  it('counts characters and says when the limit is close', () => {
    expect(charsLeft('abc', 300)).toEqual({ used: 3, left: 297, close: false })
    expect(charsLeft('x'.repeat(285), 300).close).toBe(true)
    expect(charsLeft('x'.repeat(190), 200).close).toBe(true)
  })
  it('maps phases to the four journey stops', () => {
    expect(['CAPTURE', 'RESTATE', 'STEPS', 'FINAL', 'CHECKED', 'DONE', 'ABANDONED'].map(phase => journeyIndex(phase as never))).toEqual([0, 1, 2, 3, 3, 3, -1])
  })
})

describe('B10 deriveView', () => {
  it('finds the current step, the earlier steps and the hint texts of this step', () => {
    const view = deriveView(detailOf('steps-hint2'))
    expect(view.step?.number).toBe(1); expect(view.pastSteps).toEqual([])
    expect(view.hints.map(hint => hint.level)).toEqual([1, 2])
    expect(view.hintNext).toEqual({ level: 3 })
    const second = deriveView(detailOf('steps-2'))
    expect(second.step?.number).toBe(2); expect(second.pastSteps.map(step => step.number)).toEqual([1]); expect(second.hints).toEqual([])
  })
  it('takes the hint texts from the served hints of the session state, only for the current step, in level order', () => {
    const detail = detailOf('steps-hint2')
    expect(deriveView(detail).hints.map(hint => hint.level)).toEqual([1, 2])
    const reordered: HomeworkDetail = { ...detail, hints: [{ level: 2, text: 'second', stepNumber: 1 }, { level: 1, text: 'first', stepNumber: 1 }, { level: 1, text: 'old step', stepNumber: 0 }] }
    expect(deriveView(reordered).hints.map(hint => hint.text)).toEqual(['first', 'second'])
    expect(deriveView({ ...detail, hints: [] }).hints).toEqual([])
  })
  it('asks for the next rung only, and says why when no rung is left', () => {
    expect(deriveView(detailOf('steps')).hintNext).toEqual({ level: 1 })
    expect(deriveView(detailOf('steps-hint3')).hintNext).toMatchObject({ level: null, reason: 'You have seen all three hints for this step.' })
    expect(deriveView(detailOf('steps-hint2', { hintsMax: 2 })).hintNext).toMatchObject({ level: null, reason: expect.stringContaining('your school allows') })
    expect(deriveView(detailOf('steps', { hintsMax: 0 })).hintNext).toMatchObject({ level: null, reason: 'Hints are switched off for your homework help.' })
  })
  it('reports pending, failed, safety and exhausted tries', () => {
    expect(deriveView(detailOf('restate-pending')).pending?.kind).toBe('HW_RESTATE')
    expect(deriveView(detailOf('failed')).failed?.failure).toEqual({ code: 'generation_failed', retryable: true })
    expect(deriveView(detailOf('failed-final')).failed?.failure?.retryable).toBe(false)
    expect(deriveView(detailOf('safety')).safety?.reply.disposition).toBe('SAFE_REDIRECT')
    expect(deriveView(detailOf('safety-trusted')).safety?.reply.disposition).toBe('TRUSTED_ADULT')
    expect(deriveView(detailOf('steps')).safety).toBeNull()
    expect(deriveView(detailOf('checked-exhausted')).finalTriesUsed).toBe(3)
    expect(deriveView(detailOf('checked-not-yet')).finalTriesUsed).toBe(1)
    expect(deriveView(detailOf('steps')).finalTriesUsed).toBe(0)
    expect(deriveView(detailOf('checked-not-yet')).verdict).toBe('not_yet')
  })
  it('lets a failed hint go without blocking the step', () => {
    const mock = createHomeworkMock({ band: 'tweens', seed: 'steps', failTurns: 1, failKind: 'HW_HINT' })
    mock.handle('POST', '/api/learn/homework/sessions/hw-1/hint', { clientTurnId: 'hint-turn-0001', level: 1 })
    for (let i = 0; i < 4; i++) mock.handle('GET', '/api/learn/homework/sessions/hw-1', undefined)
    const view = deriveView(homeworkDetailSchema.parse((mock.handle('GET', '/api/learn/homework/sessions/hw-1', undefined).body as { data: unknown }).data))
    expect(view.hintFailed).toBe(true); expect(view.failed).toBeNull(); expect(view.hintNext).toEqual({ level: 1 })
  })
  it('uses the code-owned guidance for a safety reply and never the model text', () => {
    const redirect = safetyReply('kids', 'SAFE_REDIRECT')
    expect(safetyText(redirect)).toBe(redirect.safety.guidance)
    expect(safetyText(reply('x', { disposition: 'SAFE_REDIRECT', safety: { redirected: true, reasonCodes: [], guidance: null } }))).toBe('x')
  })
})

describe('B10 stable client ids (idempotent retries)', () => {
  const makeStorage = (): IdStorage & { data: Map<string, string> } => {
    const data = new Map<string, string>()
    return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) }, removeItem: key => { data.delete(key) } }
  }
  beforeEach(() => resetActionIds())
  it('returns the same id for the same action and body, a new one for another body, and a fresh one after the server took it', () => {
    const storage = makeStorage()
    const a = stableActionId('s:step:1', 'add the tops', storage, 1000)
    expect(a).toMatch(/^[0-9a-f-]{36}$/)
    expect(stableActionId('s:step:1', 'add the tops', storage, 2000)).toBe(a)
    const b = stableActionId('s:step:1', 'a different text', storage, 3000)
    expect(b).not.toBe(a)
    forgetActionId('s:step:1', storage)
    expect(stableActionId('s:step:1', 'a different text', storage, 4000)).not.toBe(b)
  })
  it('keeps an id for 30 minutes only and keeps separate actions apart', () => {
    const storage = makeStorage()
    const a = stableActionId(idKeys.hint('s', 1), '', storage, 0)
    expect(stableActionId(idKeys.hint('s', 2), '', storage, 0)).not.toBe(a)
    expect(stableActionId(idKeys.hint('s', 1), '', storage, 29 * 60 * 1000)).toBe(a)
    expect(stableActionId(idKeys.hint('s', 1), '', storage, 31 * 60 * 1000)).not.toBe(a)
  })
  it('survives a remount through storage and falls back to memory when storage is blocked', () => {
    const storage = makeStorage()
    const a = stableActionId('s:final', '7/8', storage, 1)
    resetActionIds()
    expect(stableActionId('s:final', '7/8', storage, 2)).toBe(a)
    const broken: IdStorage = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } }
    const b = stableActionId('s:other', 'x', broken, 1)
    expect(stableActionId('s:other', 'x', broken, 2)).toBe(b)
    expect(() => forgetActionId('s:other', broken)).not.toThrow()
  })
})
