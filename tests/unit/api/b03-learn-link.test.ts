import { beforeEach, describe, expect, it, vi } from 'vitest'
import { learnLinkApi, learnerLinkStatusSchema, linkStages, needsLinkHelp } from '@/lib/api/learn-link'
import { LearnApiError, LearnSessionError } from '@/lib/api/learn-request'
import { linkStatusFixture, pendingInvitationFixture } from '@/components/learn/dev/learn-link-fixtures'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', mocks.fetch) })
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe('GET /learn/link-status schema', () => {
  it.each(linkStages)('accepts the %s stage of the contract', stage => {
    const result = learnerLinkStatusSchema.safeParse(linkStatusFixture(stage))
    expect(result.success).toBe(true)
  })
  it('accepts a null school, a null invitation and a pending teen invitation', () => {
    expect(learnerLinkStatusSchema.safeParse({ ...linkStatusFixture('NEEDS_GUARDIAN'), school: null }).success).toBe(true)
    expect(learnerLinkStatusSchema.safeParse(pendingInvitationFixture()).success).toBe(true)
    expect(learnerLinkStatusSchema.safeParse({ ...linkStatusFixture('NEEDS_GUARDIAN_CONSENT'), studentLoginInvitation: { pending: false, expiresAt: null } }).success).toBe(true)
  })
  it('rejects an unknown stage and an unknown waitingOn', () => {
    expect(learnerLinkStatusSchema.safeParse({ ...linkStatusFixture(), stage: 'BYPASS_CONSENT' }).success).toBe(false)
    expect(learnerLinkStatusSchema.safeParse({ ...linkStatusFixture(), stage: 'ready' }).success).toBe(false)
    expect(learnerLinkStatusSchema.safeParse({ ...linkStatusFixture(), waitingOn: 'ADMIN' }).success).toBe(false)
  })
  it('rejects extra sensitive-looking fields anywhere in the response', () => {
    const base = linkStatusFixture('NEEDS_GUARDIAN_CONSENT')
    for (const extra of [{ email: 'parent@example.invalid' }, { guardianEmail: 'p@example.invalid' }, { guardianName: 'Someone' }, { profileId: 'profile-1' }, { userId: 'user-1' }, { evidenceRef: 'ref' }]) {
      expect(learnerLinkStatusSchema.safeParse({ ...base, ...extra }).success, JSON.stringify(extra)).toBe(false)
    }
    expect(learnerLinkStatusSchema.safeParse({ ...base, school: { name: 'Greenfield', id: 'school-1' } }).success).toBe(false)
    expect(learnerLinkStatusSchema.safeParse({ ...base, studentLoginInvitation: { pending: true, expiresAt: null, email: 'student@example.invalid' } }).success).toBe(false)
  })
  it('rejects an inconsistent canLearn and missing fields', () => {
    expect(learnerLinkStatusSchema.safeParse({ ...linkStatusFixture('NEEDS_ROSTER_LINK'), canLearn: true }).success).toBe(false)
    expect(learnerLinkStatusSchema.safeParse({ ...linkStatusFixture('READY'), canLearn: false }).success).toBe(false)
    const { checkedAt: _checkedAt, ...withoutChecked } = linkStatusFixture()
    void _checkedAt
    expect(learnerLinkStatusSchema.safeParse(withoutChecked).success).toBe(false)
  })
})

describe('learnLinkApi.status', () => {
  it('reads the same-origin BFF with GET, no body and no credentials of its own, and unwraps {data}', async () => {
    mocks.fetch.mockResolvedValue(reply({ statusCode: 200, data: linkStatusFixture('PROFILE_NOT_BOUND'), timestamp: 'now' }))
    const status = await learnLinkApi.status()
    expect(status.stage).toBe('PROFILE_NOT_BOUND')
    const [url, init] = mocks.fetch.mock.calls[0]!
    expect(url).toBe('/api/learn/link-status')
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
    expect(init.cache).toBe('no-store')
    expect(init.headers).toEqual({})
  })
  it('treats a response with extra personal fields as unreadable (502)', async () => {
    mocks.fetch.mockResolvedValue(reply({ data: { ...linkStatusFixture(), email: 'x@example.invalid' } }))
    await expect(learnLinkApi.status()).rejects.toMatchObject({ status: 502 })
  })
  it('keeps the denial code and uses a 401 that is not an ApiError, so no adult sign-out can fire', async () => {
    mocks.fetch.mockResolvedValue(reply({ code: 'SCHOOL_REQUIRED' }, 403))
    const denied = await learnLinkApi.status().catch(error => error)
    expect(denied).toBeInstanceOf(LearnApiError)
    expect(denied).toMatchObject({ status: 403, code: 'SCHOOL_REQUIRED' })
    mocks.fetch.mockResolvedValue(reply({ message: 'expired' }, 401))
    const ended = await learnLinkApi.status().catch(error => error)
    expect(ended).toBeInstanceOf(LearnSessionError)
    expect(ended).not.toBeInstanceOf(LearnApiError)
  })
  it('maps an outage to a retryable 503', async () => {
    mocks.fetch.mockRejectedValue(new TypeError('network'))
    await expect(learnLinkApi.status()).rejects.toMatchObject({ status: 503 })
  })
})

describe('needsLinkHelp', () => {
  it('is true only for CHILD_PROFILE_REQUIRED and CONSENT_REQUIRED', () => {
    expect(needsLinkHelp(new LearnApiError(403, 'x', 'CHILD_PROFILE_REQUIRED'))).toBe(true)
    expect(needsLinkHelp(new LearnApiError(403, 'x', 'CONSENT_REQUIRED'))).toBe(true)
    for (const code of ['AGE_OUT_OF_SCOPE', 'SCHOOL_REQUIRED', 'POLICY_BLOCKED', undefined]) expect(needsLinkHelp(new LearnApiError(403, 'x', code))).toBe(false)
    expect(needsLinkHelp(null)).toBe(false)
    expect(needsLinkHelp(new Error('CHILD_PROFILE_REQUIRED'))).toBe(false)
  })
})
