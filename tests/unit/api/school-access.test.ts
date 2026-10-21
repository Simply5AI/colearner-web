import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  request: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
}))
vi.mock('@/lib/auth/config', () => ({ auth: mocks.auth }))
vi.mock('@/lib/api/school', () => ({ schoolRequest: mocks.request }))
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: mocks.get, set: mocks.set }),
}))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`)
  },
}))
import { requireSchoolWorkspace } from '@/lib/auth/school-access'
import { selectSchoolWorkspace } from '@/app/workspaces/actions'
const membershipId = '00000000-0000-4000-8000-000000000001'
const descriptor = {
  membershipId,
  schoolId: 'school-a',
  organizationId: 'org-a',
  schoolName: 'School A',
  role: 'SCHOOL_ADMIN',
  status: 'ACTIVE',
}
describe('live school workspace boundaries', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.auth.mockResolvedValue({
      accessToken: 'verified-session',
      user: { id: 'user-a' },
    })
    mocks.get.mockReturnValue({ value: membershipId })
    mocks.request.mockResolvedValue(descriptor)
  })
  it('redirects anonymous users before requesting school records', async () => {
    mocks.auth.mockResolvedValue(null)
    await expect(
      requireSchoolWorkspace('school-a', ['SCHOOL_ADMIN']),
    ).rejects.toThrow('redirect:/login')
    expect(mocks.request).not.toHaveBeenCalled()
  })
  it('requires an explicit verified selection', async () => {
    mocks.get.mockReturnValue(undefined)
    await expect(
      requireSchoolWorkspace('school-a', ['SCHOOL_ADMIN']),
    ).rejects.toThrow('redirect:/workspaces')
    expect(mocks.request).not.toHaveBeenCalled()
  })
  it('revalidates selected membership against backend', async () => {
    expect(
      (await requireSchoolWorkspace('school-a', ['SCHOOL_ADMIN'])).workspace,
    ).toEqual(descriptor)
    expect(mocks.request).toHaveBeenCalledWith(
      'verified-session',
      `/school-identity/workspaces/${membershipId}`,
    )
  })
  it('denies another school even if the cookie contains an active admin membership', async () => {
    await expect(
      requireSchoolWorkspace('school-b', ['SCHOOL_ADMIN']),
    ).rejects.toThrow('denied=1')
  })
  it.each(['TEACHER', 'STUDENT', 'PARENT'])(
    'does not elevate %s to school-admin',
    async (role) => {
      mocks.request.mockResolvedValue({ ...descriptor, role })
      await expect(
        requireSchoolWorkspace('school-a', ['SCHOOL_ADMIN']),
      ).rejects.toThrow('denied=1')
    },
  )
  it('does not trust revoked membership preferences', async () => {
    mocks.request.mockResolvedValue({ ...descriptor, status: 'SUSPENDED' })
    await expect(
      requireSchoolWorkspace('school-a', ['SCHOOL_ADMIN']),
    ).rejects.toThrow('denied=1')
  })
  it('does not render data when backend membership verification fails', async () => {
    mocks.request.mockRejectedValue(new Error('Unavailable'))
    await expect(
      requireSchoolWorkspace('school-a', ['SCHOOL_ADMIN']),
    ).rejects.toThrow('Unavailable')
  })
  it('selection verifies server descriptor before setting context cookie', async () => {
    expect(await selectSchoolWorkspace(membershipId)).toEqual({
      href: '/org/school-a/academics',
    })
    expect(mocks.request).toHaveBeenCalledWith(
      'verified-session',
      `/school-identity/workspaces/${membershipId}/selection`,
      'POST',
    )
    expect(mocks.set).toHaveBeenCalledWith(
      'colearner-school-membership',
      membershipId,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
    )
  })
  it('routes teachers to own scoped assignments', async () => {
    mocks.request.mockResolvedValue({ ...descriptor, role: 'TEACHER' })
    expect(await selectSchoolWorkspace(membershipId)).toEqual({
      href: '/org/school-a/classroom',
    })
  })
  it('parent selection cannot manufacture child access', async () => {
    mocks.request.mockResolvedValue({ ...descriptor, role: 'PARENT' })
    expect((await selectSchoolWorkspace(membershipId)).error).toContain(
      'consent',
    )
    expect(mocks.set).not.toHaveBeenCalled()
  })
  it('forged membership and unverified backend errors cannot set cookie', async () => {
    expect((await selectSchoolWorkspace('//evil.test')).error).toBeTruthy()
    expect(mocks.request).not.toHaveBeenCalled()
    mocks.request.mockRejectedValue(new Error('Forbidden'))
    expect((await selectSchoolWorkspace(membershipId)).error).toContain(
      'revoked',
    )
    expect(mocks.set).not.toHaveBeenCalled()
  })
})
