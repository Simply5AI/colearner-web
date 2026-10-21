import type { LearnBand } from '@/lib/api/learn'
import type { LessonBlock, LessonContentView, LessonDetail, LessonSource, LessonStepKind, LessonStepView } from '@/lib/api/lesson'

/*
 * B08 development fixtures. Synthetic only: they exist to exercise the real lesson views in tests, in /dev/lesson and
 * in the Playwright review. Nothing here is production content, and no runtime app code is imported so a Node test
 * runner can load this file. The answer key lives in `answerKeys` and is only ever returned by the mock check endpoint.
 */
export const lessonBands = ['kids', 'tweens', 'teens'] as const satisfies readonly LearnBand[]
export const apiBandFor = (band: LearnBand) => band === 'kids' ? '6-9' as const : band === 'tweens' ? '10-13' as const : '14-17' as const
export const fixtureLessonId = 'lesson-fixture'
export const fixtureMaterialId = 'material-fixture'

const src = (label: string, anchorRef: string, quote: string): LessonSource => ({ label, anchorRef, quote })
const text = (value: string): LessonBlock => ({ type: 'TEXT', text: value })
const list = (...items: string[]): LessonBlock => ({ type: 'LIST', items })
const step = (index: number, kind: LessonStepKind, title: string, coLine: string, blocks: LessonBlock[], sources: LessonSource[] = [], check: LessonStepView['check'] = null): LessonStepView =>
  ({ index, kind, title, coLine, blocks, sources, check })

type Options = { id: string; text: string; feedback: string }
export interface FixtureAnswerKey { correctOptionId: string; options: Options[] }

const kidsOptions: Options[] = [
  { id: 'roots', text: 'The roots', feedback: 'Yes! Roots drink water from the soil.' },
  { id: 'stem', text: 'The stem', feedback: 'Not quite. The stem holds the plant up.' },
  { id: 'leaves', text: 'The leaves', feedback: 'Not quite. Leaves make food from sunlight.' },
]
const tweenOptions: Options[] = [
  { id: 'same', text: 'Add the tops and keep the bottom', feedback: 'Right. When the bottoms match, you add the tops and keep the bottom.' },
  { id: 'both', text: 'Add the tops and add the bottoms', feedback: 'Not quite. The bottom number names the size of the pieces, so it stays the same.' },
  { id: 'multiply', text: 'Multiply the tops together', feedback: 'Not quite. We add fractions here, we do not multiply them.' },
]
const teenOptions: Options[] = [
  { id: 'pink', text: 'It turns pink in a base', feedback: 'Correct. Phenolphthalein is colourless in acid and pink in a base.' },
  { id: 'red', text: 'It turns red in a base', feedback: 'Not quite. Methyl orange is red in acid, and litmus is blue in a base.' },
  { id: 'blue', text: 'It turns blue in an acid', feedback: 'Not quite. Blue litmus turns red in acid; it does not turn blue.' },
  { id: 'none', text: 'It never changes colour', feedback: 'Not quite. An indicator is useful because it changes colour.' },
]
/** What the server holds and the learner payload never carries. */
export const answerKeys: Record<LearnBand, FixtureAnswerKey> = {
  kids: { correctOptionId: 'roots', options: kidsOptions },
  tweens: { correctOptionId: 'same', options: tweenOptions },
  teens: { correctOptionId: 'pink', options: teenOptions },
}
const learnerOptions = (band: LearnBand) => answerKeys[band].options.map(({ id, text: label }) => ({ id, text: label }))

