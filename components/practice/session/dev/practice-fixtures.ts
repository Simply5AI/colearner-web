import type { LearnBand } from '@/lib/api/learn'
import type { Link } from '@/lib/api/learn'
import type { PracticeBand, QuestionKind, QuestionView } from '../practice-types'

/*
 * Synthetic practice questions for the development harness, the Playwright review and the tests. Every question here is
 * invented for development (no real learner, material or model). Each ServerQuestion keeps its answer key on the "server"
 * side of the mock; `view` is exactly what the learner payload may contain (no key, hint, explanation or model answer).
 * Wording respects the band sentence limits of the B09 contract (8 / 20 / 30 words); a unit test checks it.
 */
export const fixtureSessionId = 'session-fixture'
export const fixtureMaterialId = 'material-fixture'
export const practiceBands: readonly LearnBand[] = ['kids', 'tweens', 'teens']
export const apiBandFor = (band: LearnBand): PracticeBand => band === 'kids' ? '6-9' : band === 'tweens' ? '10-13' : '14-17'
export const sessionTitle: Record<LearnBand, string> = { kids: 'Parts of a plant', tweens: 'Adding fractions', teens: 'Acids, bases and salts' }

export type AnswerKey =
  | { kind: 'MCQ'; optionId: string }
  | { kind: 'TRUE_FALSE'; value: boolean }
  | { kind: 'MULTI_SELECT'; optionIds: string[] }
  | { kind: 'CLOZE'; blanks: { blankId: string; accepted: string[] }[] }
  | { kind: 'MATCHING'; pairs: { leftId: string; rightId: string }[] }
  | { kind: 'ORDERING'; order: string[] }
  | { kind: 'SHORT_ANSWER'; keywords: string[]; modelAnswer: string }

export interface ServerQuestion {
  kind: QuestionKind
  /** The learner payload (without itemIndex / questionId / attempt fields, which the mock adds). */
  view: Record<string, unknown> & { prompt: string }
  key: AnswerKey
  hints: [string, string, string]
  explanation: string
  /** What Co says about a right / wrong answer (age-banded, no key dump). */
  right: string
  wrong: string
}

const source: Link = { route: 'LIBRARY_ITEM', id: fixtureMaterialId }
const o = (id: string, text: string) => ({ id, text })

/** A shuffled view of a list, deterministic so screenshots and tests are stable. */
function shuffled<T>(items: T[], order: number[]): T[] { return order.map(position => items[position]!) }

export const allKinds: readonly QuestionKind[] = ['MCQ', 'TRUE_FALSE', 'MULTI_SELECT', 'CLOZE', 'MATCHING', 'ORDERING', 'SHORT_ANSWER']
/** The kinds the server actually serves to each band (B09 band rules). Fixtures exist for every kind × band so the renderers can be reviewed everywhere. */
export const servedKinds: Record<LearnBand, readonly QuestionKind[]> = {
  kids: ['MCQ', 'TRUE_FALSE', 'MATCHING', 'ORDERING', 'CLOZE'],
  tweens: ['MCQ', 'TRUE_FALSE', 'MULTI_SELECT', 'CLOZE', 'MATCHING', 'ORDERING'],
  teens: allKinds,
}

