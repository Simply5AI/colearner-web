import { describe, expect, it } from 'vitest'
import { describeRevealed, multiChoiceState, parseRevealed, singleChoiceState, blankState, pairState, positionState, type ItemMarks } from '@/components/practice/questions/marks'
import { canTryAgain, marksFor, receiptPhase, revealedFor, visibleResult } from '@/components/practice/session/receipt-model'
import { fixtureQuestion, learnerView } from '@/components/practice/session/dev/practice-fixtures'
import type { AnswerReceipt, PracticeMode, QuestionKind } from '@/components/practice/session/practice-types'

const q = (kind: QuestionKind) => learnerView(fixtureQuestion('tweens', kind), 0, 1, { attemptsAllowed: 3, hintsAvailable: 3 })
type Result = NonNullable<AnswerReceipt['result']>
const result = (patch: Partial<Result> = {}): Result => ({ correct: false, partial: false, score: 0, feedback: 'f', explanation: 'e', correctAnswerRevealed: false, revealedAnswer: null, sourceLink: null, ...patch })
const receipt = (patch: Partial<AnswerReceipt> = {}): AnswerReceipt => ({ attempt: { id: 'a1', attemptNo: 1, status: 'GRADED' }, result: result(), canRetry: true, attemptsLeft: 2, isLastItem: false, replay: false, ...patch })

describe('F-L10-06 receipt rules', () => {
  it('maps the server verdict to a phase (correct only ever from result.correct)', () => {
    expect(receiptPhase(null, 'PRACTICE')).toBeNull()
    expect(receiptPhase(receipt({ result: result({ correct: true, score: 1 }) }), 'PRACTICE')).toBe('correct')
    expect(receiptPhase(receipt({ result: result({ correct: false, partial: true, score: 0.5 }) }), 'PRACTICE')).toBe('partial')
    expect(receiptPhase(receipt(), 'REVIEW')).toBe('incorrect')
    expect(receiptPhase(receipt({ attempt: { id: 'a', attemptNo: 1, status: 'PENDING_FEEDBACK' }, result: result({ correct: null }) }), 'PRACTICE')).toBe('pending')
    expect(receiptPhase(receipt({ attempt: { id: 'a', attemptNo: 1, status: 'FEEDBACK_UNAVAILABLE' }, result: result({ correct: null }) }), 'PRACTICE')).toBe('unavailable')
    expect(receiptPhase(receipt({ attempt: { id: 'a', attemptNo: 1, status: 'RECORDED' }, result: null }), 'PRACTICE')).toBe('recorded')
  })
  it('EXAM shows no result at all, even if the server sent one', () => {
    const leaky = receipt({ result: result({ correct: true, score: 1, correctAnswerRevealed: true, revealedAnswer: { kind: 'MCQ', optionId: 'a' } }) })
    expect(receiptPhase(leaky, 'EXAM')).toBe('recorded')
    expect(visibleResult(leaky, 'EXAM')).toBeNull()
    expect(revealedFor(q('MCQ'), leaky, 'EXAM')).toBeNull()
    expect(marksFor(q('MCQ'), leaky, 'EXAM')).toBeNull()
    expect(canTryAgain(receipt({ canRetry: true }), 'EXAM')).toBe(false)
  })
  it('reveals the answer only when the server says so', () => {
    const quiet = receipt({ result: result({ correctAnswerRevealed: false, revealedAnswer: { kind: 'MCQ', optionId: 'a' } }) })
    expect(revealedFor(q('MCQ'), quiet, 'PRACTICE')).toBeNull()
    const shown = receipt({ canRetry: false, attemptsLeft: 0, result: result({ correctAnswerRevealed: true, revealedAnswer: { kind: 'MCQ', optionId: 'a' } }) })
    expect(revealedFor(q('MCQ'), shown, 'PRACTICE')).toEqual({ kind: 'MCQ', optionId: 'a' })
    expect(marksFor(q('MCQ'), shown, 'PRACTICE')).toEqual({ correct: false, partial: false, revealed: { kind: 'MCQ', optionId: 'a' } })
  })
  it('a retry is offered only for PRACTICE/REVIEW, when the server allows it, after a miss', () => {
    const modes: PracticeMode[] = ['PRACTICE', 'REVIEW']
    for (const mode of modes) expect(canTryAgain(receipt({ canRetry: true }), mode)).toBe(true)
    expect(canTryAgain(receipt({ canRetry: false }), 'PRACTICE')).toBe(false)
    expect(canTryAgain(receipt({ result: result({ correct: true, score: 1 }), canRetry: true }), 'PRACTICE')).toBe(false)
    expect(canTryAgain(receipt({ attempt: { id: 'a', attemptNo: 1, status: 'PENDING_FEEDBACK' }, result: result({ correct: null }), canRetry: true }), 'PRACTICE')).toBe(false)
  })
})

