import { describe, expect, it } from 'vitest'
import { answerProblem, answersEqual, buildAnswer, draftFromAnswer, initialDraft, isAnswerReady, type Draft } from '@/components/practice/questions/answers'
import { matchPair } from '@/components/practice/questions/matching-question'
import { moveItem } from '@/components/practice/questions/ordering-question'
import { learnerView, fixtureQuestion, practiceBands } from '@/components/practice/session/dev/practice-fixtures'
import { answerIssue } from '@/lib/api/practice'
import type { MatchingQuestion, QuestionKind, QuestionView } from '@/components/practice/session/practice-types'

const view = (kind: QuestionKind, band: 'kids' | 'tweens' | 'teens' = 'tweens') => learnerView(fixtureQuestion(band, kind), 0, 1, { attemptsAllowed: 3, hintsAvailable: 3 })

describe('F-L10-02 answer builders (one per kind, exactly the contract shape)', () => {
  it('MCQ: needs a pick, then sends { kind, optionId }', () => {
    const q = view('MCQ')
    expect(buildAnswer(q, initialDraft(q))).toBeNull()
    expect(answerProblem(q, initialDraft(q))).toBe('Pick one answer first.')
    expect(buildAnswer(q, { kind: 'MCQ', optionId: 'a' })).toEqual({ kind: 'MCQ', optionId: 'a' })
  })
  it('TRUE_FALSE: false is a real answer (not "nothing picked")', () => {
    const q = view('TRUE_FALSE')
    expect(buildAnswer(q, initialDraft(q))).toBeNull()
    expect(buildAnswer(q, { kind: 'TRUE_FALSE', value: false })).toEqual({ kind: 'TRUE_FALSE', value: false })
    expect(buildAnswer(q, { kind: 'TRUE_FALSE', value: true })).toEqual({ kind: 'TRUE_FALSE', value: true })
  })
  it('MULTI_SELECT: honours minSelect and sends ids in the order the options are shown', () => {
    const q = view('MULTI_SELECT')
    expect(q.kind === 'MULTI_SELECT' && q.minSelect).toBe(2)
    expect(buildAnswer(q, { kind: 'MULTI_SELECT', optionIds: ['a'] })).toBeNull()
    expect(answerProblem(q, { kind: 'MULTI_SELECT', optionIds: ['a'] })).toBe('Pick at least 2 answers first.')
    const answer = buildAnswer(q, { kind: 'MULTI_SELECT', optionIds: ['b', 'd', 'a'] })
    expect(answer).toEqual({ kind: 'MULTI_SELECT', optionIds: q.kind === 'MULTI_SELECT' ? q.options.map(o => o.id).filter(id => ['a', 'b', 'd'].includes(id)) : [] })
  })
  it('CLOZE: needs every blank; option blanks send the option id, text blanks are trimmed and cut to 80', () => {
    const q = view('CLOZE')
    expect(buildAnswer(q, { kind: 'CLOZE', values: { b1: 'numerator' } })).toBeNull()
    expect(answerProblem(q, { kind: 'CLOZE', values: { b1: '  ', b2: 'den' } })).toBe('Fill in the empty blank first.')
    expect(answerProblem(q, { kind: 'CLOZE', values: {} })).toBe('Fill in every blank first.')
    expect(buildAnswer(q, { kind: 'CLOZE', values: { b1: '  numerator ', b2: 'den' } })).toEqual({ kind: 'CLOZE', blanks: [{ blankId: 'b1', value: 'numerator' }, { blankId: 'b2', value: 'den' }] })
    const long = buildAnswer(q, { kind: 'CLOZE', values: { b1: 'x'.repeat(200), b2: 'den' } })
    expect(long && long.kind === 'CLOZE' && long.blanks[0]!.value.length).toBe(80)
  })
  it('MATCHING: every left must be matched; pairs follow the order of the left list', () => {
    const q = view('MATCHING')
    expect(buildAnswer(q, { kind: 'MATCHING', pairs: { half: 'h' } })).toBeNull()
    expect(buildAnswer(q, { kind: 'MATCHING', pairs: { three: 't', half: 'h', quarter: 'q' } })).toEqual({ kind: 'MATCHING', pairs: [{ leftId: 'half', rightId: 'h' }, { leftId: 'quarter', rightId: 'q' }, { leftId: 'three', rightId: 't' }] })
  })
  it('ORDERING: starts from the server order and sends the full order', () => {
    const q = view('ORDERING')
    const draft = initialDraft(q)
    expect(draft).toEqual({ kind: 'ORDERING', order: q.kind === 'ORDERING' ? q.items.map(i => i.id) : [] })
    expect(buildAnswer(q, draft)).toEqual({ kind: 'ORDERING', order: (draft as Extract<Draft, { kind: 'ORDERING' }>).order })
    expect(isAnswerReady(q, { kind: 'ORDERING', order: ['e'] })).toBe(false)
  })
  it('SHORT_ANSWER: trims, refuses empty and over-long text', () => {
    const q = view('SHORT_ANSWER')
    expect(buildAnswer(q, { kind: 'SHORT_ANSWER', text: '   ' })).toBeNull()
    expect(buildAnswer(q, { kind: 'SHORT_ANSWER', text: '  two of four is a half  ' })).toEqual({ kind: 'SHORT_ANSWER', text: 'two of four is a half' })
    expect(answerProblem(q, { kind: 'SHORT_ANSWER', text: 'x'.repeat(301) })).toBe('That answer is too long.')
  })
  it('a draft of another kind never becomes an answer (ANSWER_KIND_MISMATCH is prevented on the client)', () => {
    const q = view('MCQ')
    expect(buildAnswer(q, { kind: 'TRUE_FALSE', value: true })).toBeNull()
  })
  it.each(practiceBands)('every kind x %s: a complete draft passes the contract checks (answerIssue)', band => {
    for (const kind of ['MCQ', 'TRUE_FALSE', 'MULTI_SELECT', 'CLOZE', 'MATCHING', 'ORDERING', 'SHORT_ANSWER'] as QuestionKind[]) {
      const q = view(kind, band) as QuestionView
      const draft: Draft = (() => {
        switch (q.kind) {
          case 'MCQ': return { kind: 'MCQ', optionId: q.options[0]!.id }
          case 'TRUE_FALSE': return { kind: 'TRUE_FALSE', value: true }
          case 'MULTI_SELECT': return { kind: 'MULTI_SELECT', optionIds: q.options.slice(0, 2).map(o => o.id) }
          case 'CLOZE': return { kind: 'CLOZE', values: Object.fromEntries(q.parts.flatMap(p => p.type === 'blank' ? [[p.id, p.options ? p.options[0]!.id : 'word']] : [])) }
          case 'MATCHING': return { kind: 'MATCHING', pairs: Object.fromEntries(q.left.map((l, i) => [l.id, q.right[i]!.id])) }
          case 'ORDERING': return initialDraft(q)
          case 'SHORT_ANSWER': return { kind: 'SHORT_ANSWER', text: 'an answer' }
        }
      })()
      const answer = buildAnswer(q, draft)
      expect(answer, `${band} ${kind}`).not.toBeNull()
      expect(answer!.kind).toBe(q.kind)
      expect(answerIssue(q, answer!), `${band} ${kind}`).toBeNull()
    }
  })
})

