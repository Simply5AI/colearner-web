import { describe, expect, it } from 'vitest'
import { formatClock, generationFailureCopy, mockResultSchema, mockSittingSchema, secondsLeft, toMockQuestionView, shortLessonSchema, examPrepSchema } from '@/lib/api/tutor-loop/practice'
import { getTutorFixture } from '@/lib/api/tutor-loop/fixtures'

describe('W4 practice client', () => {
  it('parses the contract fixtures', () => {
    expect(mockSittingSchema.safeParse(getTutorFixture('mockSitting')).success).toBe(true)
    expect(mockResultSchema.safeParse(getTutorFixture('mockResult')).success).toBe(true)
    expect(mockResultSchema.safeParse(getTutorFixture('mockResultAwaiting')).success).toBe(true)
    expect(shortLessonSchema.safeParse(getTutorFixture('shortLessonReady')).success).toBe(true)
    expect(examPrepSchema.safeParse(getTutorFixture('examPrep')).success).toBe(true)
  })
  it('counts the clock from the server reading, not the device', () => {
    const s = { deadlineAt: '2026-11-13T09:15:00Z', serverNow: '2026-11-13T09:00:00Z' }
    expect(secondsLeft(s, 0)).toBe(900)
    expect(secondsLeft(s, 61_000)).toBe(839)
    expect(secondsLeft(s, 2_000_000)).toBe(0)
    expect(secondsLeft({ deadlineAt: null, serverNow: s.serverNow }, 0)).toBeNull()
    expect(formatClock(839)).toBe('13:59')
  })
  it('never shows raw model text for a failure', () => {
    expect(generationFailureCopy('AI_UNAVAILABLE')).toMatch(/resting/)
    expect(generationFailureCopy('weird provider stack trace')).toBe('Those questions could not be made. Try again.')
  })
  it('fills player fields for a mock question', () => {
    const raw = getTutorFixture('mockItem').question
    const v = toMockQuestionView(raw as never, 0, 'item-1') as unknown as { hintsAvailable: number; attemptsAllowed: number; kind: string }
    expect(v.hintsAvailable).toBe(0)
    expect(v.attemptsAllowed).toBe(1)
    expect(v.kind).toBe('MCQ')
  })
})
