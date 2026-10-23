import { describe, expect, it } from 'vitest'
import { FIXTURE_LESSON } from '@/app/dev/teacher/plans/mock-server'
import {
  lessonCheckResultSchema, lintLesson, longestSentence, newLesson, newStep, studentLessonViewSchema, teacherLessonContentSchema, validateLesson, withKind,
  type StudentLessonView, type TeacherLessonContent,
} from '@/lib/api/teaching/lesson-schema'
import { normaliseLesson } from '@/components/teacher/plans/lesson-draft'

const clone = <T,>(value: T): T => structuredClone(value)
const learnerView = (): StudentLessonView => ({
  schemaVersion: '1.0', title: FIXTURE_LESSON.title, objectives: FIXTURE_LESSON.objectives, keyTerms: FIXTURE_LESSON.keyTerms, locale: 'en',
  steps: FIXTURE_LESSON.steps.map(step => ({ id: step.id, kind: step.kind, title: step.title, coLine: step.coLine, blocks: step.blocks, sources: step.sources, check: step.check ? { question: step.check.question, hint: step.check.hint, options: step.check.options.map(({ id, text }) => ({ id, text })) } : null })),
})

describe('TeacherLessonContent 1.0 hard rules', () => {
  it('accepts the fixture lesson', () => { expect(validateLesson(FIXTURE_LESSON)).toEqual([]) })
  it('requires a title, an objective and a step', () => {
    const empty = newLesson('')
    const paths = validateLesson(normaliseLesson(empty)).map(issue => issue.path)
    expect(paths).toEqual(expect.arrayContaining(['title', 'objectives', 'steps[0].title']))
  })
  it('caps steps at 12, objectives at 4 and a step title at 80', () => {
    const lesson = clone(FIXTURE_LESSON)
    lesson.steps = Array.from({ length: 13 }, (_, index) => ({ ...clone(FIXTURE_LESSON.steps[0]!), id: `s${index}` }))
    expect(validateLesson(lesson).some(issue => issue.path === 'steps')).toBe(true)
    const long = clone(FIXTURE_LESSON); long.steps[0]!.title = 'x'.repeat(81); expect(validateLesson(long).some(issue => issue.path === 'steps[0].title')).toBe(true)
    const objectives = clone(FIXTURE_LESSON); objectives.objectives = ['a', 'b', 'c', 'd', 'e']; expect(validateLesson(objectives).some(issue => issue.path === 'objectives')).toBe(true)
  })
  it('a check step needs a question with 2 to 4 options and exactly one correct, and only a check step has one', () => {
    const lesson = clone(FIXTURE_LESSON)
    const check = lesson.steps.find(step => step.kind === 'CHECK')!
    check.check!.correctOptionId = 'missing'
    expect(validateLesson(lesson).some(issue => issue.path.endsWith('check.correctOptionId'))).toBe(true)
    const noCheck = clone(FIXTURE_LESSON); noCheck.steps.find(step => step.kind === 'CHECK')!.check = null
    expect(validateLesson(noCheck).some(issue => issue.path.endsWith('.check'))).toBe(true)
    const stray = clone(FIXTURE_LESSON); stray.steps[0]!.check = clone(check.check!)
    expect(validateLesson(stray).some(issue => issue.message.includes('Only a check step'))).toBe(true)
  })
  it('rejects duplicate step ids and duplicate option ids', () => {
    const lesson = clone(FIXTURE_LESSON); lesson.steps[1]!.id = lesson.steps[0]!.id
    expect(validateLesson(lesson).some(issue => issue.message.includes('unique'))).toBe(true)
    const options = clone(FIXTURE_LESSON); const step = options.steps.find(entry => entry.kind === 'CHECK')!; step.check!.options[1]!.id = step.check!.options[0]!.id
    expect(validateLesson(options).some(issue => issue.message.includes('unique'))).toBe(true)
  })
  it('limits tables to 6 columns and 8 rows with one cell per column', () => {
    const lesson = clone(FIXTURE_LESSON)
    lesson.steps[2]!.blocks = [{ type: 'TABLE', headers: ['a', 'b'], rows: [['1']] }]
    expect(validateLesson(lesson).some(issue => issue.message.includes('one cell per column'))).toBe(true)
    lesson.steps[2]!.blocks = [{ type: 'TABLE', headers: Array.from({ length: 7 }, (_, i) => `h${i}`), rows: [['1']] }]
    expect(validateLesson(lesson).length).toBeGreaterThan(0)
  })
  it('changing a step kind keeps it valid in shape', () => {
    const toCheck = withKind(newStep('EXPLAIN'), 'CHECK'); expect(toCheck.check).not.toBeNull()
    const toText = withKind(toCheck, 'RECAP'); expect(toText.check).toBeNull(); expect(toText.blocks.length).toBeGreaterThan(0)
  })
  it('blank list items and terms are scaffolding and are dropped before saving', () => {
    const lesson = clone(FIXTURE_LESSON); lesson.steps[1]!.blocks = [{ type: 'LIST', items: ['one', '  ', ''] }]; lesson.objectives.push('')
    const clean = normaliseLesson(lesson)
    expect(clean.steps[1]!.blocks[0]).toEqual({ type: 'LIST', items: ['one'] }); expect(clean.objectives).toHaveLength(2); expect(validateLesson(clean)).toEqual([])
  })
})