describe('revealed answers are read per kind and never guessed', () => {
  it('parses each kind from the answer shape', () => {
    expect(parseRevealed(q('MCQ'), { kind: 'MCQ', optionId: 'a' })).toEqual({ kind: 'MCQ', optionId: 'a' })
    expect(parseRevealed(q('TRUE_FALSE'), { kind: 'TRUE_FALSE', value: false })).toEqual({ kind: 'TRUE_FALSE', value: false })
    expect(parseRevealed(q('MULTI_SELECT'), { optionIds: ['a', 'b'] })).toEqual({ kind: 'MULTI_SELECT', optionIds: ['a', 'b'] })
    expect(parseRevealed(q('CLOZE'), { blanks: [{ blankId: 'b1', accepted: ['numerator', 'top'] }, { blankId: 'b2', value: 'den' }] })).toEqual({ kind: 'CLOZE', accepted: { b1: ['numerator', 'top'], b2: ['den'] } })
    expect(parseRevealed(q('MATCHING'), { pairs: [{ leftId: 'half', rightId: 'h' }] })).toEqual({ kind: 'MATCHING', pairs: { half: 'h' } })
    expect(parseRevealed(q('ORDERING'), { order: ['e', 'q'] })).toEqual({ kind: 'ORDERING', order: ['e', 'q'] })
    expect(parseRevealed(q('SHORT_ANSWER'), 'A model answer.')).toEqual({ kind: 'SHORT_ANSWER', text: 'A model answer.' })
  })
  it('ignores a payload that does not fit', () => {
    expect(parseRevealed(q('MCQ'), { nonsense: 1 })).toBeNull()
    expect(parseRevealed(q('MATCHING'), { pairs: [{ leftId: 'x' }] })).toBeNull()
    expect(parseRevealed(q('CLOZE'), { blanks: [{ blankId: 'b1' }] })).toBeNull()
    expect(parseRevealed(q('MCQ'), null)).toBeNull()
  })
  it("describes the right answer from the question's own wording", () => {
    expect(describeRevealed(q('MCQ'), { kind: 'MCQ', optionId: 'a' })).toEqual(['3/4'])
    expect(describeRevealed(q('ORDERING'), { kind: 'ORDERING', order: ['e', 'q', 'h', 't'] })).toEqual(['1. 1/8', '2. 1/4', '3. 1/2', '4. 3/4'])
    expect(describeRevealed(q('MATCHING'), { kind: 'MATCHING', pairs: { half: 'h' } })).toEqual(['1/2 goes with One half'])
    expect(describeRevealed(q('CLOZE'), { kind: 'CLOZE', accepted: { b1: ['numerator'], b2: ['den'] } })).toEqual(['Blank 1: numerator', 'Blank 2: denominator'])
  })
})

describe('tile states come only from the receipt', () => {
  const miss = (revealed: ItemMarks['revealed']): ItemMarks => ({ correct: false, partial: false, revealed })
  it('single choice', () => {
    expect(singleChoiceState('a', 'a', null, [])).toBe('selected')
    expect(singleChoiceState('b', null, null, ['b'])).toBe('tried')
    expect(singleChoiceState('a', 'a', { correct: true, partial: false, revealed: null }, [])).toBe('correct')
    expect(singleChoiceState('b', 'a', miss(null), [])).toBe('idle')
    expect(singleChoiceState('a', 'a', miss(null), [])).toBe('tried') // wrong pick, answer not revealed: never marks another tile right
    expect(singleChoiceState('b', 'a', miss({ kind: 'MCQ', optionId: 'b' }), [])).toBe('correct')
    expect(singleChoiceState('a', 'a', miss({ kind: 'MCQ', optionId: 'b' }), [])).toBe('wrong')
    expect(singleChoiceState('false', 'true', miss({ kind: 'TRUE_FALSE', value: false }), [])).toBe('correct')
  })
  it('multi choice', () => {
    const revealed = miss({ kind: 'MULTI_SELECT', optionIds: ['a', 'b'] })
    expect(multiChoiceState('a', ['a', 'c'], revealed)).toBe('correct')
    expect(multiChoiceState('b', ['a', 'c'], revealed)).toBe('missed')
    expect(multiChoiceState('c', ['a', 'c'], revealed)).toBe('wrong')
    expect(multiChoiceState('a', ['a'], miss(null))).toBe('tried')
  })
  it('blanks, pairs and positions', () => {
    expect(blankState('b1', 'Numerator ', miss({ kind: 'CLOZE', accepted: { b1: ['numerator'] } }))).toBe('correct')
    expect(blankState('b1', 'top', miss({ kind: 'CLOZE', accepted: { b1: ['numerator'] } }))).toBe('wrong')
    expect(blankState('b1', 'top', miss(null))).toBe('tried')
    expect(pairState('half', 'h', miss({ kind: 'MATCHING', pairs: { half: 'h' } }))).toBe('correct')
    expect(pairState('half', 'q', miss({ kind: 'MATCHING', pairs: { half: 'h' } }))).toBe('wrong')
    expect(positionState('e', 0, miss({ kind: 'ORDERING', order: ['e', 'q'] }))).toBe('correct')
    expect(positionState('e', 1, miss({ kind: 'ORDERING', order: ['e', 'q'] }))).toBe('wrong')
  })
})
