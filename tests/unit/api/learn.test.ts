import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bandFromApi, learnApi, learnHomeSchema, learnOverviewSchema, linkHref, overviewQuery, planDetailSchema, safeExternalUrl } from '@/lib/api/learn'
import { LearnApiError, LearnSessionError, learnErrorMessage, learnRequest } from '@/lib/api/learn-request'
import { ApiError } from '@/lib/api/client'
import { fixtureBands, homeFixture, overviewFixture, planFixture, type HomeState, type OverviewState, type PlanState } from '@/components/learn/dev/learn-fixtures'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', mocks.fetch) })
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe('B07 contract schemas', () => {
  it.each(fixtureBands)('accept every %s home, overview and plan state of the contract', band => {
    for (const state of ['default', 'first-time', 'limit-reached'] as HomeState[]) expect(learnHomeSchema.safeParse(homeFixture(band, state)).success).toBe(true)
    for (const state of ['default', 'empty', 'join-code', 'approval-pending', 'unavailable-join'] as OverviewState[]) expect(learnOverviewSchema.safeParse(overviewFixture(band, state)).success).toBe(true)
    for (const state of ['default', 'topic-expanded', 'no-sources', 'locked'] as PlanState[]) expect(planDetailSchema.safeParse(planFixture(band, state).detail).success).toBe(true)
  })
  it('keeps null widgets null and does not invent XP, quest or readiness fields', () => {
    const parsed = learnHomeSchema.parse({ ...homeFixture('tweens'), streak: null, timeBudget: null, examCountdown: null, xp: 340, readiness: 62 })
    expect(parsed.streak).toBeNull()
    expect(parsed).not.toHaveProperty('xp')
    expect(parsed).not.toHaveProperty('readiness')
  })
  it('rejects unknown link routes, bad AI states and out-of-range mastery', () => {
    const home = homeFixture('teens')
    expect(learnHomeSchema.safeParse({ ...home, nextAction: { ...home.nextAction, link: { route: 'EXECUTE', id: 'x' } } }).success).toBe(false)
    expect(learnHomeSchema.safeParse({ ...home, recommendation: { status: 'AVAILABLE', items: [] } }).success).toBe(false)
    expect(learnHomeSchema.safeParse({ ...home, subjectProgress: [{ ...home.subjectProgress[0], masteryPercent: 140 }] }).success).toBe(false)
    expect(learnOverviewSchema.safeParse({ ...overviewFixture('kids'), pendingEnrollments: [{ id: 'e', planTitle: 'P', teacherName: null, status: 'APPROVED', requestedAt: '2026-10-19' }] }).success).toBe(false)
  })
  it('requires the server band on a plan and does not cap a teacher note at title length', () => {
    const { detail } = planFixture('teens')
    expect(planDetailSchema.safeParse(detail).success).toBe(true)
    const { band: _band, ...withoutBand } = detail
    void _band
    expect(planDetailSchema.safeParse(withoutBand).success).toBe(false)
    expect(planDetailSchema.safeParse({ ...detail, band: '18+' }).success).toBe(false)
    const note = 'A long teacher note. '.repeat(400)
    expect(note.length).toBeGreaterThan(2000)
    const parsed = planDetailSchema.parse({ ...detail, plan: { ...detail.plan, teacherNote: note } })
    expect(parsed.plan.teacherNote).toBe(note)
  })
  it('never sends a search longer than the 100 characters the platform accepts', () => {
    const query = new URLSearchParams(overviewQuery({ q: `  ${'x'.repeat(150)}  ` }))
    expect(query.get('q')).toBe('x'.repeat(100))
    expect(new URLSearchParams(overviewQuery({ q: '   ' })).has('q')).toBe(false)
  })
  it('maps API age bands to web bands', () => {
    expect([bandFromApi('6-9'), bandFromApi('10-13'), bandFromApi('14-17')]).toEqual(['kids', 'tweens', 'teens'])
  })
})

