import { customSubjectPattern, maxCustomSubjects, maxGoalLength, nicknamePattern, onboardingSteps, type OnboardingBand, type OnboardingDraft, type OnboardingState, type OnboardingStep } from '@/lib/api/onboarding'

export type DraftErrors = Partial<Record<keyof OnboardingDraft, string>>

export const nextStep = (step: OnboardingStep): OnboardingStep | null => onboardingSteps[onboardingSteps.indexOf(step) + 1] ?? null
export const previousStep = (step: OnboardingStep): OnboardingStep | null => onboardingSteps[onboardingSteps.indexOf(step) - 1] ?? null

const todayLocal = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` }

/** The platform accepts exam dates from today up to three years ahead. */
const latestExamDate = (today: string) => `${Number(today.slice(0, 4)) + 3}${today.slice(4)}`

/** Blocks leaving a step only for values the server would reject; nothing here is required to be non-empty. */
export function validateStep(step: OnboardingStep, band: OnboardingBand, draft: OnboardingDraft, today = todayLocal()): DraftErrors {
  const errors: DraftErrors = {}
  if (step === 'SUBJECTS') {
    if (draft.customSubjects.length > maxCustomSubjects || draft.customSubjects.some(item => !customSubjectPattern.test(item))) errors.customSubjects = 'Use 2 to 40 letters, numbers or spaces for your own subjects.'
    if (band === 'teens') {
      if ((draft.goal ?? '').length > maxGoalLength) errors.goal = `Keep your goal under ${maxGoalLength} characters.`
      if (draft.examDate && draft.examDate.slice(0, 10) < today) errors.examDate = 'Choose a date that has not passed.'
      else if (draft.examDate && draft.examDate.slice(0, 10) > latestExamDate(today)) errors.examDate = 'Choose a date within the next three years.'
    }
  }
  if (step === 'PERSONALISE' && band !== 'teens' && draft.coNickname?.trim() && !nicknamePattern.test(draft.coNickname.trim())) errors.coNickname = 'Use up to 20 letters, numbers or spaces.'
  return errors
}

/** Draft values saved when leaving a step. Server-set values (school roster) are never sent back. */
export function patchFor(step: OnboardingStep, band: OnboardingBand, draft: OnboardingDraft, state: OnboardingState): Partial<OnboardingDraft> {
  if (step === 'CONTEXT') return band === 'kids' ? {} : { contexts: ['SCHOOL'] }
  if (step === 'SUBJECTS') {
    const known = new Set(state.curriculumSubjects.map(subject => subject.subjectId))
    const patch: Partial<OnboardingDraft> = { subjectIds: draft.subjectIds.filter(item => known.has(item)), customSubjects: band === 'kids' ? [] : draft.customSubjects.map(item => item.trim()) }
    if (!state.preload && band !== 'kids') { if (draft.board) patch.board = draft.board; if (draft.grade) patch.grade = draft.grade }
    if (band === 'teens') { patch.goal = draft.goal?.trim() || null; patch.examDate = draft.examDate || null }
    return patch
  }
  if (step === 'PERSONALISE') {
    if (band === 'teens') return { ...(draft.coPresence ? { coPresence: draft.coPresence } : {}), ...(draft.voiceEnabled !== null ? { voiceEnabled: draft.voiceEnabled } : {}) }
    return { ...(draft.coTheme ? { coTheme: draft.coTheme } : {}), coNickname: draft.coNickname?.trim() || null }
  }
  return {}
}

export const initialDraft = (state: OnboardingState): OnboardingDraft => ({
  ...state.draft,
  contexts: state.draft.contexts.length ? state.draft.contexts : state.band === '6-9' || state.preload ? ['SCHOOL'] : [],
  board: state.preload?.board ?? state.draft.board,
  grade: state.preload?.grade ?? state.draft.grade,
})
