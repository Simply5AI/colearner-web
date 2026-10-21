import type { PracticeAnswer, QuestionView } from '../session/practice-types'

/*
 * Answer drafts and builders for the seven question kinds. A draft is what the learner has done so far; an answer
 * (PracticeAnswer) is only produced when the draft is complete. Nothing here knows whether an answer is right:
 * correctness comes from the server's receipt and nowhere else.
 */
export type Draft =
  | { kind: 'MCQ'; optionId: string | null }
  | { kind: 'TRUE_FALSE'; value: boolean | null }
  | { kind: 'MULTI_SELECT'; optionIds: string[] }
  | { kind: 'CLOZE'; values: Record<string, string> }
  /** leftId -> rightId; a left with no entry is not matched yet. */
  | { kind: 'MATCHING'; pairs: Record<string, string> }
  | { kind: 'ORDERING'; order: string[] }
  | { kind: 'SHORT_ANSWER'; text: string }

export const CLOZE_TEXT_MAX = 80
export const SHORT_ANSWER_DEFAULT_MAX = 1000

export function initialDraft(question: QuestionView): Draft {
  switch (question.kind) {
    case 'MCQ': return { kind: 'MCQ', optionId: null }
    case 'TRUE_FALSE': return { kind: 'TRUE_FALSE', value: null }
    case 'MULTI_SELECT': return { kind: 'MULTI_SELECT', optionIds: [] }
    case 'CLOZE': return { kind: 'CLOZE', values: {} }
    case 'MATCHING': return { kind: 'MATCHING', pairs: {} }
    // The server shuffles the items; the learner starts from that order.
    case 'ORDERING': return { kind: 'ORDERING', order: question.items.map(item => item.id) }
    case 'SHORT_ANSWER': return { kind: 'SHORT_ANSWER', text: '' }
  }
}

export const clozeBlanks = (question: Extract<QuestionView, { kind: 'CLOZE' }>) => question.parts.flatMap(part => part.type === 'blank' ? [part] : [])
export const shortAnswerMax = (question: Extract<QuestionView, { kind: 'SHORT_ANSWER' }>) => Math.min(question.maxChars || SHORT_ANSWER_DEFAULT_MAX, SHORT_ANSWER_DEFAULT_MAX * 5)
export const minimumSelection = (question: Extract<QuestionView, { kind: 'MULTI_SELECT' }>) => Math.max(1, question.minSelect ?? 1)

/** Why the draft cannot be sent yet (a plain sentence for the learner), or null when it can. */
export function answerProblem(question: QuestionView, draft: Draft): string | null {
  if (draft.kind !== question.kind) return 'This answer does not match the question.'
  switch (question.kind) {
    case 'MCQ': return (draft as Extract<Draft, { kind: 'MCQ' }>).optionId ? null : 'Pick one answer first.'
    case 'TRUE_FALSE': return (draft as Extract<Draft, { kind: 'TRUE_FALSE' }>).value === null ? 'Pick true or false first.' : null
    case 'MULTI_SELECT': {
      const needed = minimumSelection(question)
      return (draft as Extract<Draft, { kind: 'MULTI_SELECT' }>).optionIds.length >= needed ? null : needed > 1 ? `Pick at least ${needed} answers first.` : 'Pick at least one answer first.'
    }
    case 'CLOZE': {
      const values = (draft as Extract<Draft, { kind: 'CLOZE' }>).values
      const empty = clozeBlanks(question).filter(blank => !(values[blank.id] ?? '').trim()).length
      return empty === 0 ? null : empty === 1 ? 'Fill in the empty blank first.' : 'Fill in every blank first.'
    }
    case 'MATCHING': {
      const pairs = (draft as Extract<Draft, { kind: 'MATCHING' }>).pairs
      return question.left.every(left => !!pairs[left.id]) ? null : 'Match every item first.'
    }
    case 'ORDERING': {
      const order = (draft as Extract<Draft, { kind: 'ORDERING' }>).order
      const ids = new Set(question.items.map(item => item.id))
      return order.length === ids.size && order.every(entry => ids.has(entry)) && new Set(order).size === order.length ? null : 'Put every item in order first.'
    }
    case 'SHORT_ANSWER': {
      const value = (draft as Extract<Draft, { kind: 'SHORT_ANSWER' }>).text
      if (!value.trim()) return 'Write your answer first.'
      return value.length > shortAnswerMax(question) ? 'That answer is too long.' : null
    }
  }
}
export const isAnswerReady = (question: QuestionView, draft: Draft) => answerProblem(question, draft) === null