describe('server links are only real web routes', () => {
  it('routes plans, library items, import, snap, the B08 lesson start and the B09 practice routes', () => {
    expect(linkHref({ route: 'PLAN', id: 'plan-1' })).toBe('/learn/plans/plan-1')
    expect(linkHref({ route: 'LIBRARY_ITEM', id: 'm-1' })).toBe('/learn/library/m-1')
    expect(linkHref({ route: 'IMPORT', id: null })).toBe('/learn/import')
    expect(linkHref({ route: 'SNAP', id: null })).toBe('/learn/snap')
    expect(linkHref({ route: 'ASSIGNMENT', id: 'item-1', planId: 'plan-9' })).toBe('/learn/plans/plan-9')
    expect(linkHref({ route: 'LESSON', id: 'm-1' })).toBe('/learn/lesson/new?materialId=m-1')
    expect(linkHref({ route: 'LESSON', id: 'm-1', planId: 'plan-9', planItemId: 'item-4' })).toBe('/learn/lesson/new?materialId=m-1&planItemId=item-4')
    expect(linkHref({ route: 'LESSON', id: 'm-1', planItemId: '../x' })).toBe('/learn/lesson/new?materialId=m-1')
    expect(linkHref({ route: 'LESSON', id: null })).toBeNull()
    expect(linkHref({ route: 'HOME', id: null })).toBe('/learn/home')
    expect(linkHref({ route: 'LESSON', id: 'a/b' })).toBeNull()
    expect(linkHref({ route: 'PRACTICE', id: 'p-1', scope: 'SET' })).toBe('/learn/practice/start?scope=SET&id=p-1')
    expect(linkHref({ route: 'PRACTICE', id: null, scope: 'HUB' })).toBe('/learn/practice')
    // A PRACTICE link without a scope and with an id is not guessed at.
    expect(linkHref({ route: 'PRACTICE', id: 'p-1' })).toBeNull()
    expect(linkHref(null)).toBeNull()
  })
  it('refuses ids that could escape the route', () => {
    expect(linkHref({ route: 'PLAN', id: '../admin' })).toBeNull()
    expect(linkHref({ route: 'PLAN', id: 'a/b' })).toBeNull()
    expect(linkHref({ route: 'LIBRARY_ITEM', id: null })).toBeNull()
  })
  it('allows only http(s) addresses for suggested resources', () => {
    expect(safeExternalUrl('https://example.org/a')).toBe('https://example.org/a')
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull()
    expect(safeExternalUrl('data:text/html,hi')).toBeNull()
    expect(safeExternalUrl('not a url')).toBeNull()
    expect(safeExternalUrl(null)).toBeNull()
  })
})

