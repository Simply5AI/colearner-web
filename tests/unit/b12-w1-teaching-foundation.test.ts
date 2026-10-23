import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/client'
import {
  TeachingApiError, classifyTeachingError, teachingPath, teachingRequest,
} from '@/lib/api/teaching/core'
import {
  assignablePlanId, createLessonTarget, parseTeachingContext, parseTeachingDashboard, teachingDashboardSchema,
} from '@/lib/api/teaching/dashboard'
import {
  DONE_COPY, doneCopy, firstTopicOf, materialTypeForFile, parseOnboardingState, planForMaterialSchema, resolveViewedStep,
  validateMaterial, validatePhoto,
} from '@/lib/api/teaching/onboarding'
import { draftToPayload, validateProfile } from '@/lib/api/teaching/profile'
import { contextFixture, dashboardFixture, planDetailFixture } from '@/components/teacher/dashboard/dev/fixtures'
import { createOnboardingMock } from '@/components/teacher/onboarding/dev/onboarding-mock'

afterEach(() => vi.unstubAllGlobals())

describe('teaching core', () => {
  it('encodes the school id into the teaching path', () => {
    expect(teachingPath('a/b', '/dashboard')).toBe('/schools/a%2Fb/teaching/dashboard')
  })

  it('sends Idempotency-Key and surfaces the server error code and revision', async () => {
    const fetchMock = vi.fn(async () => Response.json({ statusCode: 409, error: { code: 'REVISION_CONFLICT', currentRevision: 7 } }, { status: 409 }))
    vi.stubGlobal('fetch', fetchMock)
    const failure = await teachingRequest('token', 's1', '/plans', 'POST', { title: 'x' }, { 'Idempotency-Key': 'key-12345678' }).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(TeachingApiError)
    expect((failure as TeachingApiError).code).toBe('REVISION_CONFLICT')
    expect((failure as TeachingApiError).currentRevision).toBe(7)
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[0]).toContain('/schools/s1/teaching/plans')
    expect((call[1].headers as Record<string, string>)['Idempotency-Key']).toBe('key-12345678')
    expect((call[1].headers as Record<string, string>).Authorization).toBe('Bearer token')
  })

  it('unwraps the data envelope', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ statusCode: 200, data: { ok: true }, timestamp: 'x' })))
    await expect(teachingRequest('token', 's1', '/dashboard')).resolves.toEqual({ ok: true })
  })

  it('classifies denied, unavailable and retry', () => {
    expect(classifyTeachingError(new ApiError(403, 'no')).kind).toBe('denied')
    expect(classifyTeachingError(new ApiError(401, 'no')).kind).toBe('denied')
    expect(classifyTeachingError(new ApiError(503, 'down')).kind).toBe('unavailable')
    expect(classifyTeachingError(new TeachingApiError(503, 'down', 'TEACHING_UNAVAILABLE')).kind).toBe('unavailable')
    expect(classifyTeachingError(new ApiError(500, 'x')).kind).toBe('retry')
    expect(classifyTeachingError(new Error('boom')).kind).toBe('retry')
  })
})

describe('dashboard and context schemas (contract 6.1, 6.2)', () => {
  it.each(['default', 'new-teacher', 'draft-ready', 'no-class', 'unpublished', 'insufficient'])('parses the %s fixture', (state) => {
    expect(() => parseTeachingDashboard(dashboardFixture(state))).not.toThrow()
  })

  it('parses the context fixture and keeps AI drafting UNAVAILABLE', () => {
    const context = parseTeachingContext(contextFixture())
    expect(context.features.aiDrafting.draftPlan.status).toBe('UNAVAILABLE')
    expect(context.features.inviteStudents.available).toBe(false)
  })

  it('rejects a payload that misses required fields instead of rendering it', () => {
    expect(teachingDashboardSchema.safeParse({ state: 'ACTIVE' }).success).toBe(false)
    expect(teachingDashboardSchema.safeParse({ ...dashboardFixture('default'), state: 'LIVE' }).success).toBe(false)
  })

  it('rejects deferred cards that claim to be available', () => {
    const bad = { ...dashboardFixture('default'), deferred: { ...dashboardFixture('default').deferred, atRiskAlerts: { available: true, reason: '' } } }
    expect(teachingDashboardSchema.safeParse(bad).success).toBe(false)
  })

  it('derives the assignable plan from the checklist route only when enabled', () => {
    expect(assignablePlanId(dashboardFixture('default'))).toBe('plan-fractions')
    expect(assignablePlanId(dashboardFixture('new-teacher'))).toBeNull()
    expect(assignablePlanId(dashboardFixture('unpublished'))).toBeNull()
  })

  it('points Create lesson at a lesson draft, then a plan, never at nothing invented', () => {
    expect(createLessonTarget(dashboardFixture('draft-ready'))).toBe('/teacher/plans/plan-fractions/topics/topic-add')
    expect(createLessonTarget(dashboardFixture('unpublished'))).toBe('/teacher/plans/plan-algebra')
    expect(createLessonTarget(dashboardFixture('new-teacher'))).toBeNull()
    expect(createLessonTarget(dashboardFixture('no-class'))).toBeNull()
  })
})