/** Builds the PracticeAnswer for the contract, or null when the draft is not complete. The answer `kind` always equals the item's kind. */
export function buildAnswer(question: QuestionView, draft: Draft): PracticeAnswer | null {
  if (answerProblem(question, draft) !== null) return null
  switch (question.kind) {
    case 'MCQ': return { kind: 'MCQ', optionId: (draft as Extract<Draft, { kind: 'MCQ' }>).optionId! }
    case 'TRUE_FALSE': return { kind: 'TRUE_FALSE', value: (draft as Extract<Draft, { kind: 'TRUE_FALSE' }>).value! }
    // Option order from the server is irrelevant to the answer, so the ids go in the order the options are shown.
    case 'MULTI_SELECT': { const picked = new Set((draft as Extract<Draft, { kind: 'MULTI_SELECT' }>).optionIds); return { kind: 'MULTI_SELECT', optionIds: question.options.filter(option => picked.has(option.id)).map(option => option.id) } }
    case 'CLOZE': {
      const values = (draft as Extract<Draft, { kind: 'CLOZE' }>).values
      return { kind: 'CLOZE', blanks: clozeBlanks(question).map(blank => ({ blankId: blank.id, value: blank.options ? values[blank.id]! : values[blank.id]!.trim().slice(0, CLOZE_TEXT_MAX) })) }
    }
    case 'MATCHING': { const pairs = (draft as Extract<Draft, { kind: 'MATCHING' }>).pairs; return { kind: 'MATCHING', pairs: question.left.map(left => ({ leftId: left.id, rightId: pairs[left.id]! })) } }
    case 'ORDERING': return { kind: 'ORDERING', order: [...(draft as Extract<Draft, { kind: 'ORDERING' }>).order] }
    case 'SHORT_ANSWER': return { kind: 'SHORT_ANSWER', text: (draft as Extract<Draft, { kind: 'SHORT_ANSWER' }>).text.trim() }
  }
}

/** Rebuilds a draft from a stored answer (a submission restored after a refresh). Returns null when it no longer fits the question. */
export function draftFromAnswer(question: QuestionView, answer: PracticeAnswer): Draft | null {
  if (answer.kind !== question.kind) return null
  switch (answer.kind) {
    case 'MCQ': return { kind: 'MCQ', optionId: answer.optionId }
    case 'TRUE_FALSE': return { kind: 'TRUE_FALSE', value: answer.value }
    case 'MULTI_SELECT': return { kind: 'MULTI_SELECT', optionIds: [...answer.optionIds] }
    case 'CLOZE': return { kind: 'CLOZE', values: Object.fromEntries(answer.blanks.map(blank => [blank.blankId, blank.value])) }
    case 'MATCHING': return { kind: 'MATCHING', pairs: Object.fromEntries(answer.pairs.map(pair => [pair.leftId, pair.rightId])) }
    case 'ORDERING': return { kind: 'ORDERING', order: [...answer.order] }
    case 'SHORT_ANSWER': return { kind: 'SHORT_ANSWER', text: answer.text }
  }
}

const sorted = (values: readonly string[]) => [...values].sort()
/** Structural equality of two answers; the order of a multi-select or of matching pairs does not matter, ordering does. */
export function answersEqual(a: PracticeAnswer, b: PracticeAnswer): boolean {
  if (a.kind !== b.kind) return false
  switch (a.kind) {
    case 'MCQ': return a.optionId === (b as typeof a).optionId
    case 'TRUE_FALSE': return a.value === (b as typeof a).value
    case 'MULTI_SELECT': return JSON.stringify(sorted(a.optionIds)) === JSON.stringify(sorted((b as typeof a).optionIds))
    case 'CLOZE': return JSON.stringify([...a.blanks].sort((x, y) => x.blankId.localeCompare(y.blankId))) === JSON.stringify([...(b as typeof a).blanks].sort((x, y) => x.blankId.localeCompare(y.blankId)))
    case 'MATCHING': return JSON.stringify([...a.pairs].sort((x, y) => x.leftId.localeCompare(y.leftId))) === JSON.stringify([...(b as typeof a).pairs].sort((x, y) => x.leftId.localeCompare(y.leftId)))
    case 'ORDERING': return JSON.stringify(a.order) === JSON.stringify((b as typeof a).order)
    case 'SHORT_ANSWER': return a.text === (b as typeof a).text
  }
}
