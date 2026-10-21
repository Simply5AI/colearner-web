import { describe, expect, it } from 'vitest'
import { allKinds, apiBandFor, fixtureQuestions, learnerTexts, learnerView, longestSentenceWords, practiceBands, servedKinds } from '@/components/practice/session/dev/practice-fixtures'
import { createPracticeMock, scoreAnswer } from '@/components/practice/session/dev/practice-mock'
import { buildPracticeScript, clockLabel, coLineFor, formatClock, hintButtonLabel, hintLabels, kindInstruction, questionSegments, sentenceLimit, type ItemPhase } from '@/components/practice/session/session-model'
import { leaksQuestionKey, questionViewSchema } from '@/lib/api/practice'

describe('fixtures: every kind x band, within the band sentence limits, with no key in the learner payload', () => {
  it.each(practiceBands)('%s has all seven kinds and respects the sentence limit', band => {
    const questions = fixtureQuestions(band)
    expect(questions.map(question => question.kind).sort()).toEqual([...allKinds].sort())
    const limit = sentenceLimit[apiBandFor(band)]
    for (const question of questions) {
      for (const text of learnerTexts(question)) expect(longestSentenceWords(text), `${band} ${question.kind}: "${text}"`).toBeLessThanOrEqual(limit)
      expect(question.hints).toHaveLength(3)
    }
  })
  it.each(practiceBands)('%s learner views carry no key, hint or explanation and pass the contract schema', band => {
    for (const question of fixtureQuestions(band)) {
      const view = learnerView(question, 0, 1, { attemptsAllowed: 3, hintsAvailable: 3 })
      expect(leaksQuestionKey(view)).toBe(false)
      expect(JSON.stringify(view)).not.toContain(question.explanation)
      for (const hint of question.hints) expect(JSON.stringify(view)).not.toContain(hint)
      expect(questionViewSchema.safeParse(view).success, `${band} ${question.kind}`).toBe(true)
    }
  })
  it('the server serves kids only the kinds the band rules allow', () => {
    expect(servedKinds.kids).not.toContain('SHORT_ANSWER')
    expect(servedKinds.kids).not.toContain('MULTI_SELECT')
    expect(servedKinds.tweens).not.toContain('SHORT_ANSWER')
    expect(servedKinds.teens).toContain('SHORT_ANSWER')
  })
})

describe('the contract mock scores like CoLearner (so the UI tests mean something)', () => {
  const key = (band: 'tweens' | 'teens', kind: string) => fixtureQuestions(band).find(question => question.kind === kind)!.key
  it('MCQ / TRUE_FALSE', () => {
    expect(scoreAnswer(key('tweens', 'MCQ'), { kind: 'MCQ', optionId: 'a' })).toBe(1)
    expect(scoreAnswer(key('tweens', 'MCQ'), { kind: 'MCQ', optionId: 'b' })).toBe(0)
    expect(scoreAnswer(key('tweens', 'TRUE_FALSE'), { kind: 'TRUE_FALSE', value: false })).toBe(1)
  })
  it('MULTI_SELECT is max(0, (right - wrong) / total)', () => {
    expect(scoreAnswer(key('tweens', 'MULTI_SELECT'), { kind: 'MULTI_SELECT', optionIds: ['a', 'b', 'd'] })).toBe(1)
    expect(scoreAnswer(key('tweens', 'MULTI_SELECT'), { kind: 'MULTI_SELECT', optionIds: ['a', 'b'] })).toBeCloseTo(2 / 3)
    expect(scoreAnswer(key('tweens', 'MULTI_SELECT'), { kind: 'MULTI_SELECT', optionIds: ['c'] })).toBe(0)
  })
  it('CLOZE, MATCHING and ORDERING give partial credit', () => {
    expect(scoreAnswer(key('tweens', 'CLOZE'), { kind: 'CLOZE', blanks: [{ blankId: 'b1', value: ' Numerator' }, { blankId: 'b2', value: 'whole' }] })).toBe(0.5)
    expect(scoreAnswer(key('tweens', 'MATCHING'), { kind: 'MATCHING', pairs: [{ leftId: 'half', rightId: 'h' }, { leftId: 'quarter', rightId: 't' }, { leftId: 'three', rightId: 'q' }] })).toBeCloseTo(1 / 3)
    expect(scoreAnswer(key('tweens', 'ORDERING'), { kind: 'ORDERING', order: ['e', 'q', 't', 'h'] })).toBe(0.5)
  })
  it('written answers are not scored by the web mock until Co has checked them', () => {
    expect(scoreAnswer(key('teens', 'SHORT_ANSWER'), { kind: 'SHORT_ANSWER', text: 'salt and water' })).toBeNull()
  })
  it('replay returns the stored attempt, hints are sequential, EXAM refuses hints', () => {
    const mock = createPracticeMock({ band: 'tweens', kinds: ['MCQ'] })
    const base = '/api/learn/practice/sessions/session-fixture/items/0'
    const body = { clientAttemptId: 'client-attempt-1', answer: { kind: 'MCQ', optionId: 'b' }, timeSpentMs: 10 }
    const first = mock.handle('POST', `${base}/answer`, body).body as { data: { replay: boolean; attempt: { id: string } } }
    const again = mock.handle('POST', `${base}/answer`, body).body as { data: { replay: boolean; attempt: { id: string } } }
    expect(first.data.replay).toBe(false)
    expect(again.data.replay).toBe(true)
    expect(again.data.attempt.id).toBe(first.data.attempt.id)
    expect(mock.attempts[0]).toHaveLength(1)
    expect(mock.handle('POST', `${base}/hint`, { level: 2 }).status).toBe(409)
    expect(mock.handle('POST', `${base}/hint`, { level: 1 }).status).toBe(200)
    expect(mock.handle('POST', `${base}/hint`, { level: 2 }).status).toBe(200)
    const exam = createPracticeMock({ band: 'tweens', kinds: ['MCQ'], mode: 'EXAM' })
    expect(exam.handle('POST', `${base}/hint`, { level: 1 }).status).toBe(409)
  })
})

