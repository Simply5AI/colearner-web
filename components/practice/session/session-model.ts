import type { CoState } from '@/components/design-system'
import { bandFromApi, type LearnBand } from '@/lib/api/learn'
import { LearnApiError, LearnSessionError } from '@/lib/api/learn-request'
import { practiceErrorCode } from '@/lib/api/practice'
import { speechWords } from '@/lib/hooks/use-read-aloud'
import type { SpokenScript } from '@/components/lesson/lesson-model'
import type { PracticeBand, PracticeMode, QuestionKind, QuestionView } from './practice-types'

export const practiceBandOf = (band: PracticeBand): LearnBand => bandFromApi(band)
export const minTargetPx: Record<LearnBand, number> = { kids: 64, tweens: 48, teens: 44 }
export const speechRateFor = (band: LearnBand) => band === 'kids' ? 0.85 : 1

export const modeLabel: Record<PracticeMode, string> = { PRACTICE: 'Practice', REVIEW: 'Review', EXAM: 'Test' }
export const kindName: Record<QuestionKind, string> = {
  MCQ: 'Multiple choice', MULTI_SELECT: 'Pick all that fit', TRUE_FALSE: 'True or false', CLOZE: 'Fill in the blanks',
  MATCHING: 'Match', ORDERING: 'Put in order', SHORT_ANSWER: 'Write an answer',
}
/** One plain instruction per kind, shown under the question. */
export function kindInstruction(question: QuestionView, band: LearnBand): string {
  const kids = band === 'kids'
  switch (question.kind) {
    case 'MCQ': return kids ? 'Pick one.' : 'Choose one answer.'
    case 'TRUE_FALSE': return kids ? 'True or false?' : 'Choose true or false.'
    case 'MULTI_SELECT': return question.minSelect && question.minSelect > 1 ? `Choose at least ${question.minSelect} answers.` : 'Choose every answer that fits.'
    case 'CLOZE': return kids ? 'Fill in the blank.' : 'Fill in each blank.'
    case 'MATCHING': return kids ? 'Match each one.' : 'Match each item on the left to one on the right.'
    case 'ORDERING': return kids ? 'Put them in order.' : 'Put the items in the right order.'
    case 'SHORT_ANSWER': return 'Write your answer in your own words.'
  }
}

/* ---------- hint ladder ---------- */

/** Three rungs, named for the band. Kids get warm, plain words; nobody is told they "used up" help. */
export const hintLabels: Record<LearnBand, readonly [string, string, string]> = {
  kids: ['A little help', 'More help', 'Look at this'],
  tweens: ['Nudge', 'Hint', 'Similar example'],
  teens: ['Nudge', 'Hint', 'Similar example'],
}
/** The label of the button that opens the NEXT rung (what pressing it does). */
export function hintButtonLabel(band: LearnBand, shown: number): string {
  if (band === 'kids') return hintLabels.kids[Math.min(shown, 2)]!
  return shown === 0 ? 'Need help?' : shown >= 2 ? 'Show a similar example' : 'Show next hint'
}

/* ---------- co ---------- */

export type ItemPhase = 'question' | 'hint' | 'sending' | 'correct' | 'partial' | 'incorrect' | 'pending' | 'unavailable' | 'recorded' | 'unconfirmed'
export function coPoseFor(phase: ItemPhase): CoState {
  switch (phase) {
    case 'question': return 'asking'
    case 'hint': return 'hinting'
    case 'sending': case 'pending': case 'unconfirmed': return 'thinking'
    case 'correct': return 'celebrating'
    case 'partial': case 'incorrect': case 'unavailable': return 'encouraging'
    case 'recorded': return 'idle'
  }
}
/** Co's one short line. Kids lines stay at eight words or fewer, and none of them is sad or counts a failure. */
export function coLineFor(phase: ItemPhase, band: LearnBand, mode: PracticeMode): string {
  const kids = band === 'kids'
  switch (phase) {
    case 'question': return mode === 'EXAM' ? (kids ? 'Do your best!' : 'Take your time and do your best.') : kids ? 'You can do it!' : band === 'tweens' ? 'Take your time. Hints are free.' : 'Hints are free. Use them if you like.'
    case 'hint': return kids ? 'Here is a little help.' : 'Here is some help. No penalty.'
    case 'sending': return kids ? 'Let me look…' : 'Checking your answer…'
    case 'pending': return kids ? 'Co is checking…' : 'Co is checking your answer…'
    case 'unconfirmed': return kids ? 'Let us send that again.' : 'We need to send that again.'
    case 'correct': return kids ? 'Yes! Great job!' : 'Nice work!'
    case 'partial': return kids ? 'So close! Nearly there.' : 'You are getting there.'
    case 'incorrect': return kids ? 'Almost! Let us look again.' : 'Not quite. Let us look at it.'
    case 'unavailable': return kids ? 'Co could not check that one.' : 'Co could not check this one just now.'
    case 'recorded': return kids ? 'Got it! On to the next.' : 'Answer saved.'
  }
}

