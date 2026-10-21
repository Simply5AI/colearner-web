/*
 * SYNTHETIC FIXTURES. Imported only by the development harness (app/dev/learn) and tests.
 * Nothing here is rendered by a production route, and none of it is a real learner, plan or AI result.
 */
import type { AiState, ApiBand, LearnHome, LearnOverview, PlanCard, PlanDetail, PlanItem, PlanTopic } from '@/lib/api/learn'
import type { LearnBand } from '@/lib/api/learn'

export const fixtureBands = ['kids', 'tweens', 'teens'] as const satisfies readonly LearnBand[]
export const apiBand = (band: LearnBand): ApiBand => band === 'kids' ? '6-9' : band === 'tweens' ? '10-13' : '14-17'
const days = (count: number, now = Date.now()) => new Date(now + count * 86_400_000).toISOString()
const locked = 'Lessons open when the lesson player ships. Your plan is saved.'
const names = { kids: 'Aarav', tweens: 'Mariam', teens: 'Rohan' } as const
const teachers = { kids: 'Ms. Rao', tweens: 'Mr. Thomas', teens: 'Ms. Kapoor' } as const

export type HomeState = 'default' | 'first-time' | 'limit-reached'
export type OverviewState = 'default' | 'empty' | 'join-code' | 'approval-pending' | 'unavailable-join'
export type PlanState = 'default' | 'topic-expanded' | 'no-sources' | 'locked'

const unavailableAi = <T>(): AiState<T> => ({ status: 'UNAVAILABLE', reason: 'Co suggestions are not enabled for this school.' })
const available = <T>(items: T[]): AiState<T> => ({ status: 'AVAILABLE', items, generatedAt: '2026-10-19T08:00:00Z', promptRelease: 'fixture' })

export function homeFixture(band: LearnBand, state: HomeState = 'default'): LearnHome {
  const base: LearnHome = {
    band: apiBand(band), learner: { displayName: names[band] }, state: 'ACTIVE',
    nextAction: {
      kind: 'CONTINUE_LESSON', title: band === 'kids' ? 'Parts of a plant' : band === 'tweens' ? 'Adding fractions' : 'Acids, bases and salts',
      subtitle: band === 'kids' ? null : band === 'tweens' ? 'Lesson 2 of 4' : 'Chemistry · Chapter 2', dueAt: null, estimatedMinutes: band === 'kids' ? null : 10,
      progress: { done: 2, total: band === 'kids' ? 5 : 4 }, origin: 'PERSONAL', link: { route: 'LESSON', id: 'lesson-next' }, enabled: false, disabledReason: locked,
    },
    todayPlan: band === 'kids' ? null : { estimatedMinutes: 15, items: [
      { kind: 'REVIEW', title: 'Review 5 cards', estimatedMinutes: 5, link: { route: 'PRACTICE', id: null, scope: 'DUE' }, enabled: false, disabledReason: 'Reviews open when practice ships.' },
      { kind: 'LESSON', title: band === 'tweens' ? 'Finish Adding fractions' : 'Finish Acids and bases', estimatedMinutes: 6, link: { route: 'LESSON', id: 'lesson-next' }, enabled: false, disabledReason: locked },
      { kind: 'QUIZ', title: 'One quick quiz', estimatedMinutes: 4, link: { route: 'PRACTICE', id: 'quiz-1', scope: 'SET' }, enabled: false, disabledReason: 'Quizzes open when practice ships.' },
    ] },
    assignments: [{ planId: 'plan-assigned', title: band === 'kids' ? 'Count the petals' : 'Fractions worksheet', teacherName: teachers[band], className: band === 'kids' ? 'Class 3B' : 'Class 6A', dueAt: days(3), progress: { done: 1, total: 4 }, link: { route: 'PLAN', id: 'plan-assigned' } }],
    dueReviewCount: 5, streak: { currentDays: band === 'tweens' ? 5 : 12 },
    timeBudget: band === 'kids' ? { minutesLeftToday: 20 } : null,
    subjectProgress: band === 'teens' ? [
      { subjectId: 's-chem', name: 'Chemistry', itemsDone: 6, itemsTotal: 12, masteryPercent: 62 },
      { subjectId: 's-phys', name: 'Physics', itemsDone: 4, itemsTotal: 10, masteryPercent: null },
      { subjectId: 's-math', name: 'Maths', itemsDone: 9, itemsTotal: 14, masteryPercent: 71 },
      { subjectId: 's-bio', name: 'Biology', itemsDone: 0, itemsTotal: 0, masteryPercent: null },
    ] : [],
    examCountdown: band === 'teens' ? { label: 'Board exams', examDate: days(142), daysLeft: 142 } : null,
    recentMaterials: band === 'kids' ? [] : [{ id: 'm-1', title: 'Class notes: indicators', status: 'ready', sourceType: 'pdf', updatedAt: days(-1) }, { id: 'm-2', title: 'NCERT chapter link', status: 'processing', sourceType: 'web', updatedAt: days(-2) }],
    recommendation: band === 'kids' ? unavailableAi() : available([{ title: band === 'tweens' ? 'A five-minute fractions warm-up' : 'You mix up indicators for acids and bases', reason: band === 'tweens' ? 'You paused part-way through the last lesson.' : 'It showed up in your last two practice sets.', link: { route: 'PLAN', id: 'plan-chem' } }]),
  }
  if (state === 'first-time') return { ...base, state: 'FIRST_TIME', nextAction: { ...base.nextAction!, kind: 'IMPORT_MATERIAL', title: 'Bring something to learn', subtitle: null, progress: null, estimatedMinutes: null, link: { route: 'IMPORT', id: null }, enabled: true, disabledReason: null }, todayPlan: null, assignments: [], dueReviewCount: 0, streak: null, subjectProgress: [], examCountdown: null, recentMaterials: [], recommendation: unavailableAi() }
  if (state === 'limit-reached') return { ...base, state: 'LIMIT_REACHED', timeBudget: { minutesLeftToday: 0 } }
  return base
}