describe('draft round trip and answer equality', () => {
  it('rebuilds the draft from a stored answer', () => {
    const q = view('CLOZE')
    const answer = { kind: 'CLOZE' as const, blanks: [{ blankId: 'b1', value: 'numerator' }, { blankId: 'b2', value: 'den' }] }
    const draft = draftFromAnswer(q, answer)!
    expect(buildAnswer(q, draft)).toEqual(answer)
    expect(draftFromAnswer(q, { kind: 'MCQ', optionId: 'a' })).toBeNull()
  })
  it('compares answers structurally (multi-select order does not matter, ordering order does)', () => {
    expect(answersEqual({ kind: 'MULTI_SELECT', optionIds: ['a', 'b'] }, { kind: 'MULTI_SELECT', optionIds: ['b', 'a'] })).toBe(true)
    expect(answersEqual({ kind: 'ORDERING', order: ['a', 'b'] }, { kind: 'ORDERING', order: ['b', 'a'] })).toBe(false)
    expect(answersEqual({ kind: 'MCQ', optionId: 'a' }, { kind: 'TRUE_FALSE', value: true })).toBe(false)
  })
})

describe('pure interaction helpers', () => {
  it('moveItem moves one entry and clamps', () => {
    expect(moveItem(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b'])
    expect(moveItem(['a', 'b', 'c'], 'a', 1)).toEqual(['b', 'a', 'c'])
    expect(moveItem(['a', 'b', 'c'], 'a', -3)).toEqual(['a', 'b', 'c'])
    expect(moveItem(['a', 'b', 'c'], 'b', 9)).toEqual(['a', 'c', 'b'])
    expect(moveItem(['a', 'b'], 'zzz', 0)).toEqual(['a', 'b'])
  })
  it('matchPair keeps a right item on one left only and says what moved', () => {
    const q = view('MATCHING') as MatchingQuestion
    const first = matchPair(q, {}, 'half', 'h')
    expect(first.pairs).toEqual({ half: 'h' })
    const taken = matchPair(q, first.pairs, 'quarter', 'h')
    expect(taken.pairs).toEqual({ quarter: 'h' })
    expect(taken.message).toContain('1/2 needs a new match')
    expect(matchPair(q, {}, 'nope', 'h').pairs).toEqual({})
  })
})
