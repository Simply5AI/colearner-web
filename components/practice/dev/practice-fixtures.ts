/*
 * SYNTHETIC FIXTURES. Imported only by the development harness (app/dev/practice), the visual review and tests.
 * Nothing here is rendered by a production route, and none of it is a real learner, session, score or AI result.
 * The numbers (cards, minutes, scores) are made up so the layouts can be reviewed; they are never shown outside /dev.
 */
import type { ApiBand, LearnBand } from '@/lib/api/learn'
import type { AnswerSheet, PracticeHub, PracticeSetSummary, PracticeSummary, SessionRow } from '@/lib/api/practice'

export const practiceBands = ['kids', 'tweens', 'teens'] as const satisfies readonly LearnBand[]
export const apiBandFor = (band: LearnBand): ApiBand => band === 'kids' ? '6-9' : band === 'tweens' ? '10-13' : '14-17'
export const fixtureMaterialId = 'material-fractions'
export const fixtureSessionId = 'session-1'
export const fixtureSetId = 'set-fractions'

export type HubState = 'default' | 'caught-up' | 'no-content' | 'weak-spots' | 'sets-pending'
export type SummaryState = 'great' | 'tough' | 'feedback-unavailable' | 'no-reward' | 'later-release'

const T = (days: number) => new Date(Date.parse('2026-10-19T09:00:00Z') - days * 86_400_000).toISOString()
const subjects = { kids: { id: 's-sci', name: 'Plants' }, tweens: { id: 's-math', name: 'Maths' }, teens: { id: 's-chem', name: 'Chemistry' } } as const
const titles = {
  kids: ['Plant quiz', 'Match the parts', 'Seeds and roots'],
  tweens: ['Fractions basics', 'Ratio notes', 'The water cycle'],
  teens: ['Acids, bases and salts', 'Periodic table notes', 'Reaction types'],
} as const
const reasonCode = 'Code questions need a safe place to run code, which CoLearner does not have yet.'
const reasonVoice = 'Spoken answers need speech-to-text, which is not available yet.'

export function sessionRows(band: LearnBand): SessionRow[] {
  const [a, b, c] = titles[band]
  const subject = subjects[band]
  return [
    { id: 'session-1', mode: 'PRACTICE', status: 'COMPLETED', title: a, subject, startedAt: T(1), completedAt: T(1), durationSec: 252, itemCount: 8, answered: 8, correct: 7, stars: 3 },
    { id: 'session-2', mode: 'REVIEW', status: 'COMPLETED', title: 'Review', subject: null, startedAt: T(2), completedAt: T(2), durationSec: 180, itemCount: 5, answered: 5, correct: 3, stars: 2 },
    { id: 'session-3', mode: 'PRACTICE', status: 'IN_PROGRESS', title: b, subject, startedAt: T(0), completedAt: null, durationSec: null, itemCount: 6, answered: 2, correct: null, stars: null },
    { id: 'session-4', mode: 'EXAM', status: 'COMPLETED', title: `${c} mock test`, subject, startedAt: T(5), completedAt: T(5), durationSec: 1180, itemCount: 15, answered: 15, correct: 11, stars: 2 },
    { id: 'session-5', mode: 'PRACTICE', status: 'ABANDONED', title: c, subject, startedAt: T(8), completedAt: null, durationSec: null, itemCount: 6, answered: 1, correct: null, stars: null },
  ]
}
/** History pages for the cursor list: the first page has a next cursor, the second ends the list. */
export function historyPage(band: LearnBand, cursor: string | null) {
  const rows = sessionRows(band)
  if (!cursor) return { sessions: rows, nextCursor: 'cursor-2' }
  return { sessions: [
    { id: 'session-6', mode: 'PRACTICE' as const, status: 'COMPLETED' as const, title: 'Older practice', subject: subjects[band], startedAt: T(12), completedAt: T(12), durationSec: 300, itemCount: 8, answered: 8, correct: 6, stars: 2 as const },
  ], nextCursor: null }
}

const startOf = (scope: 'DUE' | 'SET' | 'TOPIC' | 'PLAN_EXAM', id: string | null, planId?: string) => ({ link: { route: 'PRACTICE' as const, id, scope, ...(planId ? { planId } : {}) }, enabled: true, disabledReason: null })

