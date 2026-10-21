import type { QuestionView } from '../session/practice-types'

/*
 * Result marks (correct / wrong / tried / missed) for the question renderers. Marks come ONLY from the server's receipt:
 * a tile is "correct" when the learner's own pick was reported correct, or when the server revealed the answer
 * (`correctAnswerRevealed`). Without either, a wrong pick is only "tried", so the right answer is never inferred.
 */
export type TileState = 'idle' | 'selected' | 'correct' | 'wrong' | 'tried' | 'missed'

export type Revealed =
  | { kind: 'MCQ'; optionId: string }
  | { kind: 'TRUE_FALSE'; value: boolean }
  | { kind: 'MULTI_SELECT'; optionIds: string[] }
  | { kind: 'CLOZE'; accepted: Record<string, string[]> }
  | { kind: 'MATCHING'; pairs: Record<string, string> }
  | { kind: 'ORDERING'; order: string[] }
  | { kind: 'SHORT_ANSWER'; text: string }

/** What the last receipt said about the answer, when it said anything. null while the learner is still answering (and always in EXAM). */
export interface ItemMarks { correct: boolean; partial: boolean; revealed: Revealed | null }

const rec = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
const strings = (value: unknown): string[] | null => Array.isArray(value) && value.every(entry => typeof entry === 'string') ? value as string[] : null

/**
 * Reads the revealed answer in the shape of the item's own kind (the contract gives it the same shape as the answer).
 * Anything that does not fit is ignored rather than guessed: a tile is never marked from a payload we cannot read.
 */
export function parseRevealed(question: QuestionView, raw: unknown): Revealed | null {
  if (raw === null || raw === undefined) return null
  const record = rec(raw)
  switch (question.kind) {
    case 'MCQ': { const id = typeof raw === 'string' ? raw : record?.optionId; return typeof id === 'string' ? { kind: 'MCQ', optionId: id } : null }
    case 'TRUE_FALSE': { const value = typeof raw === 'boolean' ? raw : record?.value; return typeof value === 'boolean' ? { kind: 'TRUE_FALSE', value } : null }
    case 'MULTI_SELECT': { const ids = strings(raw) ?? strings(record?.optionIds); return ids ? { kind: 'MULTI_SELECT', optionIds: ids } : null }
    case 'CLOZE': {
      const blanks = record?.blanks
      if (!Array.isArray(blanks)) return null
      const accepted: Record<string, string[]> = {}
      for (const entry of blanks) {
        const blank = rec(entry)
        if (!blank || typeof blank.blankId !== 'string') return null
        const list = strings(blank.accepted) ?? (typeof blank.value === 'string' ? [blank.value] : null)
        if (!list || list.length === 0) return null
        accepted[blank.blankId] = list
      }
      return { kind: 'CLOZE', accepted }
    }
    case 'MATCHING': {
      const pairs = record?.pairs
      if (!Array.isArray(pairs)) return null
      const map: Record<string, string> = {}
      for (const entry of pairs) {
        const pair = rec(entry)
        if (!pair || typeof pair.leftId !== 'string' || typeof pair.rightId !== 'string') return null
        map[pair.leftId] = pair.rightId
      }
      return { kind: 'MATCHING', pairs: map }
    }
    case 'ORDERING': { const order = strings(raw) ?? strings(record?.order); return order ? { kind: 'ORDERING', order } : null }
    case 'SHORT_ANSWER': { const value = typeof raw === 'string' ? raw : record?.text ?? record?.modelAnswer; return typeof value === 'string' && value.trim() ? { kind: 'SHORT_ANSWER', text: value } : null }
  }
}

/** Tile state for one option of a single-choice question (MCQ, or TRUE_FALSE with ids 'true' and 'false'). */
export function singleChoiceState(optionId: string, picked: string | null, marks: ItemMarks | null, tried: readonly string[]): TileState {
  const revealed = marks?.revealed
  const revealedId = revealed?.kind === 'MCQ' ? revealed.optionId : revealed?.kind === 'TRUE_FALSE' ? String(revealed.value) : null
  if (!marks) return picked === optionId ? 'selected' : tried.includes(optionId) ? 'tried' : 'idle'
  if (marks.correct) return picked === optionId ? 'correct' : 'idle'
  if (revealedId !== null) return optionId === revealedId ? 'correct' : picked === optionId ? 'wrong' : 'idle'
  return picked === optionId ? 'tried' : 'idle'
}

