'use server'
import { auth } from '@/lib/auth/config'
import { cookies } from 'next/headers'
import { schoolRequest, type Workspace } from '@/lib/api/school'

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