/* ---------- errors ---------- */

const byCode: Record<string, string> = {
  SESSION_NOT_FOUND: 'We could not find this practice. It may have been removed.',
  SESSION_COMPLETED: 'This practice is already finished.',
  SESSION_EXPIRED: 'The time for this test is over.',
  ITEM_OUT_OF_ORDER: 'That question is not ready yet. Let us go back to where you were.',
  ATTEMPTS_EXHAUSTED: 'You have used all the tries for this question.',
  HINT_OUT_OF_ORDER: 'Open the hints one at a time, in order.',
  HINTS_DISABLED_IN_EXAM: 'Hints are turned off during a test.',
  ANSWER_KIND_MISMATCH: 'That answer did not fit this question. Please check it and try again.',
  ANSWER_INVALID: 'That answer could not be used. Please check it and try again.',
  NO_QUESTIONS_AVAILABLE: 'There are no questions to practise right now.',
  // Codes the platform sends that the shared learn copy does not know.
  ITEM_CLOSED: 'That question is already finished. Let us go to where you were.',
  ITEM_NOT_FOUND: 'We could not find that question.',
  ATTEMPT_PENDING: 'Co is still checking your last answer. One moment.',
  ATTEMPT_CONFLICT: 'That answer did not match the one we already have. Please check it and send it again.',
  HINT_UNAVAILABLE: 'There is no hint for this question.',
  SKIP_DISABLED_IN_EXAM: 'You cannot skip questions in a timed test.',
}
export { practiceErrorCode } from '@/lib/api/practice'
export function practiceErrorText(error: unknown, fallback: string): string {
  const code = practiceErrorCode(error)
  if (code === 'POLICY_BLOCKED' && error instanceof Error) return error.message
  if (code && byCode[code]) return byCode[code]!
  return error instanceof LearnApiError || error instanceof LearnSessionError ? error.message : fallback
}
/**
 * After a failed answer: did the server definitely NOT take it, or do we not know? A typed refusal (400/403/404/409/410/422)
 * is definite. A timeout, network failure, 5xx or an unreadable reply is not: the answer may have been recorded, so the
 * same submission (same clientAttemptId) is sent again rather than a new one, and the server replays instead of duplicating.
 */
export function isUnconfirmed(error: unknown): boolean {
  // A body the client itself refused (Zod) never left the browser, and an ended learner session answers nothing.
  if (error instanceof LearnSessionError || (error instanceof Error && error.name === 'ZodError')) return false
  if (error instanceof LearnApiError) return error.status >= 500 || error.status === 408 || error.status === 429
  return true
}

/* ---------- clock ---------- */

export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60
  const two = (value: number) => String(value).padStart(2, '0')
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`
}
/** Spoken form, rounded to the minute so a screen reader is not told every second. */
export function clockLabel(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  if (seconds < 60) return seconds === 1 ? '1 second left' : `${seconds} seconds left`
  const minutes = Math.ceil(seconds / 60)
  return minutes === 1 ? '1 minute left' : `${minutes} minutes left`
}

/* ---------- read-aloud script ---------- */

export interface ScriptSegment { id: string; text: string }
/** What the device reads for a question, in reading order. Highlight ids line up with the rendered `Spoken` segments. */
export function questionSegments(question: QuestionView): ScriptSegment[] {
  const segments: ScriptSegment[] = [{ id: 'prompt', text: question.prompt }]
  switch (question.kind) {
    case 'MCQ': case 'MULTI_SELECT': question.options.forEach(option => segments.push({ id: `opt:${option.id}`, text: option.text })); break
    case 'TRUE_FALSE': segments.push({ id: 'opt:true', text: 'True' }, { id: 'opt:false', text: 'False' }); break
    case 'CLOZE': question.parts.forEach((part, index) => segments.push(part.type === 'text' ? { id: `part:${index}`, text: part.text } : { id: `blank:${part.id}`, text: 'blank' })); break
    case 'MATCHING': question.left.forEach(left => segments.push({ id: `left:${left.id}`, text: left.text })); question.right.forEach(right => segments.push({ id: `right:${right.id}`, text: right.text })); break
    case 'ORDERING': question.items.forEach(item => segments.push({ id: `item:${item.id}`, text: item.text })); break
    case 'SHORT_ANSWER': break
  }
  return segments
}
export function buildPracticeScript(raw: readonly ScriptSegment[]): SpokenScript {
  let start = 0
  const segments: SpokenScript['segments'] = []
  for (const item of raw) {
    const words = speechWords(item.text)
    if (words.length === 0) continue
    segments.push({ id: item.id, words, start })
    start += words.length
  }
  return { text: segments.flatMap(segment => segment.words).join(' '), segments, starts: Object.fromEntries(segments.map(segment => [segment.id, segment.start])) }
}

/** Sentence lengths the band promises (words); used by tests and the dev fixtures, never to rewrite server text. */
export const sentenceLimit: Record<PracticeBand, number> = { '6-9': 8, '10-13': 20, '14-17': 30 }
