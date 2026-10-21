import type { ApiBand, OnboardingBand, OnboardingDraft, OnboardingState, OnboardingStep } from '@/lib/api/onboarding'

/**
 * Synthetic, clearly-marked UI fixtures for /dev/onboarding and tests only.
 * They are never seed data and no production path imports this module.
 */
export type OnboardingScenario = 'default' | 'preload' | 'resume' | 'no-subjects' | 'suggestions' | 'completed'
export const fixtureBands: Record<OnboardingBand, ApiBand> = { kids: '6-9', tweens: '10-13', teens: '14-17' }
export const emptyDraft: OnboardingDraft = {
  contexts: [], board: null, grade: null, subjectIds: [], customSubjects: [], goal: null, examDate: null,
  coTheme: null, coNickname: null, coPresence: null, voiceEnabled: null,
}
export const syntheticSubjects = [
  { subjectId: '00000000-0000-4000-8000-000000000001', name: 'Science' },
  { subjectId: '00000000-0000-4000-8000-000000000002', name: 'Maths' },
  { subjectId: '00000000-0000-4000-8000-000000000003', name: 'English' },
  { subjectId: '00000000-0000-4000-8000-000000000004', name: 'Hindi' },
  { subjectId: '00000000-0000-4000-8000-000000000005', name: 'Art' },
  { subjectId: '00000000-0000-4000-8000-000000000006', name: 'Social science' },
]

export function onboardingFixture(input: { band: OnboardingBand; step?: OnboardingStep; scenario?: OnboardingScenario }): OnboardingState {
  const { band, scenario = 'default' } = input
  const step = scenario === 'resume' && !input.step ? 'SUBJECTS' : input.step ?? 'HELLO'
  const preload = scenario === 'preload' || band === 'kids'
    ? { board: 'CBSE' as const, grade: band === 'kids' ? 2 : band === 'tweens' ? 7 : 10, className: band === 'kids' ? 'Class 2 B' : band === 'tweens' ? 'Class 7 A' : 'Class 10 C', source: 'SCHOOL_ROSTER' as const }
    : null
  const draft: OnboardingDraft = {
    ...emptyDraft,
    contexts: band === 'kids' ? ['SCHOOL'] : [],
    board: preload?.board ?? null,
    grade: preload?.grade ?? null,
    subjectIds: scenario === 'resume' ? [syntheticSubjects[0]!.subjectId] : [],
  }
  return {
    band: fixtureBands[band],
    step,
    completed: scenario === 'completed',
    draft,
    preload,
    curriculumSubjects: scenario === 'no-subjects' ? [] : (preload || scenario === 'resume') ? syntheticSubjects : [],
    skipAllowed: band !== 'kids',
    goalSuggestions: scenario === 'suggestions' && band === 'teens'
      ? { status: 'AVAILABLE', items: [{ text: 'Score well in my March exams' }, { text: 'Understand Science chapters deeply' }], generatedAt: '2026-10-19T00:00:00.000Z', promptRelease: 'synthetic-fixture' }
      : { status: 'UNAVAILABLE', reason: 'Goal ideas are not available yet.' },
  }
}

/** Mimics the contract's merge-and-idempotent PUT, including curriculum subjects for a chosen board+grade. */
export function applyFixtureSave(state: OnboardingState, body: { step: OnboardingStep; draft: Partial<OnboardingDraft> }): OnboardingState {
  const draft = { ...state.draft, ...body.draft }
  const mapped = Boolean(state.preload || (draft.board && draft.grade))
  return { ...state, step: body.step, draft, curriculumSubjects: mapped ? syntheticSubjects : [] }
}
