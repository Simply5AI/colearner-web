/*
 * SYNTHETIC FIXTURES. Imported only by the development harness (app/dev/homework), the visual review and tests.
 * Nothing here is rendered by a production route, and none of it is a real learner, session or AI result. The coach wording
 * is canned so the layouts and the contract rules can be exercised; it is not Co's behaviour. The "expected" answers live
 * only in the mock server's closure: they are never part of any payload (a test scans the payloads for them).
 */
import type { ApiBand, LearnBand } from '@/lib/api/learn'
import type { CoContextInfo, CoReply, HomeworkListItem, SafetyReasonCode } from '@/lib/api/co'

export const homeworkBands = ['kids', 'tweens', 'teens'] as const satisfies readonly LearnBand[]
export const apiBandFor = (band: LearnBand): ApiBand => band === 'kids' ? '6-9' : band === 'tweens' ? '10-13' : '14-17'
export const fixtureSessionId = 'hw-1'

export interface HomeworkScript {
  problem: string
  restatement: string
  steps: { prompt: string; hints: [string, string, string] }[]
  /** Server-side only. Never sent to the browser. */
  expected: { all: string[]; none?: string[] }
  feedback: { onTrack: string; notYet: string; unclear: string }
}

export const scripts: Record<LearnBand, HomeworkScript> = {
  kids: {
    problem: 'Which of these are root vegetables? carrot, potato, apple, radish, banana, beetroot',
    restatement: 'So we need to find the foods that grow under the ground.',
    steps: [
      { prompt: 'What is a root vegetable? Think about where it grows.', hints: [
        'Think about where the food grows. On a tree, or under the ground?',
        'Some foods grow on trees. You can cross those out first.',
        'Here is a different list: onion, mango, turnip. Which one grows under the ground?',
      ] },
      { prompt: 'Look at the list again. Which foods grow under the ground?', hints: [
        'Look at each food one at a time.',
        'Fruits like to grow up high on plants and trees.',
        'Try this list: parsnip, cherry, grape. Which one is a root?',
      ] },
    ],
    expected: { all: ['carrot', 'potato', 'radish', 'beetroot'], none: ['apple', 'banana'] },
    feedback: { onTrack: 'You looked at where each food grows. Well done!', notYet: 'Look at the list again. Which foods grow up in the air?', unclear: 'I could not tell which foods you meant. Write their names.' },
  },
  tweens: {
    problem: '3/4 + 1/8 = ?',
    restatement: 'So we need to add 3/4 and 1/8.',
    steps: [
      { prompt: 'What do we need to do to the bottom numbers before we can add? Look at 4 and 8.', hints: [
        'Look at the numbers on the bottom of each fraction.',
        'The bottoms must match before you add. Which number do both 4 and 8 go into?',
        'Here is a different one: 1/2 + 1/6. Change 1/2 so its bottom is 6, then add the tops.',
      ] },
      { prompt: 'Can you change 3/4 into a fraction with 8 on the bottom?', hints: [
        'What do you multiply 4 by to get 8?',
        'Whatever you do to the bottom, do to the top too.',
        'Try 2/3 with a 6 on the bottom. What do you do to the 2?',
      ] },
      { prompt: 'Now both fractions have the same bottom. What happens to the tops when you add?', hints: [
        'The bottom stays the same when the bottoms match.',
        'Add only the tops.',
        'Try 2/5 + 1/5. Keep the 5 and add the tops.',
      ] },
    ],
    expected: { all: ['7/8'] },
    feedback: { onTrack: 'You matched the bottoms and added the tops. Nicely done.', notYet: 'Check the last step again. Did you add the tops after matching the bottoms?', unclear: 'I could not read that as a fraction. Try writing it like 1/2.' },
  },
  teens: {
    problem: 'Write the balanced equation for NaOH + HCl.',
    restatement: 'So we need to write a balanced chemical equation for sodium hydroxide reacting with hydrochloric acid.',
    steps: [
      { prompt: 'What kind of reaction happens when an acid meets a base?', hints: [
        'Think about the name of the reaction between an acid and a base.',
        'It is a neutralisation reaction. What does neutralisation produce?',
        'A different example: HNO3 + KOH. Name the salt from K and NO3, then check the other product.',
      ] },
      { prompt: 'Which two products does that kind of reaction make?', hints: [
        'One product is a salt made from the metal and the acid part.',
        'The other product is a very common liquid.',
        'For HNO3 + KOH, the salt is KNO3. What is left over?',
      ] },
      { prompt: 'Count the atoms of each element on both sides. Is your equation already balanced?', hints: [
        'Count Na, O, H and Cl on the left, then on the right.',
        'If every count matches, no coefficients are needed.',
        'Check HNO3 + KOH the same way: count each element on both sides.',
      ] },
    ],
    expected: { all: ['nacl', 'h2o'] },
    feedback: { onTrack: 'Your equation matches what you worked out. Good chemistry.', notYet: 'Check the last step again. Count each element on both sides.', unclear: 'I could not read that as an equation. Write the reactants, an arrow and the products.' },
  },
}