describe('B07 HTTP boundary', () => {
  it('unwraps the data envelope through the same-origin BFF without a bearer', async () => {
    mocks.fetch.mockResolvedValue(reply({ statusCode: 200, data: homeFixture('kids'), timestamp: 'now' }))
    const home = await learnApi.home()
    const [url, request] = mocks.fetch.mock.calls[0]!
    expect(url).toBe('/api/learn/home')
    expect(request.headers).not.toHaveProperty('Authorization')
    expect(request.cache).toBe('no-store')
    expect(home.learner.displayName).toBe('Aarav')
  })
  it('encodes filters, cursor and plan ids', async () => {
    expect(overviewQuery({ q: ' water & soil ', subjectId: 's1', kind: 'ASSIGNED', status: 'ACTIVE' }, 'c1')).toBe('limit=20&q=water+%26+soil&subjectId=s1&kind=ASSIGNED&status=ACTIVE&cursor=c1')
    mocks.fetch.mockResolvedValue(reply({ data: planFixture('teens').detail }))
    await learnApi.plan('plan 1/2')
    expect(mocks.fetch.mock.calls[0]?.[0]).toBe('/api/learn/plans/plan%201%2F2')
  })
  it('posts the trimmed join code as JSON and returns the decision', async () => {
    mocks.fetch.mockResolvedValue(reply({ data: { status: 'PENDING_GUARDIAN_APPROVAL', enrollmentId: 'e1', planId: null } }, 201))
    expect(await learnApi.join('  ABC123  ')).toEqual({ status: 'PENDING_GUARDIAN_APPROVAL', enrollmentId: 'e1', planId: null })
    const [url, request] = mocks.fetch.mock.calls[0]!
    expect(url).toBe('/api/learn/enrollments/join')
    expect(request.method).toBe('POST')
    expect(request.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(request.body)).toEqual({ code: 'ABC123' })
  })
  it.each([
    ['CODE_INVALID', 400, 'did not work'], ['CODE_EXPIRED', 410, 'expired'], ['ALREADY_ENROLLED', 409, 'already'],
  ])('maps %s to a safe learner message and keeps the code', async (code, status, text) => {
    mocks.fetch.mockResolvedValue(reply({ message: 'internal stack detail', code }, status))
    const error = await learnApi.join('X').catch((failure: unknown) => failure)
    expect(error).toBeInstanceOf(LearnApiError)
    expect((error as LearnApiError).code).toBe(code)
    expect((error as LearnApiError).message).toContain(text)
    expect((error as LearnApiError).message).not.toContain('internal')
  })
  it.each([
    [404, 'CODE_INVALID', 'did not work'], [410, 'CODE_EXPIRED', 'expired'], [409, 'ALREADY_ENROLLED', 'already'], [403, 'POLICY_BLOCKED', 'Joining needs current guardian consent.'],
  ])('reads the platform join failure %s %s exactly as the platform filter writes it', async (status, code, text) => {
    // LearnExceptionFilter: { code, message, statusCode } spread from the exception, no envelope.
    mocks.fetch.mockResolvedValue(reply({ code, message: code === 'POLICY_BLOCKED' ? 'Joining needs current guardian consent. Ask your grown-up or your school.' : 'server wording', statusCode: status }, status))
    const error = (await learnApi.join('plan-abc').catch((failure: unknown) => failure)) as LearnApiError
    expect(error).toBeInstanceOf(LearnApiError)
    expect(error.status).toBe(status)
    expect(error.code).toBe(code)
    expect(error.message).toContain(text)
    if (code !== 'POLICY_BLOCKED') expect(error.message).not.toContain('server wording')
  })
  it('reads the platform join success from the {statusCode,data,timestamp} envelope', async () => {
    mocks.fetch.mockResolvedValue(reply({ statusCode: 200, data: { status: 'PENDING_GUARDIAN_APPROVAL', enrollmentId: '0b1d4a50-1111-4222-8333-444455556666', planId: null }, timestamp: '2026-10-19T00:00:00.000Z' }))
    expect(await learnApi.join('PLAN-ABC123')).toEqual({ status: 'PENDING_GUARDIAN_APPROVAL', enrollmentId: '0b1d4a50-1111-4222-8333-444455556666', planId: null })
  })
  it('shows the server reason only for POLICY_BLOCKED and falls back when it is unsafe', () => {
    expect(learnErrorMessage(403, 'POLICY_BLOCKED', { message: 'Your school has paused class codes.' })).toBe('Your school has paused class codes.')
    expect(learnErrorMessage(403, 'POLICY_BLOCKED', { message: 'x'.repeat(500) })).toContain('do not allow')
    expect(learnErrorMessage(500, undefined, { message: 'SQL: select * from users' })).not.toContain('SQL')
  })
  it('explains an unlinked school profile or missing guardian consent in our own words', () => {
    expect(learnErrorMessage(403, 'CHILD_PROFILE_REQUIRED')).toMatch(/profile is not linked/i)
    expect(learnErrorMessage(403, 'CONSENT_REQUIRED')).toMatch(/grown-up/i)
    expect(learnErrorMessage(403, 'AGE_OUT_OF_SCOPE')).not.toMatch(/not permitted by the current school/i)
  })
  it('reads the code from a Nest-style message token', async () => {
    mocks.fetch.mockResolvedValue(reply({ statusCode: 404, message: 'CODE_EXPIRED', error: 'Not Found' }, 404))
    expect(((await learnApi.join('X').catch((failure: unknown) => failure)) as LearnApiError).code).toBe('CODE_EXPIRED')
  })
  it('does not trigger the adult global sign-out on 401 and never replays', async () => {
    mocks.fetch.mockResolvedValue(reply({ message: 'secret private text' }, 401))
    const error = await learnApi.join('X').catch((failure: unknown) => failure)
    expect(error).toBeInstanceOf(LearnSessionError)
    expect(error).not.toBeInstanceOf(ApiError)
    expect((error as Error).message).not.toContain('secret')
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })
  it('turns an unreachable or malformed service into retryable errors', async () => {
    mocks.fetch.mockRejectedValue(new Error('connection string'))
    const down = await learnApi.home().catch((failure: unknown) => failure) as LearnApiError
    expect(down.status).toBe(503)
    expect(down.message).not.toContain('connection')
    mocks.fetch.mockResolvedValue(reply({ data: { nope: true } }))
    expect(((await learnRequest('/home', learnHomeSchema).catch((failure: unknown) => failure)) as LearnApiError).status).toBe(502)
    mocks.fetch.mockResolvedValue(new Response('not json', { status: 200 }))
    expect(((await learnRequest('/home', learnHomeSchema).catch((failure: unknown) => failure)) as LearnApiError).status).toBe(502)
  })
  it('treats 403 and 404 as denied without leaking a server message', async () => {
    mocks.fetch.mockResolvedValue(reply({ message: 'Plan p9 belongs to another learner' }, 404))
    const error = await learnApi.plan('p9').catch((failure: unknown) => failure) as LearnApiError
    expect(error.status).toBe(404)
    expect(error.message).not.toContain('another learner')
  })
})
