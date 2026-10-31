import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { isProfileSession } from './learner-access'
import { auth } from './config'
import { FAMILY_CHILD_COOKIE } from './family-cookies'
import { familyRequest, FamilyError, type ChildContext } from '@/lib/api/family'

/** Child presence always wins; a revoked child selection never falls back to an adult account. */
export async function requireMaterialAccess() {
  const jar = await cookies()
  const child = jar.get(FAMILY_CHILD_COOKIE)
  if (child !== undefined) {
    if (!child.value) redirect('/profiles?denied=1')
    let context: ChildContext
    try { context = await familyRequest<ChildContext>(child.value, '/family/child') }
    catch (error) { if (error instanceof FamilyError && (error.status === 401 || error.status === 403)) redirect('/profiles?denied=1'); throw new Error('The learning workspace is unavailable. Please try again.') }
    if (!context.profileId || !context.schoolId || !['6-9', '10-13', '14-17'].includes(context.ageBand)) redirect('/profiles?denied=1')
    return { kind: 'child' as const, scope: `child:${context.schoolId}:${context.profileId}`, nickname: context.nickname, band: context.ageBand === '6-9' ? 'kids' as const : context.ageBand === '10-13' ? 'tweens' as const : 'teens' as const }
  }
  const session = await auth()
  if (!session?.accessToken || !session.user?.id) redirect('/login?callbackUrl=/learn/library')
  if (session.user.systemRole === 'SUPER_ADMIN') redirect('/admin/login')
  if (session.user.roles?.includes('TEACHER')) redirect('/teacher/dashboard')
  if (!session.user.onboardingCompleted) redirect('/onboarding/profile')
  const selected = jar.get('colearner-school-membership')?.value ?? 'unselected'
  return { kind: 'account' as const, scope: `account:${session.user.id}:${selected}`, profileSession: await isProfileSession(session.accessToken, jar.get('colearner-school-membership')?.value) }
}