/** Tile state for one option of a multi-select question. */
export function multiChoiceState(optionId: string, picked: readonly string[], marks: ItemMarks | null): TileState {
  const on = picked.includes(optionId)
  if (!marks) return on ? 'selected' : 'idle'
  if (marks.correct) return on ? 'correct' : 'idle'
  if (marks.revealed?.kind === 'MULTI_SELECT') {
    const right = marks.revealed.optionIds.includes(optionId)
    return right ? (on ? 'correct' : 'missed') : on ? 'wrong' : 'idle'
  }
  return on ? 'tried' : 'idle'
}

const norm = (value: string) => value.trim().toLowerCase()
/** State of one cloze blank. `value` is what was submitted for it (an option id, or text). */
export function blankState(blankId: string, value: string, marks: ItemMarks | null): TileState {
  if (!marks) return 'idle'
  if (marks.correct) return 'correct'
  if (marks.revealed?.kind === 'CLOZE') {
    const accepted = marks.revealed.accepted[blankId]
    return accepted && accepted.some(entry => norm(entry) === norm(value)) ? 'correct' : 'wrong'
  }
  return 'tried'
}

/** State of one matching pair (by left id). */
export function pairState(leftId: string, rightId: string | undefined, marks: ItemMarks | null): TileState {
  if (!marks) return 'idle'
  if (marks.correct) return 'correct'
  if (marks.revealed?.kind === 'MATCHING') return marks.revealed.pairs[leftId] === rightId ? 'correct' : 'wrong'
  return 'tried'
}

/** State of one item of an ordering question, by the position it was placed in. */
export function positionState(itemId: string, position: number, marks: ItemMarks | null): TileState {
  if (!marks) return 'idle'
  if (marks.correct) return 'correct'
  if (marks.revealed?.kind === 'ORDERING') return marks.revealed.order[position] === itemId ? 'correct' : 'wrong'
  return 'tried'
}

/** Visible words for a mark; colour is never the only signal. null for the plain states. */
export function markText(state: TileState): string | null {
  switch (state) {
    case 'correct': return 'Right answer'
    case 'wrong': return 'Not this one'
    case 'tried': return 'You tried this one'
    case 'missed': return 'This one fits too'
    default: return null
  }
}

/**
 * The revealed answer as plain lines for the receipt ("The right answer"). Built only from the server's revealed payload
 * and the question's own wording, so nothing is invented. Returns [] when nothing can be shown.
 */
export function describeRevealed(question: QuestionView, revealed: Revealed | null): string[] {
  if (!revealed || revealed.kind !== question.kind) return []
  switch (question.kind) {
    case 'MCQ': return revealed.kind === 'MCQ' ? [question.options.find(option => option.id === revealed.optionId)?.text].filter((value): value is string => !!value) : []
    case 'TRUE_FALSE': return revealed.kind === 'TRUE_FALSE' ? [revealed.value ? 'True' : 'False'] : []
    case 'MULTI_SELECT': return revealed.kind === 'MULTI_SELECT' ? question.options.filter(option => revealed.optionIds.includes(option.id)).map(option => option.text) : []
    case 'CLOZE': {
      if (revealed.kind !== 'CLOZE') return []
      const blanks = question.parts.flatMap(part => part.type === 'blank' ? [part] : [])
      return blanks.flatMap((blank, index) => {
        const value = revealed.accepted[blank.id]?.[0]
        if (!value) return []
        return [`Blank ${index + 1}: ${blank.options?.find(option => option.id === value)?.text ?? value}`]
      })
    }
    case 'MATCHING': {
      if (revealed.kind !== 'MATCHING') return []
      return question.left.flatMap(left => { const right = question.right.find(item => item.id === revealed.pairs[left.id]); return right ? [`${left.text} goes with ${right.text}`] : [] })
    }
    case 'ORDERING': return revealed.kind === 'ORDERING' ? revealed.order.flatMap((id, index) => { const item = question.items.find(entry => entry.id === id); return item ? [`${index + 1}. ${item.text}`] : [] }) : []
    case 'SHORT_ANSWER': return revealed.kind === 'SHORT_ANSWER' ? [revealed.text] : []
  }
}