const plan = (overrides: Partial<PlanCard> & { id: string; title: string }): PlanCard => ({
  kind: 'PERSONAL', subject: null, mode: 'TOPIC', status: 'ACTIVE', progress: { done: 0, total: 0 }, nextItemTitle: null, dueAt: null, examDate: null, assignedBy: null, className: null, locked: false, ...overrides,
})

export function overviewFixture(band: LearnBand, state: OverviewState = 'default'): LearnOverview {
  const empty: LearnOverview = { band: apiBand(band), subjects: [], plans: [], pendingEnrollments: [], canJoinWithCode: band !== 'kids', canCreatePersonalPlan: band !== 'kids', unavailableReason: null, nextCursor: null }
  if (state === 'empty') return empty
  const subjects = band === 'kids'
    ? [{ id: 's1', name: 'Plant World', icon: null, planCount: 1, progress: { done: 2, total: 5 } }, { id: 's2', name: 'Number Land', icon: null, planCount: 1, progress: { done: 1, total: 4 } }, { id: 's3', name: 'Word Woods', icon: null, planCount: 0, progress: { done: 0, total: 0 } }]
    : [{ id: 's1', name: 'Maths', icon: null, planCount: 2, progress: { done: 5, total: 12 } }, { id: 's2', name: 'Science', icon: null, planCount: 1, progress: { done: 3, total: 9 } }, { id: 's3', name: 'English', icon: null, planCount: 0, progress: { done: 0, total: 0 } }]
  const plans: PlanCard[] = [
    plan({ id: 'plan-1', title: band === 'kids' ? 'Plant World' : 'Fractions practice', subject: { id: 's1', name: subjects[0]!.name }, progress: { done: 2, total: 5 }, nextItemTitle: band === 'kids' ? 'Leaves' : 'Adding fractions' }),
    plan({ id: 'plan-assigned', title: band === 'kids' ? 'Number Land' : band === 'tweens' ? 'Fractions' : 'Class 10 Chemistry Board Prep', kind: 'ASSIGNED', locked: true, subject: { id: 's2', name: subjects[1]!.name }, progress: { done: 1, total: 4 }, dueAt: days(3), assignedBy: { name: teachers[band] }, className: band === 'teens' ? 'Class 10' : 'Class 6A', nextItemTitle: 'Equivalent fractions', mode: band === 'teens' ? 'EXAM_PREP' : 'TOPIC' }),
    ...(band === 'teens' ? [plan({ id: 'plan-exam', title: 'Exam prep: Board exams', mode: 'EXAM_PREP', subject: { id: 's1', name: 'Maths' }, progress: { done: 3, total: 20 }, examDate: days(142), nextItemTitle: 'Algebra revision' })] : []),
  ]
  const pendingEnrollments = state === 'approval-pending' ? [{ id: 'e-1', planTitle: 'Fractions', teacherName: teachers[band], status: 'PENDING_GUARDIAN_APPROVAL' as const, requestedAt: days(-1) }] : []
  return { ...empty, subjects, plans, pendingEnrollments, canJoinWithCode: band !== 'kids', unavailableReason: state === 'unavailable-join' ? 'Your school has not turned on joining with a code yet.' : null }
}

