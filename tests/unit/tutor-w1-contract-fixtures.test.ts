import { describe, expect, it } from 'vitest'
import { getTutorFixture } from '@/lib/api/tutor-loop/fixtures'
import { learnerGoalSchema, learnerGoalsListSchema, planDraftJobSchema } from '@/lib/api/tutor-loop/goals'
import { tutorProfileSchema, tutorStudyPreferencesSchema } from '@/lib/api/tutor-loop/profile'

describe('W1 clients accept the contract response fixtures', () => {
  it('goals and goal', () => {
    expect(learnerGoalsListSchema.safeParse(getTutorFixture('goals')).success).toBe(true)
    expect(learnerGoalSchema.safeParse(getTutorFixture('goal')).success).toBe(true)
  })
  it('plan drafts', () => {
    expect(planDraftJobSchema.safeParse(getTutorFixture('planDraftQueued')).success).toBe(true)
    expect(planDraftJobSchema.safeParse(getTutorFixture('planDraftReady')).success).toBe(true)
  })
  it('profile and study preferences', () => {
    expect(tutorProfileSchema.safeParse(getTutorFixture('profile')).success).toBe(true)
    expect(tutorStudyPreferencesSchema.safeParse(getTutorFixture('preferences')).success).toBe(true)
  })
})