const kids: ServerQuestion[] = [
  {
    kind: 'MCQ', view: { prompt: 'Which part drinks water?', options: shuffled([o('roots', 'Roots'), o('leaf', 'Leaf'), o('flower', 'Flower'), o('stem', 'Stem')], [2, 0, 3, 1]) },
    key: { kind: 'MCQ', optionId: 'roots' }, hints: ['Look under the soil.', 'It is long and thin.', 'A carrot is a root we eat!'],
    explanation: 'Roots live under the soil. They drink water for the plant.', right: 'Yes! Roots drink water!', wrong: 'Almost! Let us look again.',
  },
  {
    kind: 'TRUE_FALSE', view: { prompt: 'Leaves make food for the plant.' },
    key: { kind: 'TRUE_FALSE', value: true }, hints: ['Think about sunshine.', 'Green leaves love the light.', 'Grass is green and makes food too!'],
    explanation: 'Green leaves use sunlight to make food.', right: 'Yes! Leaves make food!', wrong: 'Almost! Think about sunshine.',
  },
  {
    kind: 'MULTI_SELECT', view: { prompt: 'Which are parts of a plant?', minSelect: 2, options: shuffled([o('roots', 'Roots'), o('leaf', 'Leaf'), o('stem', 'Stem'), o('rock', 'Rock')], [3, 1, 0, 2]) },
    key: { kind: 'MULTI_SELECT', optionIds: ['roots', 'leaf', 'stem'] }, hints: ['A rock is not alive.', 'Pick the living parts.', 'A tree has roots and a stem.'],
    explanation: 'Roots, leaves and stems are plant parts.', right: 'Yes! You found them all!', wrong: 'Almost! Look again.',
  },
  {
    kind: 'CLOZE', view: { prompt: 'Fill in the blank.', parts: [{ type: 'text', text: 'The' }, { type: 'blank', id: 'b1', options: [o('stem', 'stem'), o('roots', 'roots'), o('flower', 'flower')] }, { type: 'text', text: 'holds the plant up.' }] },
    key: { kind: 'CLOZE', blanks: [{ blankId: 'b1', accepted: ['stem'] }] }, hints: ['It is tall like a pole.', 'It is in the middle.', 'A tree trunk is a big one!'],
    explanation: 'The stem stands tall. It holds the plant up.', right: 'Yes! The stem holds it up!', wrong: 'Almost! Think of a pole.',
  },
  {
    kind: 'MATCHING', view: {
      prompt: 'Match each part to its job.',
      left: [o('roots', 'Roots'), o('leaf', 'Leaf'), o('flower', 'Flower')],
      right: shuffled([o('water', 'Drinks water'), o('food', 'Makes food'), o('seeds', 'Makes seeds')], [1, 2, 0]),
    },
    key: { kind: 'MATCHING', pairs: [{ leftId: 'roots', rightId: 'water' }, { leftId: 'leaf', rightId: 'food' }, { leftId: 'flower', rightId: 'seeds' }] },
    hints: ['Start with the roots.', 'Roots are under the soil.', 'A flower can become fruit.'],
    explanation: 'Each part has its own job.', right: 'Yes! All matched!', wrong: 'Almost! Check each one.',
  },
  {
    kind: 'ORDERING', view: { prompt: 'Put the plant in order.', items: shuffled([o('seed', 'Seed'), o('sprout', 'Sprout'), o('plant', 'Small plant'), o('flower', 'Flower')], [2, 3, 0, 1]) },
    key: { kind: 'ORDERING', order: ['seed', 'sprout', 'plant', 'flower'] }, hints: ['It starts tiny.', 'First comes the seed.', 'A bean grows this way.'],
    explanation: 'A seed grows into a sprout. Then it grows into a plant.', right: 'Yes! Perfect order!', wrong: 'Almost! Start with the seed.',
  },
  {
    kind: 'SHORT_ANSWER', view: { prompt: 'What do roots do?', maxChars: 200 },
    key: { kind: 'SHORT_ANSWER', keywords: ['water'], modelAnswer: 'Roots drink water.' }, hints: ['Think about drinking.', 'Roots help the plant drink.', 'A straw drinks from a cup.'],
    explanation: 'Roots drink water from the soil.', right: 'Yes! Roots drink water!', wrong: 'Almost! Think about water.',
  },
]