export function hubFixture(band: LearnBand, state: HubState = 'default'): PracticeHub {
  const [a, b, c] = titles[band]
  const subject = subjects[band]
  const other = band === 'teens' ? { id: 's-phys', name: 'Physics' } : band === 'tweens' ? { id: 's-sci', name: 'Science' } : { id: 's-animals', name: 'Animals' }
  const base: PracticeHub = {
    band: apiBandFor(band), state: 'DEFAULT',
    due: { count: 5, estimatedMinutes: 4, start: startOf('DUE', null) },
    sets: [
      { id: fixtureSetId, title: a, subject, materialId: fixtureMaterialId, questionCount: 8, status: 'READY', bestStars: 2, lastPracticedAt: T(1), start: startOf('SET', fixtureSetId) },
      { id: 'set-2', title: b, subject, materialId: 'material-2', questionCount: 6, status: 'READY', bestStars: null, lastPracticedAt: null, start: startOf('SET', 'set-2') },
      { id: 'set-3', title: c, subject: other, materialId: 'material-3', questionCount: 10, status: 'READY', bestStars: 3, lastPracticedAt: T(4), start: startOf('SET', 'set-3') },
    ],
    teacherPractice: [{ planId: 'plan-6a', topicId: 'topic-1', title: band === 'kids' ? 'Plant World' : band === 'tweens' ? 'Class 6A: Fractions' : 'Class 10B: Acids and bases', questionCount: 12, practiced: 5, assignedBy: band === 'kids' ? 'Ms. Rao' : band === 'tweens' ? 'Mr. Thomas' : 'Ms. Kapoor', start: startOf('TOPIC', 'topic-1', 'plan-6a') }],
    exams: [{ planId: 'plan-exam', title: band === 'kids' ? 'Plants big test' : band === 'tweens' ? 'Fractions mock test' : 'Chemistry mock test', questionCount: 15, minutes: 30, start: startOf('PLAN_EXAM', 'plan-exam') }],
    weakSpots: [],
    recent: sessionRows(band).slice(0, 3),
    unavailableKinds: [{ kind: 'CODE', reason: reasonCode }, { kind: 'VOICE', reason: reasonVoice }],
  }
  switch (state) {
    case 'caught-up': return { ...base, state: 'CAUGHT_UP', due: null }
    case 'no-content': return { ...base, state: 'NO_CONTENT', due: null, sets: [], teacherPractice: [], exams: [], recent: [] }
    case 'weak-spots': return { ...base, weakSpots: [{ conceptId: 'c-1', name: 'Indicators' }, { conceptId: 'c-2', name: 'Balancing equations' }] }
    case 'sets-pending': return { ...base, sets: [
      { ...base.sets[0]!, id: 'set-queued', title: 'Waiting set', status: 'QUEUED', bestStars: null, lastPracticedAt: null, start: { link: null, enabled: false, disabledReason: 'Co is still making these questions.' } },
      { ...base.sets[1]!, id: 'set-failed', title: 'Set that failed', status: 'FAILED', bestStars: null, lastPracticedAt: null, start: { link: null, enabled: false, disabledReason: 'Co could not make these questions.' } },
      base.sets[2]!,
    ] }
    default: return base
  }
}

export function setFixture(status: PracticeSetSummary['status'], overrides: Partial<PracticeSetSummary> = {}): PracticeSetSummary {
  return {
    id: fixtureSetId, title: 'Fractions basics', sourceKind: 'MATERIAL', materialId: fixtureMaterialId, lessonId: null, status, version: 1, band: '10-13',
    questionCount: status === 'READY' ? 8 : 0, createdAt: T(0), readyAt: status === 'READY' ? T(0) : null,
    failure: status === 'FAILED' ? { code: 'generation_failed', retryable: true } : null, ...overrides,
  }
}