describe('copy and helpers', () => {
  it('hint rungs are named for the band', () => {
    expect(hintLabels.kids).toEqual(['A little help', 'More help', 'Look at this'])
    expect(hintLabels.tweens).toEqual(['Nudge', 'Hint', 'Similar example'])
    expect([0, 1, 2].map(shown => hintButtonLabel('kids', shown))).toEqual(['A little help', 'More help', 'Look at this'])
    expect(hintButtonLabel('teens', 0)).toBe('Need help?')
    expect(hintButtonLabel('teens', 1)).toBe('Show next hint')
    expect(hintButtonLabel('teens', 2)).toBe('Show a similar example')
  })
  it('kids lines are at most eight words, never sad, never a count of failures', () => {
    const phases: ItemPhase[] = ['question', 'hint', 'sending', 'correct', 'partial', 'incorrect', 'pending', 'unavailable', 'recorded', 'unconfirmed']
    for (const phase of phases) {
      const line = coLineFor(phase, 'kids', 'PRACTICE')
      expect(longestSentenceWords(line), `${phase}: ${line}`).toBeLessThanOrEqual(8)
      expect(line).not.toMatch(/wrong|fail|sad|mistake|lost|bad|\d/i)
    }
  })
  it('formats the clock and a coarse spoken label', () => {
    expect(formatClock(75)).toBe('01:15')
    expect(formatClock(3725)).toBe('1:02:05')
    expect(formatClock(-4)).toBe('00:00')
    expect(clockLabel(300)).toBe('5 minutes left')
    expect(clockLabel(61)).toBe('2 minutes left')
    expect(clockLabel(45)).toBe('45 seconds left')
  })
  it('read-aloud scripts follow reading order and word indexes line up', () => {
    const question = learnerView(fixtureQuestions('kids')[0]!, 0, 1, { attemptsAllowed: 3, hintsAvailable: 3 })
    const script = buildPracticeScript(questionSegments(question))
    expect(script.text.startsWith('Which part drinks water?')).toBe(true)
    expect(script.starts.prompt).toBe(0)
    expect(script.starts['opt:roots']).toBeGreaterThan(0)
    expect(script.segments.reduce((sum, segment) => sum + segment.words.length, 0)).toBe(script.text.split(' ').length)
  })
  it('instructions exist for every kind', () => {
    for (const question of fixtureQuestions('tweens')) expect(kindInstruction(learnerView(question, 0, 1, { attemptsAllowed: 3, hintsAvailable: 3 }), 'tweens').length).toBeGreaterThan(3)
  })
})