const tweens: ServerQuestion[] = [
  {
    kind: 'MCQ', view: { prompt: 'What is 1/4 + 2/4?', options: shuffled([o('a', '3/4'), o('b', '3/8'), o('c', '2/4'), o('d', '1/2')], [1, 3, 0, 2]) },
    key: { kind: 'MCQ', optionId: 'a' }, hints: ['Look at the bottom numbers. Are they the same?', 'When the bottoms match, add only the tops.', 'A similar one: 1/5 + 3/5 = 4/5. The bottom stays 5.'],
    explanation: 'The bottom number is the size of each piece, so it stays 4. Add the tops: 1 + 2 = 3.', right: 'Nice! You added the tops.', wrong: 'Not quite. Check the bottoms.',
  },
  {
    kind: 'TRUE_FALSE', view: { prompt: '3/8 is bigger than 5/8.' },
    key: { kind: 'TRUE_FALSE', value: false }, hints: ['Both have the same bottom number.', 'Same size pieces: who has more pieces?', 'A similar one: 4/10 is bigger than 2/10.'],
    explanation: 'Eighths are the same size, and 5 pieces is more than 3 pieces.', right: 'Nice! Five pieces is more.', wrong: 'Not quite. Count the pieces.',
  },
  {
    kind: 'MULTI_SELECT', view: { prompt: 'Which fractions are equal to 1/2?', minSelect: 2, options: shuffled([o('a', '2/4'), o('b', '3/6'), o('c', '2/3'), o('d', '4/8')], [2, 0, 3, 1]) },
    key: { kind: 'MULTI_SELECT', optionIds: ['a', 'b', 'd'] }, hints: ['Half means one of two equal parts.', 'The top is half of the bottom.', 'A similar one: 5/10 is equal to 1/2.'],
    explanation: 'In 2/4, 3/6 and 4/8 the top is half of the bottom.', right: 'Nice! You found all three.', wrong: 'Not quite. Check the tops.',
  },
  {
    kind: 'CLOZE', view: { prompt: 'Fill in each blank.', parts: [{ type: 'text', text: 'The top number is the' }, { type: 'blank', id: 'b1', options: null }, { type: 'text', text: '. The bottom number is the' }, { type: 'blank', id: 'b2', options: [o('num', 'numerator'), o('den', 'denominator'), o('whole', 'whole')] }, { type: 'text', text: '.' }] },
    key: { kind: 'CLOZE', blanks: [{ blankId: 'b1', accepted: ['numerator'] }, { blankId: 'b2', accepted: ['den'] }] }, hints: ['One word tells how many pieces you have.', 'The top counts the pieces you have.', 'The bottom tells the size of each piece.'],
    explanation: 'The numerator counts the pieces. The denominator names the size of each piece.', right: 'Nice! You know the parts.', wrong: 'Not quite. Check the names.',
  },
  {
    kind: 'MATCHING', view: {
      prompt: 'Match each fraction to its name.',
      left: [o('half', '1/2'), o('quarter', '1/4'), o('three', '3/4')],
      right: shuffled([o('h', 'One half'), o('q', 'One quarter'), o('t', 'Three quarters')], [2, 0, 1]),
    },
    key: { kind: 'MATCHING', pairs: [{ leftId: 'half', rightId: 'h' }, { leftId: 'quarter', rightId: 'q' }, { leftId: 'three', rightId: 't' }] },
    hints: ['Start with the one you know best.', 'Quarter means four equal parts.', 'A similar one: 1/3 is one third.'],
    explanation: 'The bottom number says how many equal parts there are.', right: 'Nice! All matched.', wrong: 'Not quite. Check the bottoms.',
  },
  {
    kind: 'ORDERING', view: { prompt: 'Put the fractions from smallest to biggest.', items: shuffled([o('e', '1/8'), o('q', '1/4'), o('h', '1/2'), o('t', '3/4')], [3, 1, 0, 2]) },
    key: { kind: 'ORDERING', order: ['e', 'q', 'h', 't'] }, hints: ['Think of one pizza cut into pieces.', 'More cuts mean smaller pieces.', 'A similar one: 1/10 is smaller than 1/5.'],
    explanation: 'When the top is 1, a bigger bottom number means a smaller piece.', right: 'Nice! Perfect order.', wrong: 'Not quite. Try the pizza idea.',
  },
  {
    kind: 'SHORT_ANSWER', view: { prompt: 'Why does 2/4 equal 1/2?', maxChars: 300 },
    key: { kind: 'SHORT_ANSWER', keywords: ['half', 'same'], modelAnswer: 'Two of four equal parts is the same amount as one of two equal parts.' }, hints: ['Draw a bar and cut it in four.', 'Colour two of the four parts.', 'Now cut another bar in two.'],
    explanation: 'Two of four equal parts is the same amount as one of two parts.', right: 'Nice explaining!', wrong: 'Not quite. Try a drawing.',
  },
]

