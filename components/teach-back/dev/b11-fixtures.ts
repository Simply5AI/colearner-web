import type { TeachDetail, TeachReply, TeachTurn } from '@/lib/api/teach-back'
import type { LearnProgress } from '@/lib/api/learn-progress'
import type { LearnBand } from '@/lib/api/learn'
export const apiBand = { kids: '6-9', tweens: '10-13', teens: '14-17' } as const
export const voiceReason = 'Voice needs speech recognition, which is not available yet. You can type instead.'
export function reply(followUp: string | null = null): TeachReply {
  return { text: 'You explained how water becomes vapour.', assistantKind: 'ai', disposition: 'LEARNING', followUp, covered: ['Water becomes vapour'], missing: ['Cooling makes droplets'], misconceptions: [], examTip: null, citations: [{ label: 'Water cycle page', anchorRef: 'water-evaporation', quote: 'Warm water can become vapour.', link: { route: 'LIBRARY_ITEM', id: 'material-fixture' } }], reasonCodes: [], safety: { redirected: false, reasonCodes: [], guidance: null }, generatedBy: { kind: 'AI', packVersion: '0.1.5', promptRelease: 'synthetic-b11' } }
}
export function turn(status: TeachTurn['status'] = 'READY', followUp: string | null = null): TeachTurn {
  return { id: 'turn-fixture', ordinal: 1, clientTurnId: 'client-turn-fixture', kind: 'EXPLAIN', learnerText: 'Warm water becomes vapour.', status, createdAt: '2026-10-21T08:00:00Z', reply: status === 'READY' ? reply(followUp) : null, failure: status === 'FAILED' ? { code: 'TEACH_BACK_UNAVAILABLE', retryable: true } : null }
}
export function detail(band: LearnBand, state = 'feedback'): TeachDetail {
  const complete = band !== 'teens'
  const result = { covered: complete ? ['Water becomes vapour', 'Cooling makes droplets'] : ['Water becomes vapour'], missing: complete ? [] : ['Cooling makes droplets'], misconceptions: [], examTip: band === 'teens' ? 'Describe both evaporation and condensation.' : null, effortLabel: complete ? 'TAUGHT_IT' as const : null, packVersion: '0.1.5', promptRelease: 'synthetic-b11', traceId: null, practice: { route: 'PRACTICE' as const, scope: 'MATERIAL' as const, id: 'material-fixture' } }
  const pending = state === 'pending' ? turn('RUNNING') : null
  const follow = state === 'follow-up'
  const ready = turn('READY', follow ? 'What happens when vapour cools?' : null)
  if (state === 'feedback' && ready.reply) ready.reply = { ...ready.reply, covered: result.covered, missing: result.missing }
  return { session: { id: 'session-fixture', band: apiBand[band], phase: state === 'prompt' ? 'PROMPT' : pending ? 'EXPLAIN' : follow ? 'FOLLOW_UP' : 'FEEDBACK', status: 'OPEN', voiceAvailable: false, voiceReason, conceptTitle: 'The water cycle', keyPoints: ['Water becomes vapour', 'Cooling makes droplets'], practiceSessionId: null, materialId: 'material-fixture', source: { title: 'Water cycle page', link: null } }, turns: pending || state === 'prompt' ? [] : [ready], pending, result: state === 'feedback' ? result : null }
}
export function progress(band: LearnBand, state = 'ready'): LearnProgress {
  const enough = state !== 'insufficient'
  return { band: apiBand[band], subjects: state === 'empty' ? [] : [{ subjectId: 'science', name: 'Science', mastery: enough ? 'PRACTICING' : 'LEARNING', evidence: enough ? 'ENOUGH' : 'INSUFFICIENT', ...(band === 'teens' ? { readiness: enough ? 40 : null } : {}), concepts: [{ conceptRef: 'science-water', label: 'Water cycle', mastery: enough ? 'PRACTICING' : 'LEARNING', evidence: enough ? 'ENOUGH' : 'INSUFFICIENT', practice: { route: 'LIBRARY_ITEM', id: 'material-fixture' }, ...(band === 'teens' ? { rate: 0.4, attempts: 5 } : {}) }] }], week: Array.from({ length: 7 }, (_, index) => ({ date: `2026-10-${15 + index}`, completedSessions: index % 3 })), focusNext: state === 'suggestions' ? { kind: 'AI', suggestions: [{ candidateRef: 'science-water', label: 'Water cycle', reason: 'Try explaining how droplets form.' }] } : { kind: 'UNAVAILABLE', reason: 'Co suggestions are turned off.' }, export: { available: band === 'teens', reason: band === 'teens' ? null : 'Progress exports are available for teens only.' } }
}

/** Synthetic lifecycle with distinct identities for EXPLAIN and FOLLOW_UP. */
export function createTeachFixtureFlow(band: LearnBand, state: string) {
  let current = detail(band, state)
  let polls = 0
  return {
    snapshot: () => current,
    submit: (text: string) => {
      const followUp = current.session.phase === 'FOLLOW_UP'
      const pending: TeachTurn = {
        ...turn('RUNNING'),
        id: followUp ? 'follow-up-turn-fixture' : 'turn-fixture',
        ordinal: followUp ? 2 : 1,
        kind: followUp ? 'FOLLOW_UP' : 'EXPLAIN',
        clientTurnId: followUp ? 'client-follow-up-fixture' : 'client-turn-fixture',
        learnerText: text,
      }
      polls = 0
      current = { ...current, session: { ...current.session, phase: followUp ? 'FOLLOW_UP' : 'EXPLAIN' }, turns: [...current.turns, pending], pending, result: null }
      return pending
    },
    poll: () => {
      const pending = current.pending
      if (!pending) throw new Error('The fixture has no pending turn.')
      polls += 1
      if (polls <= 2 || state === 'pending') return pending
      const feedback = detail(band, 'feedback')
      const ready: TeachTurn = { ...pending, status: 'READY', reply: { ...reply(), covered: feedback.result!.covered, missing: feedback.result!.missing }, failure: null }
      current = { ...feedback, turns: [...current.turns.filter(item => item.id !== ready.id), ready] }
      return ready
    },
  }
}