export function summaryFixture(band: LearnBand, state: SummaryState = 'great'): PracticeSummary {
  const tough = state === 'tough'
  const row = sessionRows(band)[0]!
  const missed = tough
    ? [
      { itemIndex: 1, prompt: band === 'kids' ? 'Which part drinks water?' : 'What is 1/4 + 2/4?', explanation: 'Add the tops when the bottoms are the same.', sourceLink: { route: 'LESSON' as const, id: fixtureMaterialId } },
      { itemIndex: 4, prompt: 'Which pair of fractions are equal?', explanation: null, sourceLink: null },
      { itemIndex: 6, prompt: 'Put the fractions in order.', explanation: 'Compare the tops once the bottoms match.', sourceLink: null },
    ]
    : [{ itemIndex: 5, prompt: band === 'kids' ? 'Which part makes food?' : 'What is 3/4 − 1/4?', explanation: 'Take the tops away, keep the bottom.', sourceLink: null }]
  return {
    band: apiBandFor(band),
    session: { ...row, correct: tough ? 2 : 7, stars: tough ? 1 : 3 },
    score: { correct: tough ? 2 : 7, total: 8, firstTryCorrect: tough ? 2 : 6, accuracyPercent: tough ? 25 : 87.5 },
    durationSec: 252, stars: tough ? 1 : 3, tough,
    missed, feedbackUnavailableCount: state === 'feedback-unavailable' ? 2 : 0,
    nextReviewAt: band === 'kids' ? null : T(-4),
    reward: state === 'no-reward' ? null : { kind: 'SESSION_COMPLETE', stars: tough ? 1 : 3 },
    xp: state === 'later-release' ? 80 : null, level: state === 'later-release' ? 7 : null, readiness: state === 'later-release' ? 65 : null,
    next: {
      quickRecap: { link: { route: 'LESSON', id: fixtureMaterialId }, enabled: true, disabledReason: null },
      retry: startOf('SET', fixtureSetId),
      teachBack: { link: null, enabled: false, disabledReason: 'Teach it back to Co opens with the progress release.' },
      home: { route: 'HOME', id: null },
    },
  }
}

export function answerSheetFixture(band: LearnBand): AnswerSheet {
  const session = { ...sessionRows(band)[0]!, correct: 4, itemCount: 5 }
  return {
    band: apiBandFor(band), session,
    items: [
      { itemIndex: 0, kind: 'MCQ', prompt: 'What is 1/4 + 2/4?', yourAnswer: '3/4', correctAnswer: '3/4', correct: true, partial: false, score: 1, gradingStatus: 'NOT_NEEDED', feedback: null, explanation: 'Same bottoms: add the tops.', sourceLink: null, attempts: 1, attemptId: null },
      { itemIndex: 1, kind: 'CLOZE', prompt: 'Blue litmus turns ___ in acid.', yourAnswer: 'blue', correctAnswer: 'red', correct: false, partial: false, score: 0, gradingStatus: 'NOT_NEEDED', feedback: null, explanation: 'Acids turn blue litmus red.', sourceLink: { route: 'LESSON', id: fixtureMaterialId }, attempts: 3, attemptId: null },
      { itemIndex: 2, kind: 'MATCHING', prompt: 'Match each fraction to its picture.', yourAnswer: '1/2 → half, 1/4 → quarter, 3/4 → half', correctAnswer: '1/2 → half, 1/4 → quarter, 3/4 → three quarters', correct: false, partial: true, score: 0.67, gradingStatus: 'NOT_NEEDED', feedback: null, explanation: null, sourceLink: null, attempts: 1, attemptId: null },
      { itemIndex: 3, kind: 'SHORT_ANSWER', prompt: 'Explain why 2/4 equals 1/2.', yourAnswer: 'Both are half of the whole.', correctAnswer: null, correct: null, partial: false, score: null, gradingStatus: 'FEEDBACK_UNAVAILABLE', feedback: null, explanation: null, sourceLink: null, attempts: 1, attemptId: 'attempt-9' },
      { itemIndex: 4, kind: 'SHORT_ANSWER', prompt: 'What does the bottom number show?', yourAnswer: 'How many equal parts the whole has.', correctAnswer: null, correct: true, partial: false, score: 1, gradingStatus: 'GRADED', feedback: 'Yes. You named the equal parts.', explanation: null, sourceLink: null, attempts: 1, attemptId: null },
    ],
  }
}
