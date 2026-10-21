import { parseRevealed, type ItemMarks } from '../questions/marks'
import type { AnswerReceipt, PracticeMode, QuestionView } from './practice-types'
import type { ItemPhase } from './session-model'

/*
 * How an AnswerReceipt is shown (F-L10-06/08, B09 decisions 4). Pure functions so the rules are unit-tested:
 * - EXAM shows nothing about the result until the session is completed, whatever the server sends;
 * - the right answer is shown only when the server says `correctAnswerRevealed`;
 * - "correct" only ever comes from the server's own `result.correct`.
 */
export function receiptPhase(receipt: AnswerReceipt | null, mode: PracticeMode): Extract<ItemPhase, 'correct' | 'partial' | 'incorrect' | 'pending' | 'unavailable' | 'recorded'> | null {
  if (!receipt) return null
  if (mode === 'EXAM') return 'recorded'
  switch (receipt.attempt.status) {
    case 'PENDING_FEEDBACK': return 'pending'
    case 'FEEDBACK_UNAVAILABLE': return 'unavailable'
    case 'RECORDED': case 'GRADED': {
      const result = receipt.result
      if (!result || result.correct === null) return 'recorded'
      if (result.correct) return 'correct'
      return result.partial ? 'partial' : 'incorrect'
    }
  }
}

/** The result block to show: never in EXAM, never for an ungraded or pending attempt. */
export function visibleResult(receipt: AnswerReceipt | null, mode: PracticeMode) {
  if (!receipt || mode === 'EXAM') return null
  return receipt.result
}

/** The revealed answer, only when the server allowed it. EXAM never shows it. */
export function revealedFor(question: QuestionView, receipt: AnswerReceipt | null, mode: PracticeMode) {
  const result = visibleResult(receipt, mode)
  if (!result || !result.correctAnswerRevealed) return null
  return parseRevealed(question, result.revealedAnswer)
}

/** Tile marks for the renderers, or null when the receipt does not judge the answer. */
export function marksFor(question: QuestionView, receipt: AnswerReceipt | null, mode: PracticeMode): ItemMarks | null {
  const phase = receiptPhase(receipt, mode)
  if (phase !== 'correct' && phase !== 'partial' && phase !== 'incorrect') return null
  return { correct: phase === 'correct', partial: phase === 'partial', revealed: revealedFor(question, receipt, mode) }
}

/** May the learner try this item again? Only PRACTICE and REVIEW, only when the server says so, and never while feedback is pending. */
export function canTryAgain(receipt: AnswerReceipt | null, mode: PracticeMode): boolean {
  if (!receipt || mode === 'EXAM') return false
  const phase = receiptPhase(receipt, mode)
  return receipt.canRetry && (phase === 'incorrect' || phase === 'partial')
}