const teens: ServerQuestion[] = [
  {
    kind: 'MCQ', view: { prompt: 'Which indicator turns pink in a basic solution?', options: shuffled([o('mo', 'Methyl orange'), o('ph', 'Phenolphthalein'), o('bl', 'Blue litmus'), o('tu', 'Turmeric')], [3, 0, 1, 2]) },
    key: { kind: 'MCQ', optionId: 'ph' }, hints: ['It is colourless in acids.', 'It has the longest name of the four.', 'A similar one: methyl orange turns yellow in a base.'],
    explanation: 'Phenolphthalein is colourless in acid and pink in base.', right: 'Correct. Well done.', wrong: 'Not quite. Think about colour changes.',
  },
  {
    kind: 'TRUE_FALSE', view: { prompt: 'Acids turn blue litmus paper red.' },
    key: { kind: 'TRUE_FALSE', value: true }, hints: ['Litmus changes colour in acids and bases.', 'Think about lemon juice on blue litmus.', 'A similar one: bases turn red litmus blue.'],
    explanation: 'Acids turn blue litmus red. Bases turn red litmus blue.', right: 'Correct. Nice one.', wrong: 'Not quite. Think about lemon juice.',
  },
  {
    kind: 'MULTI_SELECT', view: { prompt: 'Which of these are acids?', minSelect: 2, options: shuffled([o('lemon', 'Lemon juice'), o('vinegar', 'Vinegar'), o('soap', 'Soap solution'), o('hcl', 'Hydrochloric acid')], [2, 3, 1, 0]) },
    key: { kind: 'MULTI_SELECT', optionIds: ['lemon', 'vinegar', 'hcl'] }, hints: ['Acids taste sour.', 'Soap feels slippery, which is a base trait.', 'A similar one: citric acid is in oranges.'],
    explanation: 'Lemon juice, vinegar and hydrochloric acid are acids. Soap solution is a base.', right: 'Correct. You found all three.', wrong: 'Not quite. Check the sour ones.',
  },
  {
    kind: 'CLOZE', view: { prompt: 'Complete the sentence.', parts: [{ type: 'text', text: 'Blue litmus turns' }, { type: 'blank', id: 'b1', options: [o('red', 'red'), o('green', 'green'), o('colourless', 'colourless'), o('pink', 'pink')] }, { type: 'text', text: 'in acid.' }] },
    key: { kind: 'CLOZE', blanks: [{ blankId: 'b1', accepted: ['red'] }] }, hints: ['Acids and bases flip litmus in opposite directions.', 'Think about what lemon juice does to blue litmus.', 'A similar one: red litmus in soap turns blue.'],
    explanation: 'Acids turn blue litmus red. Bases turn red litmus blue.', right: 'Correct. Nicely done.', wrong: 'Not quite. Think of lemon juice.',
  },
  {
    kind: 'MATCHING', view: {
      prompt: 'Match each type of solution to its pH.',
      left: [o('acid', 'Acid'), o('base', 'Base'), o('neutral', 'Neutral')],
      right: shuffled([o('low', 'pH below 7'), o('high', 'pH above 7'), o('seven', 'pH equal to 7')], [1, 2, 0]),
    },
    key: { kind: 'MATCHING', pairs: [{ leftId: 'acid', rightId: 'low' }, { leftId: 'base', rightId: 'high' }, { leftId: 'neutral', rightId: 'seven' }] },
    hints: ['Pure water sits in the middle.', 'Acids have more hydrogen ions.', 'A similar one: bleach is a strong base.'],
    explanation: 'pH below 7 is acidic, above 7 is basic and 7 is neutral.', right: 'Correct. All matched.', wrong: 'Not quite. Start with neutral.',
  },
  {
    kind: 'ORDERING', view: { prompt: 'Order these from most acidic to most basic.', items: shuffled([o('stomach', 'Stomach acid'), o('lemon', 'Lemon juice'), o('water', 'Pure water'), o('soda', 'Baking soda'), o('bleach', 'Bleach')], [3, 0, 4, 2, 1]) },
    key: { kind: 'ORDERING', order: ['stomach', 'lemon', 'water', 'soda', 'bleach'] }, hints: ['Find the neutral one first.', 'Strong acids have the lowest pH.', 'A similar one: coffee is slightly acidic.'],
    explanation: 'Stomach acid is near pH 1 and bleach is near pH 13. Pure water sits at 7.', right: 'Correct. The order is right.', wrong: 'Not quite. Start with pure water.',
  },
  {
    kind: 'SHORT_ANSWER', view: { prompt: 'Explain what happens when an acid reacts with a base.', maxChars: 400 },
    key: { kind: 'SHORT_ANSWER', keywords: ['salt', 'water'], modelAnswer: 'An acid and a base react to form a salt and water. This is called neutralisation.' }, hints: ['This reaction has a name: neutralisation.', 'Hydrogen ions meet hydroxide ions.', 'A similar one: acid with a metal carbonate gives salt, water and carbon dioxide.'],
    explanation: 'Acid plus base gives salt plus water. This is neutralisation.', right: 'Correct. You covered the key points.', wrong: 'Not quite. Name both products.',
  },
]