describe('onboarding (contract 6.8, F-T8-05, F-T8-06)', () => {
  it('Done copy follows studentVisibility and says live only when ASSIGNED', () => {
    expect(DONE_COPY.NOT_PUBLISHED.title).toBe('Your plan is saved as a draft')
    expect(DONE_COPY.PUBLISHED_NOT_ASSIGNED.title).toBe('Published. Students will see it once you assign it to a class')
    expect(DONE_COPY.ASSIGNED_PENDING_APPROVAL.title).toBe('Assigned. Students appear once their guardians approve')
    expect(DONE_COPY.ASSIGNED.title).toBe('Your plan is live')
    for (const key of ['NOT_PUBLISHED', 'PUBLISHED_NOT_ASSIGNED', 'ASSIGNED_PENDING_APPROVAL'] as const) {
      expect(`${DONE_COPY[key].title} ${DONE_COPY[key].body}`.toLowerCase()).not.toContain('live')
    }
    expect(doneCopy({ firstPlan: null })).toEqual(DONE_COPY.NOT_PUBLISHED)
  })

  it('never shows a step the server has not unlocked and always allows going back', () => {
    expect(resolveViewedStep('MATERIAL', 'invite')).toBe('MATERIAL')
    expect(resolveViewedStep('MATERIAL', 'done')).toBe('MATERIAL')
    expect(resolveViewedStep('MATERIAL', 'profile')).toBe('PROFILE')
    expect(resolveViewedStep('INVITE', 'first_plan')).toBe('FIRST_PLAN')
    expect(resolveViewedStep('INVITE', 'nonsense')).toBe('INVITE')
    expect(resolveViewedStep('DONE', null)).toBe('DONE')
  })

  it('parses every fixture state', () => {
    for (const state of ['profile', 'first-plan', 'first-plan-saved', 'material', 'invite-draft', 'invite', 'done-pending', 'done-live', 'no-class']) {
      expect(() => parseOnboardingState(createOnboardingMock({ state }).store.current)).not.toThrow()
    }
  })

  it('validates the profile like the server does', () => {
    expect(validateProfile({ displayName: ' ', bio: '', subjects: [], grades: [] })).toMatchObject({ displayName: expect.any(String), subjects: expect.any(String), grades: expect.any(String) })
    expect(validateProfile({ displayName: 'D', bio: 'x'.repeat(501), subjects: ['Maths'], grades: [11] })).toMatchObject({ bio: expect.any(String), grades: expect.any(String) })
    expect(validateProfile({ displayName: 'D', bio: '', subjects: ['Maths'], grades: [6] })).toEqual({})
    expect(validateProfile({ displayName: 'D', bio: '', subjects: Array.from({ length: 13 }, (_, i) => `S${i}`), grades: [6] }).subjects).toBeTruthy()
  })

  it('normalises the profile payload', () => {
    expect(draftToPayload({ displayName: ' Daniel ', bio: '  ', subjects: ['Maths', ' Maths ', ''], grades: [7, 6, 6] })).toEqual({
      displayName: 'Daniel', bio: null, subjects: ['Maths'], grades: [6, 7],
    })
  })

  it('enforces the photo mime type and 2 MB limit', () => {
    expect(validatePhoto({ type: 'image/gif', size: 10 })).toBeTruthy()
    expect(validatePhoto({ type: 'image/png', size: 2 * 1024 * 1024 + 1 })).toBeTruthy()
    expect(validatePhoto({ type: 'image/webp', size: 1024 })).toBeNull()
  })

  it('validates material links (https only, no credentials) and file types', () => {
    expect(validateMaterial({ kind: 'LINK', title: 'T', url: 'http://example.org' })).toBeTruthy()
    expect(validateMaterial({ kind: 'LINK', title: 'T', url: 'https://user:pw@example.org' })).toBeTruthy()
    expect(validateMaterial({ kind: 'LINK', title: '', url: 'https://example.org' })).toBeTruthy()
    expect(validateMaterial({ kind: 'LINK', title: 'T', url: 'https://example.org/a' })).toBeNull()
    expect(validateMaterial({ kind: 'FILE', title: 'T', file: { name: 'a.exe', type: 'application/x-msdownload', size: 5 } })).toBeTruthy()
    expect(materialTypeForFile({ name: 'a.PDF', type: '' })).toBe('PDF')
    expect(materialTypeForFile({ name: 'photo.jpg', type: 'image/jpeg' })).toBe('IMAGE')
    expect(validateMaterial({ kind: 'FILE', title: 'T', file: { name: 'p.jpg', type: 'image/jpeg', size: 21 * 1024 * 1024 } })).toBeTruthy()
  })

  it('finds the first topic of the first plan, skipping phases', () => {
    const plan = planForMaterialSchema.parse(planDetailFixture('plan-1', 'DRAFT'))
    expect(firstTopicOf(plan)).toEqual({ planId: 'plan-1', topicId: 'topic-1', title: 'What is a fraction?' })
    expect(firstTopicOf(planForMaterialSchema.parse(planDetailFixture('plan-1', 'DRAFT', { withTopic: false })))).toBeNull()
  })
})
