import type { LearnBand } from '@/lib/api/learn'
import type { CoContextView, CoReply, CoSource, CoTurnView } from '../co-types'

/*
 * B10 development fixtures. Synthetic only: they exist to exercise the real Ask Co views in tests, in /dev/co and in the
 * Playwright review. Nothing here is production content. No runtime app code is imported (only types), so a Node test
 * runner can load this file. Replies respect each band's sentence limit (kids 8 words, tweens 20, teens 30; a unit test checks it).
 */
export const coBands = ['kids', 'tweens', 'teens'] as const satisfies readonly LearnBand[]
export const fixtureLessonId = 'lesson-fixture'
export const fixtureMaterialId = 'material-fixture'
export const fixtureConversationId = 'conversation-fixture'
export const fixtureLink = { route: 'LIBRARY_ITEM' as const, id: fixtureMaterialId }
export const wordLimit: Record<LearnBand, number> = { kids: 8, tweens: 20, teens: 30 }

interface Topic { title: string; suggestions: string[]; question: string; answer: string; source: CoSource; followUps: string[]; beyondQuestion: string; beyondAnswer: string; beyondNote: string; keyPoints: string[]; examAnswer: string }
const source = (label: string, anchorRef: string, quote: string): CoSource => ({ label, anchorRef, quote, link: fixtureLink })

export const topics: Record<LearnBand, Topic> = {
  kids: {
    title: 'Parts of a plant',
    suggestions: ['What do roots do?', 'Tell me about leaves', 'Say it more simply'],
    question: 'What do roots do?',
    answer: 'Roots drink water from the soil. They also hold the plant in place.',
    source: source('page 3', 'anchor-p3', 'Roots take in water from the soil. The stem holds the plant up.'),
    followUps: ['What do leaves do?', 'Say it again'],
    beyondQuestion: 'Do roots store food?',
    beyondAnswer: 'Some roots store food. Carrots are roots we eat.',
    beyondNote: 'Your pages do not say this. Co used what it knows.',
    keyPoints: [], examAnswer: '',
  },
  tweens: {
    title: 'Adding fractions',
    suggestions: ['Why does the bottom number stay the same?', 'Show me one example', 'What is a numerator?'],
    question: 'Why does the bottom number stay the same?',
    answer: 'The bottom number names the size of each piece. When you add pieces of the same size, the size does not change.',
    source: source('section 2.1', 'anchor-s21', 'To add fractions with the same denominator, add the numerators and keep the denominator.'),
    followUps: ['Show me one example', 'What is a numerator?'],
    beyondQuestion: 'How do I add fractions with different bottoms?',
    beyondAnswer: 'You first make the bottom numbers the same, then add the tops. Your material has not covered this yet.',
    beyondNote: 'Your material does not cover different bottom numbers, so this comes from Co’s general knowledge.',
    keyPoints: [], examAnswer: '',
  },
  teens: {
    title: 'Acids, bases and salts',
    suggestions: ['How do indicators show an acid?', 'What is a salt?', 'Give me the three indicator colours'],
    question: 'How do indicators show an acid?',
    answer: 'An indicator changes colour depending on whether a solution is an acid or a base. Litmus turns red in acid and blue in base.',
    source: source('page 41', 'anchor-p41', 'Litmus turns red in acid and blue in base.'),
    followUps: ['What is a salt?', 'Give me the three indicator colours'],
    beyondQuestion: 'What is the pH scale?',
    beyondAnswer: 'The pH scale measures how acidic or basic a solution is, from strong acid to strong base. Your material does not cover it.',
    beyondNote: 'The pH scale is not in your material, so this answer uses general knowledge. Check it against your textbook.',
    keyPoints: ['Indicators change colour in acids and bases.', 'Litmus: red in acid, blue in base.', 'Phenolphthalein: colourless in acid, pink in base.'],
    examAnswer: 'Indicators are substances that change colour in an acid or a base. Litmus is red in acid and blue in base; phenolphthalein is colourless in acid and pink in base.',
  },
}

export const voiceReason = 'Voice questions need speech recognition, which is not set up yet. You can type or tap a question.'
export const photoReason = 'Reading a photo of a problem needs picture reading, which is not set up yet.'