describe('learner view (F-T3-08): an answer key is a parse failure', () => {
  it('parses the stripped learner view', () => { expect(studentLessonViewSchema.safeParse(learnerView()).success).toBe(true) })
  it('rejects correctOptionId on a check', () => {
    const view = learnerView() as unknown as { steps: { check: Record<string, unknown> | null }[] }
    view.steps.find(step => step.check)!.check!.correctOptionId = 'opt-b'
    expect(studentLessonViewSchema.safeParse(view).success).toBe(false)
  })
  it('rejects option feedback, explanation and correctAnswer anywhere', () => {
    const withFeedback = learnerView() as unknown as { steps: { check: { options: Record<string, unknown>[] } | null }[] }
    withFeedback.steps.find(step => step.check)!.check!.options[0]!.feedback = 'The bottom number stays 8.'
    expect(studentLessonViewSchema.safeParse(withFeedback).success).toBe(false)
    const withExplanation = { ...learnerView(), explanation: 'no' }
    expect(studentLessonViewSchema.safeParse(withExplanation).success).toBe(false)
    const withStepKey = learnerView() as unknown as { steps: Record<string, unknown>[] }; withStepKey.steps[0]!.correctAnswer = 'x'
    expect(studentLessonViewSchema.safeParse(withStepKey).success).toBe(false)
  })
  it('the check endpoint reveals the correct option only as a nullable id on the result', () => {
    expect(lessonCheckResultSchema.safeParse({ correct: false, feedback: 'Not quite.', correctOptionId: null }).success).toBe(true)
    expect(lessonCheckResultSchema.safeParse({ correct: true, feedback: 'Yes.', correctOptionId: 'opt-b' }).success).toBe(true)
    expect(lessonCheckResultSchema.safeParse({ correct: true, feedback: 'Yes.', correctOptionId: 'opt-b', explanation: 'x' }).success).toBe(false)
  })
  it('the owner schema still carries the key (only the owner receives it)', () => { expect(teacherLessonContentSchema.safeParse(FIXTURE_LESSON).success).toBe(true) })
})

describe('band lint (deterministic, never blocks)', () => {
  it('measures the longest sentence in words', () => { expect(longestSentence('One two three. Four five six seven eight!')).toBe(5) })
  it('flags long sentences per band and tables outside 14-17', () => {
    const lesson: TeacherLessonContent = clone(FIXTURE_LESSON)
    const kids = lintLesson(lesson, '6-9'); const tweens = lintLesson(lesson, '10-13'); const teens = lintLesson(lesson, '14-17')
    expect(kids.some(issue => issue.rule === 'SENTENCE_LENGTH')).toBe(true)
    expect(kids.some(issue => issue.rule === 'TABLE_BAND')).toBe(true)
    expect(tweens.some(issue => issue.rule === 'TABLE_BAND')).toBe(true)
    expect(teens.some(issue => issue.rule === 'TABLE_BAND')).toBe(false)
    expect(kids.length).toBeGreaterThan(tweens.length - 1)
  })
  it('lint is advisory: a lesson with lint issues is still valid to save', () => { expect(lintLesson(FIXTURE_LESSON, '6-9').length).toBeGreaterThan(0); expect(validateLesson(FIXTURE_LESSON)).toEqual([]) })
})
