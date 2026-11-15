import { describe, expect, it, vi } from 'vitest'
import {
  buildTutorHref,
  openTutor,
  parseTutorContextFromSearchParams,
  resolveReturnToTarget,
} from '@/lib/tutor-loop/open-tutor'
import {
  tutorContextResponseSchema,
  tutorSessionDetailSchema,
  tutorSessionListSchema,
  tutorTurnSchema,
  nudgeListSchema,
  materialProposalsSchema,
} from '@/lib/api/tutor-loop/co'
import { getTutorFixture } from '@/lib/api/tutor-loop/fixtures'

describe('W3 open-tutor helper', () => {
  it('round-trips every closed descriptor through the URL', () => {
    const contexts = [
      { kind: 'PLAN_TOPIC', planId: 'p1', topicId: 't1' },
      { kind: 'MATERIAL', materialId: 'm1', passageRef: 'ps-2' },
      { kind: 'LESSON', lessonId: 'l1', stepIndex: 2 },
      { kind: 'PRACTICE_RESULT', sessionId: 's1', attemptId: 'a1' },
      { kind: 'MOCK_RESULT', sessionId: 's1' },
      { kind: 'HOMEWORK', homeworkSessionId: 'h1' },
      { kind: 'TEACH_BACK', sessionId: 's2' },
    ] as const
    for (const context of contexts) {
      const href = buildTutorHref(context, { mode: 'EXPLAIN' })
      const params = new URL(href, 'http://x').searchParams
      expect(parseTutorContextFromSearchParams(params)).toEqual({ context, mode: 'EXPLAIN' })
    }
  })
  it('never carries URLs or free text; bad ids degrade to GLOBAL', () => {
    expect(buildTutorHref({ kind: 'MATERIAL', materialId: 'https://evil.example/x' })).toBe('/learn/co')
    expect(parseTutorContextFromSearchParams(new URLSearchParams('kind=MATERIAL&materialId=a b'))).toEqual({
      context: { kind: 'GLOBAL' },
    })
  })
  it('uses the router and returns the href', () => {
    const push = vi.fn()
    const href = openTutor({ kind: 'GLOBAL' }, { router: { push }, sessionId: 's9' })
    expect(href).toBe('/learn/co/s9')
    expect(push).toHaveBeenCalledWith('/learn/co/s9')
  })
  it('resolves return targets to internal routes only', () => {
    expect(resolveReturnToTarget({ kind: 'MOCK_RESULT', sessionId: 's1' })?.href).toBe('/learn/practice/mock/s1/result')
    expect(resolveReturnToTarget({ kind: 'GLOBAL' })).toBeNull()
  })
})

describe('W3 contract fixtures parse with the typed client schemas', () => {
  it.each([
    ['tutorContext', tutorContextResponseSchema],
    ['tutorSessions', tutorSessionListSchema],
    ['tutorSession', tutorSessionDetailSchema],
    ['tutorTurnQueued', tutorTurnSchema],
    ['tutorTurnReady', tutorTurnSchema],
    ['nudges', nudgeListSchema],
    ['materialProposals', materialProposalsSchema],
  ] as const)('%s', (key, schema) => {
    expect(schema.safeParse(getTutorFixture(key)).success).toBe(true)
  })
})
