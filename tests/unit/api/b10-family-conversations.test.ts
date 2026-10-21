import { describe, expect, it } from 'vitest'
import {
  familyConversationsPath, flagCount, parseFamilyConversations, parseFamilyConversationsFor, safetyClassificationLabel, turnHasSafetyMarker, turnKey,
} from '@/lib/api/family-conversations'
import { emptyConversations, safetyChat, teenGranted, teenSummaries, under14FirstPage } from '@/components/family/dev/conversation-fixtures'

function nth<T>(list: T[], index: number): T {
  const value = list[index]
  if (value === undefined) throw new Error(`missing item ${index}`)
  return value
}
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

describe('B10 family conversations schema', () => {
  it('accepts an under-14 FULL response with transcripts, alerts and a cursor', () => {
    const parsed = parseFamilyConversations(clone(under14FirstPage))
    expect(parsed.access).toBe('FULL')
    expect(parsed.items).toHaveLength(3)
    expect(parsed.nextCursor).toBe('cursor-2')
    expect(nth(parsed.safetyAlerts, 0).conversationId).toBe('conv-safety')
  })
  it('accepts teen SUMMARIES, a granted FULL teen response and the compatibility reason with an empty list', () => {
    expect(parseFamilyConversations(clone(teenSummaries)).items).toHaveLength(3)
    expect(parseFamilyConversations(clone(teenGranted)).access).toBe('FULL')
    expect(parseFamilyConversations(emptyConversations('FULL')).items).toEqual([])
    expect(parseFamilyConversations({ ...emptyConversations('SUMMARIES'), reason: undefined }).items).toEqual([])
  })
  it('rejects text carried by any SUMMARIES item (turns, text, preview) so a teen parent never renders message content', () => {
    for (const extra of [{ turns: [] }, { turns: [{ ordinal: 1, role: 'learner', text: 'private', disposition: null, beyondMaterial: false }] }, { text: 'private' }, { preview: 'private' }, { lastMessage: 'private' }, { summary: 'private' }]) {
      const value = clone(teenSummaries)
      Object.assign(nth(value.items, 0), extra)
      expect(() => parseFamilyConversations(value), JSON.stringify(Object.keys(extra))).toThrow(/unexpected response/)
    }
  })
  it('rejects a safety alert carrying text and unknown envelope keys', () => {
    const alert = clone(teenSummaries)
    Object.assign(nth(alert.safetyAlerts, 0), { text: 'private' })
    expect(() => parseFamilyConversations(alert)).toThrow()
    expect(() => parseFamilyConversations({ ...clone(teenSummaries), extra: true })).toThrow()
    expect(() => parseFamilyConversations({ ...clone(under14FirstPage), items: [{ ...clone(safetyChat), debug: 1 }] })).toThrow()
  })
  it('rejects a mixed or mislabelled access value, bad dates, bad enums and a missing cursor', () => {
    expect(() => parseFamilyConversations({ ...clone(teenSummaries), access: 'FULL' })).toThrow()
    expect(() => parseFamilyConversations({ ...clone(under14FirstPage), access: 'SUMMARIES' })).toThrow()
    expect(() => parseFamilyConversations({ ...clone(under14FirstPage), access: 'NONE' })).toThrow()
    const date = clone(under14FirstPage); nth(date.items, 0).startedAt = 'yesterday'
    expect(() => parseFamilyConversations(date)).toThrow()
    const kind = clone(under14FirstPage); Object.assign(nth(kind.items, 0), { kind: 'VOICE' })
    expect(() => parseFamilyConversations(kind)).toThrow()
    const role = clone(under14FirstPage); Object.assign(nth(nth(role.items, 0).turns, 0), { role: 'system' })
    expect(() => parseFamilyConversations(role)).toThrow()
    const withoutCursor: Record<string, unknown> = clone(under14FirstPage)
    delete withoutCursor.nextCursor
    expect(() => parseFamilyConversations(withoutCursor)).toThrow()
    expect(() => parseFamilyConversations(null)).toThrow()
    expect(() => parseFamilyConversations({ id: 'saved', message: 'Saved' })).toThrow()
  })
  it('requires a safety flag count on summaries but not text-free homework fields', () => {
    const value = clone(teenSummaries)
    delete (nth(value.items, 0) as { safetyFlagCount?: number }).safetyFlagCount
    expect(() => parseFamilyConversations(value)).toThrow()
    const homework = clone(teenSummaries)
    Object.assign(nth(homework.items, 1).homework ?? {}, { problem: 'private problem text' })
    expect(() => parseFamilyConversations(homework)).toThrow()
  })
  it('never lets a 14-17 profile without a grant receive transcripts, even from a well-formed FULL response', () => {
    expect(() => parseFamilyConversationsFor(clone(teenGranted), { teen: true, granted: false })).toThrow(/unexpected response/)
    expect(parseFamilyConversationsFor(clone(teenGranted), { teen: true, granted: true }).access).toBe('FULL')
    expect(parseFamilyConversationsFor(clone(teenSummaries), { teen: true, granted: false }).access).toBe('SUMMARIES')
    expect(parseFamilyConversationsFor(clone(under14FirstPage), { teen: false, granted: false }).access).toBe('FULL')
  })
  it('builds the request path with an encoded profile, cursor, limit and grant', () => {
    expect(familyConversationsPath('profile/a')).toBe('/family/profiles/profile%2Fa/conversations?limit=20')
    expect(familyConversationsPath('p', { cursor: 'c 2', safetyGrantId: 'g-1', limit: 5 })).toBe('/family/profiles/p/conversations?safetyGrantId=g-1&cursor=c+2&limit=5')
  })
  it('derives labels and flag counts without inventing any', () => {
    expect(safetyClassificationLabel('distress')).toBe('Possible distress')
    expect(safetyClassificationLabel('something_new')).toBe('Safety check')
    expect(turnHasSafetyMarker(nth(safetyChat.turns, 1))).toBe(true)
    expect(turnHasSafetyMarker(nth(nth(under14FirstPage.items, 0).turns, 1))).toBe(false)
    expect(flagCount(safetyChat)).toBe(1)
    expect(flagCount(nth(under14FirstPage.items, 0))).toBe(0)
    expect(flagCount(nth(teenSummaries.items, 2))).toBe(2)
  })
})

