import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OnboardingError, OnboardingSessionError, examDateToApi, examDateToInput, failureOf, nextRouteHref, onboardingApi, onboardingStateSchema, saveOnboardingSchema } from '@/lib/api/onboarding'
import { onboardingFixture } from '@/components/onboarding/meet-co/fixtures'

const fetchMock = vi.fn()
const fail = (promise: Promise<unknown>) => promise.then(() => { throw new Error('expected a rejection') }, (error: unknown) => error as OnboardingError)
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset() })
afterEach(() => vi.unstubAllGlobals())

describe('A6 unlinked profile', () => {
  it('tells an account-only student their school profile is not linked, as a denied state with our own copy', async () => {
    fetchMock.mockResolvedValue(respond({ statusCode: 403, code: 'CHILD_PROFILE_REQUIRED', message: 'server text must not show' }, 403))
    const error = await fail(onboardingApi.get())
    expect(error).toBeInstanceOf(OnboardingError)
    expect(failureOf(error)).toBe('denied')
    expect(error.message).toMatch(/profile is not linked/i)
    expect(error.message).not.toMatch(/server text/)
  })
})

describe('A6 boundary schemas', () => {
  it('accepts a contract-shaped state for every band and rejects unsupported bands or steps', () => {
    for (const band of ['kids', 'tweens', 'teens'] as const) expect(onboardingStateSchema.safeParse(onboardingFixture({ band })).success).toBe(true)
    expect(onboardingStateSchema.safeParse({ ...onboardingFixture({ band: 'kids' }), band: '18+' }).success).toBe(false)
    expect(onboardingStateSchema.safeParse({ ...onboardingFixture({ band: 'kids' }), step: 'ADULT_GOAL' }).success).toBe(false)
  })
  it('limits contexts to SCHOOL and boards to CBSE/ICSE (adult and research contexts are deferred)', () => {
    const state = onboardingFixture({ band: 'teens' })
    expect(onboardingStateSchema.safeParse({ ...state, draft: { ...state.draft, contexts: ['RESEARCH'] } }).success).toBe(false)
    expect(onboardingStateSchema.safeParse({ ...state, draft: { ...state.draft, board: 'IB' } }).success).toBe(false)
    expect(onboardingStateSchema.safeParse({ ...state, draft: { ...state.draft, grade: 11 } }).success).toBe(false)
  })
  it('keeps a truthful goal-suggestion union', () => {
    const state = onboardingFixture({ band: 'teens', scenario: 'suggestions' })
    expect(state.goalSuggestions.status).toBe('AVAILABLE')
    expect(onboardingStateSchema.safeParse(state).success).toBe(true)
    expect(onboardingStateSchema.safeParse({ ...state, goalSuggestions: { status: 'AVAILABLE', items: [] } }).success).toBe(false)
    expect(onboardingStateSchema.safeParse({ ...state, goalSuggestions: { status: 'UNAVAILABLE' } }).success).toBe(false)
  })
  it('validates outbound saves strictly, to what the platform accepts', () => {
    const subject = '00000000-0000-4000-8000-000000000001'
    expect(saveOnboardingSchema.safeParse({ step: 'SUBJECTS', draft: { subjectIds: [subject], customSubjects: ['Robotics club'], examDate: '2027-03-01' } }).success).toBe(true)
    const five = ['One', 'Two', 'Three', 'Four', 'Five']
    expect(saveOnboardingSchema.safeParse({ step: 'SUBJECTS', draft: { customSubjects: five } }).success).toBe(true)
    const tooMany = Array.from({ length: 21 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`)
    for (const draft of [{ coNickname: '<script>' }, { customSubjects: ['x'] }, { examDate: '2027-03-01T00:00:00.000Z' }, { examDate: '01/03/2027' }, { coTheme: 'neon' }, { contexts: ['UNIVERSITY'] }, { unknown: 1 }, { goal: 'x'.repeat(141) },
      { customSubjects: [...five, 'Six'] }, { customSubjects: ['C++'] }, { subjectIds: ['not-a-uuid'] }, { subjectIds: tooMany }]) {
      expect(saveOnboardingSchema.safeParse({ step: 'SUBJECTS', draft }).success, JSON.stringify(draft).slice(0, 60)).toBe(false)
    }
    expect(saveOnboardingSchema.safeParse({ step: 'DONE', draft: {} }).success).toBe(false)
  })
  it('keeps exam dates as calendar dates both ways (the platform stores YYYY-MM-DD)', () => {
    expect(examDateToApi('2027-03-01')).toBe('2027-03-01')
    expect(examDateToApi('')).toBeNull()
    expect(examDateToApi('2027-03-01T00:00:00.000Z')).toBeNull()
    expect(examDateToInput('2027-03-01')).toBe('2027-03-01')
    expect(examDateToInput('2027-03-01T00:00:00.000Z')).toBe('2027-03-01')
    expect(nextRouteHref('IMPORT')).toBe('/learn/import')
    expect(nextRouteHref('HOME')).toBe('/learn/home')
  })
})

describe('A6 client over the same-origin boundary', () => {
  it('unwraps the data envelope and validates the state', async () => {
    const state = onboardingFixture({ band: 'tweens' })
    fetchMock.mockResolvedValue(respond({ statusCode: 200, data: state }))
    expect(await onboardingApi.get()).toEqual(state)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/onboarding')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', cache: 'no-store' })
  })
  it('sends merge saves as PUT JSON, completes and skips by POST', async () => {
    fetchMock.mockImplementation(async () => respond({ data: { nextRoute: 'IMPORT' } }))
    await onboardingApi.save({ step: 'PERSONALISE', draft: { coTheme: 'ocean', coNickname: 'Kiki' } })
    expect(fetchMock.mock.calls[0]).toEqual(['/api/onboarding', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ step: 'PERSONALISE', draft: { coTheme: 'ocean', coNickname: 'Kiki' } }) })])
    expect(await onboardingApi.complete()).toEqual({ nextRoute: 'IMPORT' })
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/onboarding/complete')
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'POST', body: '{}' })
    await onboardingApi.complete('LATER')
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: 'POST', body: JSON.stringify({ firstImport: 'LATER' }) })
    fetchMock.mockImplementation(async () => new Response(null, { status: 204 }))
    await onboardingApi.skip()
    expect(fetchMock.mock.calls[3]?.[0]).toBe('/api/onboarding/skip')
  })
  it('refuses to send an invalid draft at all', async () => {
    await expect(onboardingApi.save({ step: 'PERSONALISE', draft: { coNickname: '<b>x</b>' } })).rejects.toBeInstanceOf(OnboardingError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('maps failures to safe states without leaking server text', async () => {
    fetchMock.mockResolvedValue(respond({ code: 'SKIP_NOT_ALLOWED', message: 'internal detail' }, 400))
    const skip = await fail(onboardingApi.skip())
    expect(skip).toBeInstanceOf(OnboardingError); expect(failureOf(skip)).toBe('skip-not-allowed'); expect(skip.message).not.toContain('internal detail')
    fetchMock.mockResolvedValue(respond({ message: 'revoked' }, 401))
    const session = await fail(onboardingApi.get())
    expect(session).toBeInstanceOf(OnboardingSessionError); expect(session).not.toBeInstanceOf(OnboardingError); expect(failureOf(session)).toBe('session')
    fetchMock.mockResolvedValue(respond({ message: 'no' }, 403)); expect(failureOf(await fail(onboardingApi.get()))).toBe('denied')
    fetchMock.mockResolvedValue(respond({ message: 'no' }, 404)); expect(failureOf(await fail(onboardingApi.get()))).toBe('denied')
    fetchMock.mockResolvedValue(respond({ message: 'db password' }, 500))
    const unavailable = await fail(onboardingApi.get())
    expect(failureOf(unavailable)).toBe('unavailable'); expect(unavailable.message).not.toContain('db password')
    fetchMock.mockRejectedValue(new TypeError('network'))
    expect(failureOf(await fail(onboardingApi.get()))).toBe('unavailable')
  })
  it('maps the platform error codes to our own copy, including SKIP_NOT_ALLOWED as a 403', async () => {
    fetchMock.mockResolvedValue(respond({ statusCode: 403, code: 'SKIP_NOT_ALLOWED', message: 'Onboarding cannot be skipped for this age band' }, 403))
    const skip = await fail(onboardingApi.skip())
    expect(failureOf(skip)).toBe('skip-not-allowed'); expect(skip.message).not.toContain('Onboarding cannot be skipped')
    const cases: [string, number, string][] = [['VOICE_NOT_PERMITTED', 400, 'Voice is turned off'], ['EXAM_DATE_OUT_OF_RANGE', 400, 'three years'], ['UNKNOWN_SUBJECT', 400, 'not available any more'], ['FIELD_LOCKED', 400, 'set by your school'], ['ALREADY_COMPLETED', 409, 'already finished'], ['ONBOARDING_INCOMPLETE', 409, 'Finish the setup steps']]
    for (const [code, status, text] of cases) {
      fetchMock.mockResolvedValue(respond({ statusCode: status, code, message: 'server wording' }, status))
      const error = await fail(onboardingApi.save({ step: 'PERSONALISE', draft: {} }))
      expect(error.code, code).toBe(code); expect(error.message, code).toContain(text); expect(error.message).not.toContain('server wording')
    }
    fetchMock.mockResolvedValue(respond({ statusCode: 409, code: 'CONFLICT', message: 'Please try again' }, 409))
    expect(failureOf(await fail(onboardingApi.save({ step: 'PERSONALISE', draft: {} })))).toBe('conflict')
  })
  it('accepts the platform state with its extra lockedFields', async () => {
    const state = { ...onboardingFixture({ band: 'kids' }), lockedFields: ['board', 'grade'] }
    expect(onboardingStateSchema.safeParse(state).success).toBe(true)
    fetchMock.mockResolvedValue(respond({ statusCode: 200, data: state, timestamp: '2026-10-19T00:00:00.000Z' }))
    await expect(onboardingApi.save({ step: 'HELLO', draft: {} })).resolves.toBeDefined()
  })
  it('rejects an unreadable success body as unavailable', async () => {
    fetchMock.mockResolvedValue(respond({ data: { band: 'adult' } }))
    const error = await fail(onboardingApi.get())
    expect(error).toBeInstanceOf(OnboardingError); expect(error.status).toBe(502)
  })
})
