import { beforeEach, describe, expect, it } from 'vitest'
import { formatTutorDate, formatTutorTimestamp, computeCountdown } from '@/lib/tutor-loop/date'
import { buildHrefWithGoal, getSharedGoalId, hydrateSharedGoalId, resetSharedGoalIdForTests, setSharedGoalId } from '@/lib/tutor-loop/goal-filter'
import { TutorLoopApiError, isTutorLoopApiError, tutorLoopClient, setTutorLoopFixtureMode } from '@/lib/api/tutor-loop/client'
import { TutorLoopApiError as ProfileError } from '@/lib/api/tutor-loop/profile'
import { groupPlanTopics } from '@/components/tutor-loop/learn/plan-state'
import { searchHitHref } from '@/components/tutor-loop/search/search-overlay'
import { materialStatusView, listTutorLibrary, libraryListSchema } from '@/lib/api/tutor-loop/library'
import { searchTutor } from '@/lib/api/tutor-loop/search'
import { getTutorFixture } from '@/lib/api/tutor-loop/fixtures'

describe('W5 shared pieces', () => {
  beforeEach(() => resetSharedGoalIdForTests())

  it('formats dates as "2 Mar 2027" without timezone drift', () => {
    expect(formatTutorDate('2027-03-02')).toBe('2 Mar 2027')
    expect(formatTutorDate('2027-03-02', { includeYear: false })).toBe('2 Mar')
    expect(formatTutorTimestamp('2026-11-13T23:30:00Z')).toBe('13 Nov 2026')
    expect(computeCountdown('2026-11-20', '2026-11-13')?.shortLabel).toBe('7 days')
  })

  it('keeps the selected goal in the store, the URL and session storage', () => {
    expect(buildHrefWithGoal('/learn?tab=plan', 'goal-1234567')).toBe('/learn?tab=plan&goalId=goal-1234567')
    setSharedGoalId('goal-1234567')
    expect(window.sessionStorage.getItem('colearner.tutor.selected-goal')).toBe('goal-1234567')
    // a fresh page load restores it
    resetSharedGoalIdForTests()
    window.sessionStorage.setItem('colearner.tutor.selected-goal', 'goal-7654321')
    hydrateSharedGoalId()
    expect(getSharedGoalId()).toBe('goal-7654321')
    setSharedGoalId(null)
    expect(window.sessionStorage.getItem('colearner.tutor.selected-goal')).toBeNull()
  })

  it('treats W1 and W5 TutorLoopApiError as the same family', () => {
    expect(new ProfileError(503, 'AI_UNAVAILABLE', 'x') instanceof TutorLoopApiError).toBe(true)
    expect(isTutorLoopApiError(new TutorLoopApiError(404, 'x'))).toBe(true)
    expect(isTutorLoopApiError(new Error('x'))).toBe(false)
  })

  it('groups plan topics by subject and status and filters by text', () => {
    const plans = getTutorFixture('plans').items as never
    const bySubject = groupPlanTopics(plans, 'SUBJECT', '')
    expect(bySubject[0]?.title).toBe('Chemistry')
    expect(groupPlanTopics(plans, 'STATUS', '')[0]?.title).toBe('Practising')
    expect(groupPlanTopics(plans, 'SUBJECT', 'zzz')).toEqual([])
  })

  it('maps search targets to routes without learner text', () => {
    expect(searchHitHref({ id: '1', kind: 'MATERIAL', title: 't', target: { kind: 'MATERIAL', materialId: 'abc' } })).toBe('/learn/library/abc')
    expect(searchHitHref({ id: '1', kind: 'CHAT', title: 't', target: { kind: 'TUTOR_SESSION', sessionId: 's1' } })).toBe('/learn/co/s1')
    expect(searchHitHref({ id: '1', kind: 'TOPIC', title: 't', target: { kind: 'PLAN_TOPIC', planId: 'p1', topicId: 't1' } })).toContain('/learn/co?')
  })

  it('accepts the contract library and search fixtures through the typed client', async () => {
    expect(libraryListSchema.safeParse(getTutorFixture('library')).success).toBe(true)
    setTutorLoopFixtureMode(true)
    try {
      expect((await listTutorLibrary()).total).toBe(1)
      expect((await searchTutor({ q: 'acid' })).items[0]?.kind).toBe('TOPIC')
      expect((await tutorLoopClient.plans()).items).toHaveLength(1)
    } finally { setTutorLoopFixtureMode(null) }
    expect(materialStatusView('PROCESSING')).toBe('processing')
    expect(materialStatusView('ready')).toBe('ready')
    expect(materialStatusView('FAILED')).toBe('failed')
  })
})