const kidsContent = (): LessonContentView => ({
  title: 'Parts of a plant',
  objectives: ['Name four parts of a plant'],
  steps: [
    step(0, 'INTRO', 'Meet the plant', 'Plants have parts. Let us find them!', [text('A plant has roots, a stem, and leaves.')]),
    step(1, 'EXPLAIN', 'What each part does', 'Roots drink water.', [list('Roots drink water.', 'The stem holds the plant up.', 'Leaves make food from sunlight.', 'Flowers make seeds.')],
      [src('page 3', 'anchor-p3', 'Roots take in water from the soil. The stem holds the plant up.')]),
    step(2, 'CHECK', 'Tap the roots!', 'Which part drinks water?', [text('Think about what we just learned.')],
      [src('page 3', 'anchor-p3', 'Roots take in water from the soil.')],
      { question: 'Which part drinks water?', options: learnerOptions('kids'), hint: 'Roots live under the ground.' }),
    step(3, 'EXAMPLE', 'A tree has roots too!', 'Big trees have roots too.', [text('A tree drinks water with its roots.')], [src('page 4', 'anchor-p4', 'A tree is a very large plant with deep roots.')]),
    step(4, 'RECAP', 'You learned four parts!', 'Great job! Let us remember.', [list('Roots drink water.', 'Stems hold the plant up.', 'Leaves make food.', 'Flowers make seeds.')],
      [src('page 3', 'anchor-p3', 'Roots take in water from the soil.')]),
  ],
  keyTerms: [],
  unknowns: ['How plants grow in the dark'],
})

const tweensContent = (): LessonContentView => ({
  title: 'Adding fractions',
  objectives: ['Add fractions that have the same bottom number', 'Explain why the bottom number stays the same'],
  steps: [
    step(0, 'INTRO', 'Pieces of a whole', 'Let us see how fractions join up!', [text('A fraction names a piece of something whole. Today we add pieces that are the same size.')]),
    step(1, 'EXPLAIN', 'Same size pieces', 'Same size pieces are easy to add.', [
      text('When the bottom numbers match, the pieces are the same size, so we can count them together.'),
      { type: 'TABLE', headers: ['Fraction', 'Meaning'], rows: [['1/4', 'one of four equal pieces'], ['2/4', 'two of four equal pieces']] },
    ], [src('section 2.1', 'anchor-s21', 'To add fractions with the same denominator, add the numerators and keep the denominator.')]),
    step(2, 'CHECK', 'Try one', 'Pick the rule you think works.', [text('What do you do to add 1/4 and 2/4?')],
      [src('section 2.1', 'anchor-s21', 'Add the numerators and keep the denominator.')],
      { question: 'How do you add 1/4 and 2/4?', options: learnerOptions('tweens'), hint: 'Think about what the bottom number tells you.' }),
    step(3, 'EXAMPLE', 'One worked example', 'Watch the pieces add up.', [text('One quarter plus two quarters makes three quarters, written 3/4.')], [src('page 12', 'anchor-p12', '1/4 + 2/4 = 3/4')]),
    step(4, 'RECAP', 'What to remember', 'You can add same size pieces now!', [list('Check that the bottom numbers match.', 'Add the top numbers.', 'Keep the bottom number the same.')], [src('section 2.1', 'anchor-s21', 'Add the numerators and keep the denominator.')]),
  ],
  keyTerms: [{ term: 'Numerator', definition: 'The top number. It counts the pieces you have.' }, { term: 'Denominator', definition: 'The bottom number. It names the size of the pieces.' }],
  unknowns: ['Adding fractions with different bottom numbers'],
})

