import { expect, it } from 'vitest'
import { teachContextSchema, teachDetailSchema } from '@/lib/api/teach-back'
import { progressSchema } from '@/lib/api/learn-progress'
import { linkHref } from '@/lib/api/learn'

// Samples transcribed from the B11 service presenters, rather than the UI harness.
// This checks the final wire boundary; no service, database or model is executed.
const session = { id: 'session-a', phase: 'FEEDBACK', status: 'CLOSED', band: '14-17', conceptTitle: 'Evaporation', keyPoints: ['Heat changes water to vapour'], practiceSessionId: null, materialId: 'material-a', source: null, voiceAvailable: false, voiceReason: 'Speech recognition is unavailable.' }
it('accepts canonical context with optional prompts absent and saved result practice scope', () => {
  expect(teachContextSchema.parse({ band: '14-17', available: true, reason: null, voice: { available: false, reason: 'Speech recognition is unavailable.' }, concept: { title: 'Evaporation', keyPoints: ['Heat changes water to vapour'], source: { title: 'Science', materialId: 'material-a', link: { route: 'LIBRARY_ITEM', id: 'material-a' } } }, openSessionId: null }).prompts).toEqual([])
  const parsed = teachDetailSchema.parse({ session, turns: [], pending: null, result: { covered: ['Heat changes water to vapour'], missing: [], misconceptions: [], examTip: null, effortLabel: 'TAUGHT_IT', packVersion: '0.1.5', promptRelease: 'edu-teach-back-v1', traceId: 'trace-a', practice: { route: 'PRACTICE', scope: 'MATERIAL', id: 'material-a' } } })
  expect(linkHref(parsed.result!.practice)).toBe('/learn/practice/start?scope=MATERIAL&id=material-a')
})
it('accepts code-owned safety presenter without invented model provenance', () => {
  const parsed = teachDetailSchema.parse({ session: { ...session, phase: 'FAILED' }, turns: [{ id: 'turn-a', status: 'READY', ordinal: 1, kind: 'EXPLAIN', clientTurnId: 'client-a', learnerText: 'An unsafe request', createdAt: '2026-10-21T08:00:00.000Z', failure: null, reply: { text: 'Talk to a trusted grown-up.', assistantKind: null, disposition: 'TRUSTED_ADULT', followUp: null, covered: [], missing: [], misconceptions: [], examTip: null, citations: [], reasonCodes: [], safety: { redirected: true, reasonCodes: [], guidance: 'Talk to a trusted grown-up.' }, generatedBy: { kind: 'CODE' } } }], pending: null, result: null })
  expect(parsed.turns[0]!.reply!.generatedBy.kind).toBe('CODE')
})
it('accepts final progress presenter for all bands, including nullable source targets and teen evidence fields', () => {
  for (const band of ['6-9', '10-13', '14-17']) {
    const teen = band === '14-17'
    const parsed = progressSchema.parse({ band, subjects: [{ subjectId: 'science', name: 'Science', mastery: 'PRACTICING', evidence: 'ENOUGH', ...(teen ? { readiness: 40, weakSpots: [{ label: 'Evaporation', rate: 0.4 }] } : {}), concepts: [{ label: 'Evaporation', mastery: 'PRACTICING', evidence: 'ENOUGH', ...(teen ? { rate: 0.4, attempts: 5 } : {}), conceptRef: 'subject-concept-digest', practice: null }] }], week: [{ date: '2026-10-21', completedSessions: 2 }], focusNext: { kind: 'UNAVAILABLE', reason: 'Co suggestions are turned off.' }, export: { available: teen, reason: teen ? null : 'A progress export is only for this learner in band 14-17.' } })
    expect(parsed.subjects[0]!.concepts[0]!.practice).toBeNull()
  }
})
