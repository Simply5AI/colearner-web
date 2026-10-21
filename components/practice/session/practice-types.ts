import type { ApiBand, Link } from '@/lib/api/learn'
import type { AnswerReceipt, ChoiceOption, ClozePart, QuestionView as ApiQuestionView } from '@/lib/api/practice'

/*
 * B09 practice session types for the player. The contract types live in `lib/api/practice.ts` (agent W2); this file
 * re-exports them and splits the question union per kind, so each renderer can be typed against exactly the fields it
 * uses. Nothing here ever carries an answer key: the learner view of a question has no key, accepted answer, rubric or
 * explanation. A compile-time check at the bottom proves the split types stay assignable to W2's.
 */
export type {
  AnswerBody, AnswerReceipt, AttemptStatus, ChoiceOption, ClozePart, HintResult, PracticeAnswer, PracticeMode, PracticeSessionState, QuestionKind, SessionRow, SessionStatus,
} from '@/lib/api/practice'
export { questionKinds } from '@/lib/api/practice'
export type PracticeBand = ApiBand
export type AnswerResult = NonNullable<AnswerReceipt['result']>

export interface QuestionBase {
  itemIndex: number
  questionId: string
  prompt: string
  hintsAvailable: 0 | 1 | 2 | 3
  sourceLink: Link | null
  timeLimitSec: number | null
  attemptsAllowed: number
  /** 1-based number of the attempt about to be made. */
  attemptNo: number
}
export type McqQuestion = QuestionBase & { kind: 'MCQ'; options: ChoiceOption[] }
export type MultiSelectQuestion = QuestionBase & { kind: 'MULTI_SELECT'; options: ChoiceOption[]; minSelect?: number }
export type TrueFalseQuestion = QuestionBase & { kind: 'TRUE_FALSE' }
export type ClozeQuestion = QuestionBase & { kind: 'CLOZE'; parts: ClozePart[] }
export type MatchingQuestion = QuestionBase & { kind: 'MATCHING'; left: ChoiceOption[]; right: ChoiceOption[] }
export type OrderingQuestion = QuestionBase & { kind: 'ORDERING'; items: ChoiceOption[] }
export type ShortAnswerQuestion = QuestionBase & { kind: 'SHORT_ANSWER'; maxChars: number }
export type QuestionView = McqQuestion | MultiSelectQuestion | TrueFalseQuestion | ClozeQuestion | MatchingQuestion | OrderingQuestion | ShortAnswerQuestion

/** Drift guard: the per-kind types must stay assignable to the contract's QuestionView. */
export const questionViewMatchesContract: (question: QuestionView) => ApiQuestionView = question => question
/** The contract's union lumps MCQ and MULTI_SELECT together; the player's union does not. Same shape at runtime. */
export const asQuestion = (view: ApiQuestionView): QuestionView => view as QuestionView