const byBand: Record<LearnBand, ServerQuestion[]> = { kids, tweens, teens }
export const fixtureQuestions = (band: LearnBand): ServerQuestion[] => byBand[band]
export const fixtureQuestion = (band: LearnBand, kind: QuestionKind): ServerQuestion => byBand[band].find(question => question.kind === kind)!

/** Builds the learner view the mock serves (adds the index, id and attempt numbers). */
export function learnerView(question: ServerQuestion, index: number, attemptNo: number, options: { attemptsAllowed: number; hintsAvailable: 0 | 1 | 2 | 3; timeLimitSec?: number | null }): QuestionView {
  return {
    itemIndex: index, questionId: `q-${question.kind.toLowerCase()}-${index}`, kind: question.kind, ...question.view,
    hintsAvailable: options.hintsAvailable, sourceLink: source, timeLimitSec: options.timeLimitSec ?? null,
    attemptsAllowed: options.attemptsAllowed, attemptNo,
  } as QuestionView
}

/** Sentence-length check used by the unit test: every sentence of the learner-facing text stays within the band limit. */
export function longestSentenceWords(text: string): number {
  return text.split(/(?<=[.!?])\s+/).map(sentence => sentence.trim().split(/\s+/).filter(Boolean).length).reduce((max, n) => Math.max(max, n), 0)
}
export function learnerTexts(question: ServerQuestion): string[] {
  const view = question.view as Record<string, unknown>
  const texts: string[] = [question.view.prompt, ...question.hints, question.explanation, question.right, question.wrong]
  const push = (value: unknown) => { if (Array.isArray(value)) for (const entry of value) { const text = (entry as { text?: unknown })?.text; if (typeof text === 'string') texts.push(text) } }
  push(view.options); push(view.left); push(view.right); push(view.items)
  for (const part of (view.parts as { type: string; text?: string; options?: { text: string }[] | null }[] | undefined) ?? []) {
    if (part.type === 'text' && part.text) texts.push(part.text)
    else if (part.options) for (const option of part.options) texts.push(option.text)
  }
  return texts
}
