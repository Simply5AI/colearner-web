'use server'
import { auth } from '@/lib/auth/config'
import { cookies } from 'next/headers'
import { schoolRequest, type Workspace } from '@/lib/api/school'
import { familyRequest } from '@/lib/api/family'
import { readTutorEntry } from '@/lib/api/tutor-loop/entry'

export async function selectSchoolWorkspace(
  membershipId: string,
): Promise<{ href?: string; error?: string }> {
  const session = await auth()
  if (!session?.accessToken || !session.user?.id)
    return { error: 'Log in again to select a school.' }
  if (!/^[0-9a-f-]{36}$/i.test(membershipId))
    return { error: 'Select an available school membership.' }
  try {
    const workspace = await schoolRequest<Workspace>(
      session.accessToken,
      `/school-identity/workspaces/${encodeURIComponent(membershipId)}/selection`,
      'POST',
    )
    if (
      workspace.status !== 'ACTIVE' ||
      !['SCHOOL_ADMIN', 'TEACHER'].includes(workspace.role)
    )
      return {
        error:
          'This membership is valid, but its learner or guardian workspace will open after the consent rollout.',
      }
    ;(await cookies()).set(
      'colearner-school-membership',
      workspace.membershipId,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      },
    )
    return {
      href: `/org/${encodeURIComponent(workspace.schoolId)}/${workspace.role === 'SCHOOL_ADMIN' ? 'academics' : 'classroom'}`,
    }
  } catch {
    return {
      error:
        'This membership is unavailable or has been revoked. Refresh your workspaces and try again.',
    }
  }
}

/** Forgets the selected school workspace. Called on sign-in and sign-out so one person's selection never carries to the next account. */
export async function clearWorkspaceSelection(): Promise<void> {
  ;(await cookies()).delete('colearner-school-membership')
}

/**
 * 14-17 self-service learner entry. Selecting a school profile on /learner binds the account's STUDENT membership for that
 * school to the workspace cookie, which the /learn routes forward as X-School-Membership-Id. The platform still rechecks the
 * membership, the learner and the consent on every call; under-14 accounts never appear in /family/student/profiles.
 */
export async function selectLearnerSchool(schoolId: string): Promise<{ href?: string; error?: string }> {
  const session = await auth()
  if (!session?.accessToken || !session.user?.id) return { error: 'Log in again to continue.' }
  if (!/^[0-9a-f-]{36}$/i.test(schoolId)) return { error: 'Choose one of your school profiles.' }
  try {
    const profiles = await familyRequest<{ items: { schoolId: string }[] }>(session.accessToken, '/family/student/profiles')
    if (!profiles.items.some(item => item.schoolId === schoolId)) return { error: 'That school profile is not available to this account.' }
    let cursor = ''
    for (let page = 0; page < 10; page += 1) {
      const list = await schoolRequest<{ items: Workspace[]; nextCursor?: string | null }>(session.accessToken, `/school-identity/workspaces${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`)
      const match = list.items.find(item => item.schoolId === schoolId && item.role === 'STUDENT' && item.status === 'ACTIVE')
      if (match) {
        const workspace = await schoolRequest<Workspace>(session.accessToken, `/school-identity/workspaces/${encodeURIComponent(match.membershipId)}/selection`, 'POST')
        if (workspace.role !== 'STUDENT' || workspace.status !== 'ACTIVE') break
        ;(await cookies()).set('colearner-school-membership', workspace.membershipId, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 })
        const entry = await readTutorEntry({ token: session.accessToken, membership: workspace.membershipId, name: null }, 'school')
        return { href: entry.state === 'ready' ? '/learn/start' : '/learn/home' }
      }
      if (!list.nextCursor) break
      cursor = list.nextCursor
    }
    return { error: 'No active student membership was found for that school.' }
  } catch { return { error: 'We could not open your learning space. Please try again.' } }
}
