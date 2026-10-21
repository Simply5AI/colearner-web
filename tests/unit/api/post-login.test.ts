// @vitest-environment node
import type { Session } from 'next-auth'
import { describe, expect, it } from 'vitest'
import { resolvePostLoginPath } from '@/lib/auth/post-login'

const session = (user: Partial<Session['user']>): Session => ({ expires: '2099-01-01', user: { id: 'test-user', email: 'test@example.invalid', name: 'Test', ...user } })
const roleCases: [Partial<Session['user']>, string][] = [
  [{ systemRole: 'SUPER_ADMIN' }, '/admin/login'],
  [{ roles: ['TEACHER'] }, '/teacher/dashboard'],
  [{ onboardingCompleted: true }, '/dashboard'],
  [{ onboardingCompleted: false }, '/onboarding/profile'],
]
describe('post-login callback normalization', () => {
  it.each([
    '/dashboard', '/dashboard?tab=practice#today', '/teacher/classes?search=algebra%20lesson',
    '/recall/session?returnTo=%2Fdashboard#question-2', '/settings#//external.example',
  ])('retains an ordinary relative path with its query and fragment', (path) => {
    expect(resolvePostLoginPath(session({ onboardingCompleted: true }), path)).toBe(path)
  })
  it.each([
    '//external.example', '/\\external.example', '/\n/external.example', '/\r/external.example',
    '/\t/external.example', '/\u0000/external.example', '/dashboard\u007f',
    'https://external.example', 'javascript:alert(1)', ' \/dashboard',
    undefined, null, '',
  ])('rejects unsafe or absent callback values and uses the verified role default', (path) => {
    expect(resolvePostLoginPath(session({ onboardingCompleted: true }), path)).toBe('/dashboard')
  })
  it.each(roleCases)('preserves the role default after rejecting a normalized external callback', (user, destination) => {
    expect(resolvePostLoginPath(session({ ...user }), '/\\external.example')).toBe(destination)
  })
  it('keeps unauthenticated onboarding fallback for an invalid callback', () => {
    expect(resolvePostLoginPath(null, '//external.example')).toBe('/onboarding/profile')
  })
})