describe('pre-B10 platform compatibility', () => {
  it('still reads the old empty response (no safetyAlerts) as an honest empty list', () => {
    const parsed = parseFamilyConversations({ profileId: 'p', access: 'SUMMARIES', items: [], reason: 'NO_SCHOOL_SCOPED_CONVERSATIONS', nextCursor: null })
    expect(parsed.items).toEqual([])
    expect(parsed.safetyAlerts).toEqual([])
  })
})

describe('the exact shape colearner-platform sends (family-conversations.ts transcriptEntries / summaryItem / safetyAlert)', () => {
  const learner = { ordinal: 1, role: 'learner', text: 'What do roots do?', disposition: null, beyondMaterial: null, safety: null, status: 'READY' }
  const co = { ordinal: 1, role: 'co', text: 'Roots take in water.', disposition: 'LEARNING', beyondMaterial: false, safety: { redirected: false, reasonCodes: [] } }
  const failed = { ordinal: 2, role: 'learner', text: 'And the stem?', disposition: null, beyondMaterial: null, safety: null, status: 'FAILED' }
  const full = {
    profileId: '60000000-0000-4000-8000-000000000004', access: 'FULL', reason: null, nextCursor: null,
    items: [{ id: '60000000-0000-4000-8000-000000000010', kind: 'CHAT', title: 'Ask Co about a lesson', startedAt: '2026-10-21T09:00:00.000Z', turnCount: 2, safetyFlagCount: 0, turns: [learner, co, failed], truncated: false }],
    safetyAlerts: [{ id: '60000000-0000-4000-8000-000000000011', createdAt: '2026-10-21T09:05:00.000Z', classification: 'DISTRESS', reasonCodes: ['DISTRESS'], conversationId: '60000000-0000-4000-8000-000000000010' }],
  }
  it('reads a learner entry (null beyondMaterial, a status) and a Co entry of the same turn, plus the truncated flag and an upper-case alert', () => {
    const parsed = parseFamilyConversations(clone(full))
    expect(parsed.access).toBe('FULL')
    expect(parsed.items).toHaveLength(1)
    expect(safetyClassificationLabel(nth(parsed.safetyAlerts, 0).classification)).toBe('Possible distress')
    expect(safetyClassificationLabel('CONTENT_RISK')).toBe('Unsafe content')
    expect(safetyClassificationLabel('HUMAN_REVIEW')).toBe('Needs a person to review')
  })
  it('gives the learner entry and the Co entry of one turn different React keys', () => {
    expect(turnKey({ ordinal: 1, role: 'learner' })).not.toBe(turnKey({ ordinal: 1, role: 'co' }))
  })
  it('reads a SUMMARIES page with the compatibility reason and a homework summary, and still refuses text', () => {
    const summaries = { profileId: full.profileId, access: 'SUMMARIES', reason: null, nextCursor: 'abc_-', safetyAlerts: [],
      items: [{ id: '60000000-0000-4000-8000-000000000012', kind: 'HOMEWORK', title: 'Homework help', startedAt: '2026-10-21T09:00:00.000Z', turnCount: 4, homework: { phase: 'STEPS', hintsUsed: 1 }, safetyFlagCount: 0 }] }
    expect(parseFamilyConversationsFor(clone(summaries), { teen: true, granted: false }).items).toHaveLength(1)
    expect(() => parseFamilyConversations({ ...clone(summaries), items: [{ ...summaries.items[0], truncated: false }] })).toThrow()
  })
  it('does not blank the page for a safety reason code it does not know', () => {
    const value = clone(full)
    Object.assign(nth(value.safetyAlerts, 0), { reasonCodes: ['SOMETHING_NEW'] })
    expect(parseFamilyConversations(value).safetyAlerts).toHaveLength(1)
  })
})
