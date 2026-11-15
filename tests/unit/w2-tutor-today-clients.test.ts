import { describe, expect, it } from 'vitest'
import { getTutorFixture } from '@/lib/api/tutor-loop/fixtures'
import {
  formatBriefingReason,
  resolveTutorActionHref,
  tutorTodayResponseSchema,
} from '@/lib/api/tutor-loop/today'
import {
  groupScheduleByDay,
  isoWeekday,
  scheduleConflictMessage,
  tutorScheduleAppliedSchema,
  tutorSchedulePreviewResponseSchema,
  tutorScheduleResponseSchema,
} from '@/lib/api/tutor-loop/schedule'
import {
  buildWeekBars,
  countTopicsByState,
  splitTrendByBlueprint,
  tutorProgressResponseSchema,
} from '@/lib/api/tutor-loop/progress'
import { summariseChanges } from '@/components/tutor-loop/schedule/schedule-tab'

describe('W2 clients accept the contract fixtures', () => {
  it('today', () => {
    const parsed = tutorTodayResponseSchema.parse(getTutorFixture('today'))
    expect(parsed.briefing.action.kind).toBe('PRACTICE')
    expect(parsed.fixedWork).toEqual([])
  })
  it('schedule, preview and applied receipt', () => {
    expect(tutorScheduleResponseSchema.parse(getTutorFixture('schedule')).pace.state).toBe('ON_TRACK')
    expect(tutorSchedulePreviewResponseSchema.parse(getTutorFixture('schedulePreview')).canApply).toBe(true)
    expect(tutorScheduleAppliedSchema.parse(getTutorFixture('scheduleApplied')).revision).toBe(3)
  })
  it('progress', () => {
    const parsed = tutorProgressResponseSchema.parse(getTutorFixture('progress'))
    expect(parsed.topics[0]?.state).toBe('PRACTICING')
    expect(countTopicsByState(parsed.topics).PRACTICING).toBe(1)
  })
  it('accepts the additive fields the API sends beyond the fixtures', () => {
    const schedule = { ...getTutorFixture('schedule'), unplacedMinutes: 20, warnings: [{ date: '2026-11-14', reasonCode: 'FIXED_OVER_CAP', minutes: 60 }], daysOff: [{ id: 'd1', startDate: '2026-11-15', endDate: '2026-11-15' }] }
    const parsed = tutorScheduleResponseSchema.parse(schedule)
    expect(parsed.unplacedMinutes).toBe(20)
    expect(parsed.warnings).toHaveLength(1)
    expect(parsed.daysOff[0]?.startDate).toBe('2026-11-15')
    const preview = tutorSchedulePreviewResponseSchema.parse({ ...getTutorFixture('schedulePreview'), changes: [{ itemId: 'a', from: '2026-11-13', to: null, reasonCode: 'UNPLACED_CAPACITY' }] })
    expect(preview.changes[0]?.to).toBeNull()
  })
})

describe('W2 pure helpers', () => {
  it('maps closed reason codes to plain wording and never shows a raw code', () => {
    expect(formatBriefingReason(['DUE_REVIEW'])).toBe('Due for review today')
    expect(formatBriefingReason(['EXAM_WEEK'])).toMatch(/Exam week/)
    expect(formatBriefingReason(['SOMETHING_NEW'])).toBe('Next in your plan')
  })
  it('sends lesson and practice targets (topic ids) to Practice with the goal', () => {
    expect(resolveTutorActionHref({ kind: 'LESSON', targetId: 't1' }, 'g1')).toBe('/learn/practice?goalId=g1&topicId=t1')
    expect(resolveTutorActionHref({ kind: 'PRACTICE', targetId: null })).toBe('/learn/practice')
    expect(resolveTutorActionHref({ kind: 'ADD_MATERIAL', targetId: null })).toBe('/learn?tab=library')
    expect(resolveTutorActionHref({ kind: 'DONE_FOR_TODAY', targetId: null })).toBe('/learn/today')
  })
  it('computes ISO weekdays and groups items by day', () => {
    expect(isoWeekday('2026-11-09')).toBe(1)
    expect(isoWeekday('2026-11-15')).toBe(7)
    const fixture = tutorScheduleResponseSchema.parse(getTutorFixture('schedule'))
    const days = groupScheduleByDay(['2026-11-13', '2026-11-14'], fixture.items, [{ startDate: '2026-11-14', endDate: '2026-11-14' }])
    expect(days[0]?.minutes).toBe(10)
    expect(days[1]).toMatchObject({ minutes: 0, dayOff: true })
  })
  it('builds seven week bars; future days have no minutes', () => {
    const dates = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']
    const bars = buildWeekBars(dates, [{ date: '2026-11-13', minutes: 10, completedActivities: 1 }], '2026-11-13')
    expect(bars.map((b) => b.minutes)).toEqual([0, 0, 0, 0, 10, null, null])
    expect(bars[5]?.future).toBe(true)
  })
  it('never joins readiness points across a changed blueprint', () => {
    const point = (date: string, blueprintRevision: string) => ({ date, blueprintRevision, percent: 50, topicsCovered: 1, topicsTotal: 2 })
    const runs = splitTrendByBlueprint([point('2026-11-01', 'v1'), point('2026-11-08', 'v1'), point('2026-11-13', 'v2')])
    expect(runs.map((r) => r.length)).toEqual([2, 1])
  })
  it('summarises a preview by day, before and after', () => {
    const schedule = tutorScheduleResponseSchema.parse(getTutorFixture('schedule'))
    const preview = tutorSchedulePreviewResponseSchema.parse(getTutorFixture('schedulePreview'))
    const { rows, outside } = summariseChanges(schedule, preview, ['2026-11-13', '2026-11-14', '2026-11-15'])
    expect(outside).toBe(0)
    expect(rows).toEqual([
      { date: '2026-11-13', before: { n: 1, min: 10 }, after: { n: 0, min: 0 } },
      { date: '2026-11-15', before: { n: 0, min: 0 }, after: { n: 1, min: 10 } },
    ])
  })
  it('has friendly copy for schedule conflict codes', () => {
    expect(scheduleConflictMessage('DAY_OFF')).toMatch(/day off/)
    expect(scheduleConflictMessage('WHATEVER')).not.toMatch(/WHATEVER/)
  })
})