export interface ContextOverrides {
  available?: boolean
  reason?: string | null
  noSource?: boolean
  openConversationId?: string | null
  mode?: 'FULL' | 'SUMMARY'
  suggestions?: string[]
}
export function contextFixture(band: LearnBand, over: ContextOverrides = {}): CoContextView {
  const topic = topics[band]
  return {
    available: over.available ?? true,
    reason: over.reason ?? null,
    source: over.noSource ? null : { title: topic.title, materialId: fixtureMaterialId, link: fixtureLink },
    suggestions: over.suggestions ?? (over.available === false ? [] : topic.suggestions),
    openConversationId: over.openConversationId ?? null,
    parentVisibility: { mode: over.mode ?? (band === 'teens' ? 'SUMMARY' : 'FULL') },
    voice: { available: false, reason: voiceReason },
    photo: { available: false, reason: photoReason },
    hintsMax: 3,
  }
}

const ai = { kind: 'AI' as const, packVersion: '0.1.4', promptRelease: 'co-fixture-1' }
const noSafety = { redirected: false, reasonCodes: [], guidance: null }

export function sourcedReply(band: LearnBand, style: 'SIMPLE' | 'EXAM' = 'SIMPLE'): CoReply {
  const topic = topics[band]
  const exam = band === 'teens' && style === 'EXAM'
  return {
    text: exam ? topic.examAnswer : topic.answer, disposition: 'LEARNING', beyondMaterial: false, beyondNote: null,
    sources: [topic.source], suggestions: topic.followUps, keyPoints: exam ? topic.keyPoints : null, safety: noSafety, generatedBy: ai,
  }
}
export function beyondReply(band: LearnBand): CoReply {
  const topic = topics[band]
  return { text: topic.beyondAnswer, disposition: 'LEARNING', beyondMaterial: true, beyondNote: topic.beyondNote, sources: [], suggestions: topic.followUps.slice(0, 1), keyPoints: null, safety: noSafety, generatedBy: ai }
}
export function clarifyReply(band: LearnBand): CoReply {
  const kids = band === 'kids'
  return { text: kids ? 'Can you tell me more?' : 'Which part of your material do you mean? Tell me a little more and I will look.', disposition: 'CLARIFY', beyondMaterial: false, beyondNote: null, sources: [], suggestions: [], keyPoints: null, safety: noSafety, generatedBy: ai }
}
/** Code-owned redirect text (a model never writes it). The wording differs per band and per kind. */
export const guidanceText: Record<LearnBand, { SAFE_REDIRECT: string; TRUSTED_ADULT: string }> = {
  kids: {
    SAFE_REDIRECT: 'That is a question for a grown-up. Do you want to keep learning about plants?',
    TRUSTED_ADULT: 'It sounds like something big. Please tell a grown-up you trust right now.',
  },
  tweens: {
    SAFE_REDIRECT: 'That one is better for a trusted adult. Want to get back to your fractions?',
    TRUSTED_ADULT: 'This sounds important. Please talk to a parent, a teacher or another adult you trust today.',
  },
  teens: {
    SAFE_REDIRECT: 'That is outside what Co can help with here. A trusted adult is a better place to start. Want to go back to your notes?',
    TRUSTED_ADULT: 'What you wrote sounds serious. Please reach out to a parent, a teacher or another adult you trust today.',
  },
}
export function safetyReply(band: LearnBand, kind: 'SAFE_REDIRECT' | 'TRUSTED_ADULT' = 'SAFE_REDIRECT'): CoReply {
  const text = guidanceText[band][kind]
  return {
    text, disposition: kind, beyondMaterial: false, beyondNote: null, sources: [], suggestions: [], keyPoints: null,
    safety: { redirected: true, reasonCodes: [kind === 'TRUSTED_ADULT' ? 'DISTRESS' : 'PERSONAL_INFORMATION'], guidance: text }, generatedBy: { kind: 'CODE' },
  }
}

export function turnFixture(over: Partial<CoTurnView> & Pick<CoTurnView, 'id' | 'ordinal' | 'learnerText'>): CoTurnView {
  return { clientTurnId: `client-${over.id}-0000`, status: 'READY', createdAt: '2026-10-21T09:00:00.000Z', reply: null, failure: null, kind: 'CHAT', ...over }
}