const item = (id: string, kind: PlanItem['kind'], title: string, status: PlanItem['status'], extra: Partial<PlanItem> = {}): PlanItem => ({
  id, kind, title, status, link: kind === 'LESSON' ? { route: 'LESSON', id } : { route: 'PRACTICE', id, scope: kind === 'MOCK_TEST' ? 'PLAN_EXAM' : 'TOPIC' }, enabled: false, disabledReason: kind === 'LESSON' ? locked : 'Practice opens when practice ships.', ...extra,
})
const topic = (id: string, title: string, status: PlanTopic['status'], items: PlanItem[], extra: Partial<PlanTopic> = {}): PlanTopic => ({ id, title, status, masteryPercent: null, dueAt: null, items, materials: [], ...extra })

export function planFixture(band: LearnBand, state: PlanState = 'default'): { detail: PlanDetail; expandedTopicId: string | null } {
  let detail: Omit<PlanDetail, 'band'>
  if (band === 'kids') {
    detail = {
      plan: { ...plan({ id: 'plan-1', title: 'Plant World', subject: { id: 's1', name: 'Science' }, progress: { done: 2, total: 5 }, nextItemTitle: 'Leaves' }), teacherNote: null },
      nextItemId: 'i-leaves-1',
      phases: [{ id: 'ph1', title: 'Plant World', ordinal: 1, progress: { done: 2, total: 5 }, topics: [
        topic('t-seeds', 'Seeds', 'DONE', [item('i-seeds-1', 'LESSON', 'What is a seed?', 'DONE')]),
        topic('t-roots', 'Roots', 'DONE', [item('i-roots-1', 'LESSON', 'Roots drink water', 'DONE')]),
        topic('t-stems', 'Stems', 'IN_PROGRESS', [item('i-stems-1', 'LESSON', 'Stems hold things up', 'IN_PROGRESS')]),
        topic('t-leaves', 'Leaves', 'NOT_STARTED', [item('i-leaves-1', 'LESSON', 'Leaves make food', 'NOT_STARTED'), item('i-leaves-2', 'QUIZ', 'Leaf quiz', 'NOT_STARTED')], { materials: [{ id: 'm-1', title: 'Page about leaves', sourceType: 'image', origin: 'PERSONAL' }] }),
        topic('t-flowers', 'Flowers', 'NOT_STARTED', [item('i-flowers-1', 'LESSON', 'Flowers and seeds', 'NOT_STARTED')]),
      ] }],
      weakConcepts: [], materials: [{ id: 'm-1', title: 'Page about leaves', sourceType: 'image', origin: 'PERSONAL', link: { route: 'LIBRARY_ITEM', id: 'm-1' } }],
      suggestedResources: unavailableAi(), permissions: { canEditStructure: true, canAttachMaterial: true, canStartNext: true, lockedReason: null },
    }
  } else if (band === 'tweens') {
    const levels = ['What is a fraction', 'Equivalent fractions', 'Adding fractions', 'Fractions in real life']
    detail = {
      plan: { ...plan({ id: 'plan-assigned', title: 'Fractions', kind: 'ASSIGNED', locked: true, subject: { id: 's1', name: 'Maths' }, progress: { done: 3, total: 8 }, dueAt: days(3), assignedBy: { name: 'Mr. Thomas' }, className: 'Class 6A', nextItemTitle: 'Equivalent fractions' }), teacherNote: 'Take your time with the first two levels. Bring any questions to Thursday’s class.' },
      nextItemId: 'i-1-l', phases: levels.map((title, index) => ({ id: `ph${index}`, title, ordinal: index + 1, progress: { done: index === 0 ? 2 : 0, total: 2 }, topics: [topic(`t${index}`, title, index === 0 ? 'DONE' : index === 1 ? 'IN_PROGRESS' : 'NOT_STARTED', [item(`i-${index}-l`, 'LESSON', `${title}: lesson`, index === 0 ? 'DONE' : 'NOT_STARTED'), item(`i-${index}-q`, 'QUIZ', `${title}: quiz`, index === 0 ? 'DONE' : 'NOT_STARTED')], { dueAt: index === 1 ? days(3) : null, materials: index === 0 ? [{ id: 'm-1', title: 'Fraction worksheet', sourceType: 'pdf', origin: 'TEACHER' }] : [] })] })),
      weakConcepts: [], materials: [{ id: 'm-1', title: 'Fraction worksheet', sourceType: 'pdf', origin: 'TEACHER', link: { route: 'LIBRARY_ITEM', id: 'm-1' } }],
      suggestedResources: unavailableAi(), permissions: { canEditStructure: false, canAttachMaterial: false, canStartNext: true, lockedReason: 'Mr. Thomas controls the levels of this plan.' },
    }
  } else {
    detail = {
      plan: { ...plan({ id: 'plan-chem', title: 'Chemistry · Class 10', subject: { id: 's1', name: 'Chemistry' }, mode: 'EXAM_PREP', progress: { done: 6, total: 12 }, examDate: days(142), nextItemTitle: 'Acids and bases' }), teacherNote: null },
      nextItemId: 'i-acids-1',
      phases: [
        { id: 'c1', title: 'Chemical reactions', ordinal: 1, progress: { done: 4, total: 4 }, topics: [topic('t-react', 'Types of reactions', 'DONE', [item('i-react-1', 'LESSON', 'Combination and decomposition', 'DONE'), item('i-react-2', 'PRACTICE', 'Balancing equations', 'DONE')], { masteryPercent: 78 })] },
        { id: 'c2', title: 'Acids, bases and salts', ordinal: 2, progress: { done: 2, total: 6 }, topics: [
          topic('t-acids', 'Acids and bases', 'IN_PROGRESS', [item('i-acids-1', 'LESSON', 'Indicators', 'IN_PROGRESS'), item('i-acids-2', 'PRACTICE', 'pH practice', 'NOT_STARTED')], { masteryPercent: 55, materials: [{ id: 'm-1', title: 'Class notes: indicators', sourceType: 'pdf', origin: 'TEACHER' }] }),
          topic('t-salts', 'Salts', 'NOT_STARTED', [item('i-salts-1', 'LESSON', 'Making salts', 'NOT_STARTED'), item('i-mock-1', 'MOCK_TEST', 'Chapter mock test', 'NOT_STARTED', { enabled: false, disabledReason: 'Mock tests open when practice ships.' })]),
        ] },
      ],
      weakConcepts: [{ conceptId: 'k1', name: 'Indicators' }, { conceptId: 'k2', name: 'Neutralisation' }],
      materials: [{ id: 'm-1', title: 'Class notes: indicators', sourceType: 'pdf', origin: 'TEACHER', link: { route: 'LIBRARY_ITEM', id: 'm-1' } }, { id: 'm-2', title: 'NCERT chapter link', sourceType: 'web', origin: 'CENTRAL', link: { route: 'LIBRARY_ITEM', id: 'm-2' } }],
      suggestedResources: available([{ title: 'Indicators explained', url: 'https://example.org/indicators', reason: 'Matches the topic you are on.' }, { title: 'Neutralisation practice sheet', url: null, reason: 'Covers the concept you found tricky.' }]),
      permissions: { canEditStructure: true, canAttachMaterial: true, canStartNext: true, lockedReason: null },
    }
  }
  if (state === 'locked' && detail.plan.kind !== 'ASSIGNED') detail = { ...detail, plan: { ...detail.plan, kind: 'ASSIGNED', locked: true, assignedBy: { name: teachers[band] }, className: 'Class 6A', teacherNote: 'Work through the steps in order.' }, permissions: { ...detail.permissions, canEditStructure: false, canAttachMaterial: false, lockedReason: `${teachers[band]} controls the steps of this plan.` } }
  if (state === 'no-sources') detail = { ...detail, materials: [], suggestedResources: available([{ title: 'A beginner overview to start with', url: 'https://example.org/start', reason: 'Co suggests starting with an overview.' }]), phases: detail.phases.map(phase => ({ ...phase, topics: phase.topics.map(entry => ({ ...entry, materials: [] })) })) }
  const expandedTopicId = state === 'topic-expanded' || state === 'no-sources' ? (band === 'kids' ? 't-leaves' : band === 'tweens' ? 't1' : 't-acids') : null
  return { detail: { ...detail, band: apiBand(band) }, expandedTopicId }
}
