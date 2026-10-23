import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from './config'
import { FAMILY_CHILD_COOKIE } from './family-cookies'
import { accountFamilyAccess, familyAccessRedirect } from './family-access'
import { schoolRequest, type Workspace } from '@/lib/api/school'
import { familyRequest, FamilyError, type ChildContext } from '@/lib/api/family'

/**
 * Server entry gate for the B07 learner routes (/learn/home, /learn, /learn/plans/*).
 * Mirrors requireMaterialAccess and adds the dashboard group's family-access check.
 * Child presence always wins: an empty or revoked child selection never falls back to an adult account.
 * This is an entry gate only; the product API rechecks school, learner and resource on every request.
 */
export async function requireLearnerAccess(callbackUrl: '/learn/home' | '/learn' = '/learn/home'): Promise<LearnerAccess> {
  const jar = await cookies()
  const child = jar.get(FAMILY_CHILD_COOKIE)
  if (child !== undefined) {
    return verifiedChild(child.value)
  }
  const session = await auth()
  if (!session?.accessToken || !session.user?.id) redirect(`/login?callbackUrl=${callbackUrl}`)
  if (session.user.systemRole === 'SUPER_ADMIN') redirect('/admin/login')
  if (session.user.roles?.includes('TEACHER')) redirect('/teacher/dashboard')
  let status
  try { status = await accountFamilyAccess(session.accessToken) } catch { throw new Error('Your account access could not be checked. Please try again.') }
  const gate = familyAccessRedirect(status)
  // A 14-17 account that picked its school profile on /learner holds a STUDENT workspace cookie; only then may it pass the gate.
  // The check below is live (never the cookie alone): the profile list is the B03 self-service rule and excludes under-14 accounts.
  if (gate && !(gate === '/learner' && await selfServiceProfileSelected(session.accessToken, jar.get('colearner-school-membership')?.value))) redirect(gate)
  if (!session.user.onboardingCompleted) redirect('/onboarding/profile')
  const selected = jar.get('colearner-school-membership')?.value ?? 'unselected'
  return { kind: 'account' as const, scope: `account:${session.user.id}:${selected}` }
}

async function selfServiceProfileSelected(token: string, membershipId: string | undefined): Promise<boolean> {
  if (!membershipId || !/^[a-f0-9-]{36}$/i.test(membershipId)) return false
  try {
    const [workspace, profiles] = await Promise.all([
      schoolRequest<Workspace>(token, `/school-identity/workspaces/${encodeURIComponent(membershipId)}`),
      familyRequest<{ items: { schoolId: string }[] }>(token, '/family/student/profiles'),
    ])
    return workspace.role === 'STUDENT' && workspace.status === 'ACTIVE' && profiles.items.some(item => item.schoolId === workspace.schoolId)
  } catch { return false }
}

type ChildAccess = { kind: 'child'; scope: string; nickname: string; band: 'kids' | 'tweens' | 'teens' }
type AccountAccess = { kind: 'account'; scope: string; nickname?: undefined; band?: undefined }
export type LearnerAccess = ChildAccess | AccountAccess

/** Same verification for every learner route: an empty or revoked child selection is denied, never replaced by an adult session. */
async function verifiedChild(token: string): Promise<ChildAccess> {
  if (!token) redirect('/profiles?denied=1')
  let context: ChildContext
  try { context = await familyRequest<ChildContext>(token, '/family/child') }
  catch (error) { if (error instanceof FamilyError && (error.status === 401 || error.status === 403)) redirect('/profiles?denied=1'); throw new Error('The learning workspace is unavailable. Please try again.') }
  if (!context.profileId || !context.schoolId || !['6-9', '10-13', '14-17'].includes(context.ageBand)) redirect('/profiles?denied=1')
  return { kind: 'child' as const, scope: `child:${context.schoolId}:${context.profileId}`, nickname: context.nickname, band: context.ageBand === '6-9' ? 'kids' as const : context.ageBand === '10-13' ? 'tweens' as const : 'teens' as const }
}

/**
 * Entry gate for /learn/link only. An account-only school student has no eligible profile yet, and the family
 * access check would send exactly that student to /age or /learner, so this gate deliberately does NOT consult
 * /family/access-status and has no onboarding redirect. It still requires a signed-in account (or a verified child)
 * and keeps admins and teachers out. The product API decides what the status endpoint returns.
 */
export async function requireLinkAccess(): Promise<LearnerAccess> {
  const jar = await cookies()
  const child = jar.get(FAMILY_CHILD_COOKIE)
  if (child !== undefined) return verifiedChild(child.value)
  const session = await auth()
  if (!session?.accessToken || !session.user?.id) redirect('/login?callbackUrl=/learn/link')
  if (session.user.systemRole === 'SUPER_ADMIN') redirect('/admin/login')
  if (session.user.roles?.includes('TEACHER')) redirect('/teacher/dashboard')
  const selected = jar.get('colearner-school-membership')?.value ?? 'unselected'
  return { kind: 'account' as const, scope: `account:${session.user.id}:${selected}` }
}