const teensContent = (): LessonContentView => ({
  title: 'Acids, bases and salts',
  objectives: ['Describe how indicators show acids and bases', 'Name the colours of three common indicators', 'State what a salt is'],
  steps: [
    step(0, 'INTRO', 'Why indicators matter', 'Colour changes tell us what a solution is.', [text('An acid, a base and a salt behave differently with indicators. In this lesson you will learn to read those colour changes.')]),
    step(1, 'EXPLAIN', 'Indicators and their colours', 'Read the table, then check the key terms.', [
      text('An indicator is a substance that changes colour in an acid or a base. The table lists three common indicators and the colour each gives.'),
      { type: 'TABLE', headers: ['Indicator', 'In acid', 'In base'], rows: [['Litmus', 'Red', 'Blue'], ['Phenolphthalein', 'Colourless', 'Pink'], ['Methyl orange', 'Red', 'Yellow']] },
      { type: 'KEY_TERMS', terms: [{ term: 'Indicator', definition: 'A substance that changes colour to show whether a solution is an acid or a base.' }, { term: 'Salt', definition: 'A compound formed when an acid reacts with a base.' }] },
    ], [src('page 41', 'anchor-p41', 'Litmus turns red in acid and blue in base.'), src('page 42', 'anchor-p42', 'Phenolphthalein is colourless in acid and pink in base.')]),
    step(2, 'CHECK', 'Quick check', 'Apply what the table showed you.', [text('Use the indicator table to answer.')],
      [src('page 42', 'anchor-p42', 'Phenolphthalein is colourless in acid and pink in base.')],
      { question: 'What does phenolphthalein do in a base?', options: learnerOptions('teens'), hint: 'Find phenolphthalein in the table and read the base column.' }),
    step(3, 'EXAMPLE', 'A neutralisation example', 'See an acid and a base make a salt.', [text('Hydrochloric acid and sodium hydroxide react to form the salt sodium chloride and water.')], [src('page 45', 'anchor-p45', 'HCl + NaOH gives NaCl + H2O.')]),
    step(4, 'RECAP', 'Recap', 'Pull the main ideas together.', [list('Indicators change colour in acids and bases.', 'Litmus is red in acid and blue in base.', 'An acid and a base react to form a salt and water.')], [src('page 41', 'anchor-p41', 'Litmus turns red in acid and blue in base.')]),
  ],
  keyTerms: [{ term: 'Indicator', definition: 'A substance that changes colour to show whether a solution is an acid or a base.' }, { term: 'Salt', definition: 'A compound formed when an acid reacts with a base.' }],
  unknowns: ['How strong acids differ from weak acids', 'The pH scale'],
})

export const lessonContentFixture = (band: LearnBand): LessonContentView => band === 'kids' ? kidsContent() : band === 'tweens' ? tweensContent() : teensContent()

export interface DetailOverrides {
  status?: LessonDetail['lesson']['status']
  failure?: LessonDetail['lesson']['failure']
  currentStep?: number
  completedSteps?: number[]
  completedAt?: string | null
  revision?: number
  notes?: LessonDetail['notes']
  content?: LessonContentView | null
  /** B10: the Ask Co state the lesson reports (default: unavailable, as in B08). */
  askCo?: LessonDetail['askCo']
}
export function lessonDetailFixture(band: LearnBand, over: DetailOverrides = {}): LessonDetail {
  const status = over.status ?? 'READY'
  const ready = status === 'READY'
  return {
    lesson: {
      id: fixtureLessonId, materialId: fixtureMaterialId, title: lessonContentFixture(band).title, status, version: 1, band: apiBandFor(band),
      createdAt: '2026-10-19T09:00:00.000Z', readyAt: ready ? '2026-10-19T09:01:10.000Z' : null, failure: over.failure ?? null,
    },
    content: over.content !== undefined ? over.content : ready ? lessonContentFixture(band) : null,
    progress: { currentStep: over.currentStep ?? 0, completedSteps: over.completedSteps ?? [], completedAt: over.completedAt ?? null, revision: over.revision ?? 0 },
    notes: over.notes ?? [],
    readAloud: { mode: 'DEVICE', note: 'Read aloud uses your device voice. Nothing is sent anywhere.' },
    askCo: over.askCo ?? { status: 'UNAVAILABLE', reason: 'Asking Co questions is coming soon. For now, use the lesson and your material.' },
    completion: {
      practice: { link: { route: 'PRACTICE', id: fixtureMaterialId, scope: 'MATERIAL' }, enabled: false, disabledReason: 'Practice opens when practice ships.' },
      home: { route: 'HOME', id: null },
    },
    source: { materialLink: { route: 'LIBRARY_ITEM', id: fixtureMaterialId } },
    // Empty strings until the lesson is READY, as the platform sends them.
    generatedBy: ready ? { kind: 'AI', packVersion: '0.1.2', promptRelease: 'lesson-fixture-1' } : { kind: 'AI', packVersion: '', promptRelease: '' },
  }
}
