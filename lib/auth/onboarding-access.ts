import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from './config'
import { accountFamilyAccess, familyAccessRedirect } from './family-access'
import { FAMILY_CHILD_COOKIE } from './family-cookies'
import { familyRequest, FamilyError, type ChildContext } from '@/lib/api/family'

export type OnboardingAccess =
  | { kind: 'child'; scope: string; learnerName: string | null; band: 'kids' | 'tweens' | 'teens' }
  | { kind: 'account'; scope: string; learnerName: string | null; band: null }

const firstName = (value: string | null | undefined) => value?.trim().split(/\s+/)[0]?.slice(0, 30) || null

/**
 * Page gate for /onboarding/meet-co. Same precedence as `requireMaterialAccess`:
 * a child cookie always wins and a revoked child never falls back to an adult account.
 * Unlike the material gate it does not send an account to the legacy onboarding
 * (`onboardingCompleted` is the old `User.onboardingStep`; A6 state lives in `LearnerOnboarding`).
 * The server remains the authority for age band, consent and policy.
 */
export async function requireOnboardingAccess(): Promise<OnboardingAccess> {
  const jar = await cookies()
  const child = jar.get(FAMILY_CHILD_COOKIE)
  if (child !== undefined) {
    if (!child.value) redirect('/profiles?denied=1')
    let context: ChildContext
    try { context = await familyRequest<ChildContext>(child.value, '/family/child') }
    catch (error) {
      if (error instanceof FamilyError && (error.status === 401 || error.status === 403)) redirect('/profiles?denied=1')
      throw new Error('The learning workspace is unavailable. Please try again.')
    }
    if (!context.profileId || !context.schoolId || !['6-9', '10-13', '14-17'].includes(context.ageBand)) redirect('/profiles?denied=1')
    return { kind: 'child', scope: `child:${context.schoolId}:${context.profileId}`, learnerName: firstName(context.nickname), band: context.ageBand === '6-9' ? 'kids' : context.ageBand === '10-13' ? 'tweens' : 'teens' }
  }
  const session = await auth()
  if (!session?.accessToken || !session.user?.id) redirect('/login?callbackUrl=/onboarding/meet-co')
  if (session.user.systemRole === 'SUPER_ADMIN') redirect('/admin/login')
  if (session.user.roles?.includes('TEACHER')) redirect('/teacher/dashboard')
  let status
  try { status = await accountFamilyAccess(session.accessToken) }
  catch { throw new Error('Your account access could not be checked. Please try again.') }
  const gate = familyAccessRedirect(status)
  if (gate) redirect(gate)
  const selected = jar.get('colearner-school-membership')?.value ?? 'unselected'
  return { kind: 'account', scope: `account:${session.user.id}:${selected}`, learnerName: firstName(session.user.name), band: null }
}

export type OnboardingCredential =
  | { ok: true; token: string; membership: string | null }
  | { ok: false; status: 401 | 403 }

/** BFF credential: a selected child cookie is the only authority when present. */
export async function onboardingCredential(): Promise<OnboardingCredential> {
  const jar = await cookies()
  const child = jar.get(FAMILY_CHILD_COOKIE)
  if (child !== undefined) return child.value ? { ok: true, token: child.value, membership: null } : { ok: false, status: 401 }
  const session = await auth()
  if (!session?.accessToken || !session.user?.id) return { ok: false, status: 401 }
  const membership = jar.get('colearner-school-membership')?.value
  if (membership && !/^[a-f0-9-]{36}$/i.test(membership)) return { ok: false, status: 403 }
  return { ok: true, token: session.accessToken, membership: membership ?? null }
}