/** Code-owned safety wording per band (a model never writes it). Fixture text only. */
export const safetyGuidance: Record<'SAFE_REDIRECT' | 'TRUSTED_ADULT', Record<LearnBand, string>> = {
  SAFE_REDIRECT: {
    kids: 'That sounds important. Let us stop the homework for now. Please tell a grown-up you trust how you feel.',
    tweens: 'That sounds like something to talk about with someone you trust. Let us pause the homework. A parent, teacher or school counsellor can help.',
    teens: 'That sounds like something worth talking through with someone you trust. We are pausing the homework. A parent, teacher or school counsellor can help.',
  },
  TRUSTED_ADULT: {
    kids: 'Please talk to a grown-up you trust right now, like a parent or a teacher. They want to help you.',
    tweens: 'Please talk to a trusted adult now, like a parent, a teacher or a school counsellor. They want to help.',
    teens: 'Please reach out to a trusted adult now, like a parent, a teacher or a school counsellor. You do not have to deal with this alone.',
  },
}

export const reply = (text: string, extra: Partial<CoReply> = {}): CoReply => ({
  text, disposition: 'LEARNING', beyondMaterial: false, beyondNote: null, sources: [], suggestions: [], keyPoints: null,
  safety: { redirected: false, reasonCodes: [], guidance: null },
  generatedBy: { kind: 'AI', packVersion: '0.1.4', promptRelease: 'fixture-release' },
  ...extra,
})
export function safetyReply(band: LearnBand, disposition: 'SAFE_REDIRECT' | 'TRUSTED_ADULT', reasonCodes: SafetyReasonCode[] = ['DISTRESS']): CoReply {
  const guidance = safetyGuidance[disposition][band]
  return reply(guidance, { disposition, safety: { redirected: true, reasonCodes, guidance }, generatedBy: { kind: 'CODE' } })
}

export const photoReason = 'Taking a photo of a problem is not available yet because Co cannot read pictures. Type the problem instead.'

export function contextFixture(band: LearnBand, options: { hintsMax?: number; mode?: 'FULL' | 'SUMMARY'; photoReason?: string | null } = {}): CoContextInfo {
  return {
    available: false, reason: 'Open a lesson or a page from your library to ask Co about it.', source: null, suggestions: [], openConversationId: null,
    parentVisibility: { mode: options.mode ?? (band === 'teens' ? 'SUMMARY' : 'FULL') },
    voice: { available: false, reason: 'Speaking to Co is not available yet.' },
    photo: { available: false, reason: options.photoReason === undefined ? photoReason : options.photoReason },
    hintsMax: (options.hintsMax ?? 3) as 0 | 1 | 2 | 3,
    band: apiBandFor(band),
  }
}

const T = (days: number) => new Date(Date.parse('2026-10-21T09:00:00Z') - days * 86_400_000).toISOString()
/** Earlier sessions as the list endpoint returns them. */
export function historyRows(band: LearnBand, count = 3): HomeworkListItem[] {
  const phases = ['DONE', 'STEPS', 'ABANDONED'] as const
  return Array.from({ length: count }, (_, index) => ({
    id: `hw-old-${index + 1}`, conversationId: `conv-old-${index + 1}`, phase: phases[index % 3]!,
    problemPreview: index === 0 ? scripts[band].problem.slice(0, 60) : 'Homework help', stepNumber: index === 1 ? 2 : 3, hintsUsed: index, startedAt: T(index + 1),
    finalVerdict: index === 0 ? 'on_track' as const : null,
  }))
}
