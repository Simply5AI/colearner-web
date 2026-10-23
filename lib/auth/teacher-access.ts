import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { schoolRequest, type Workspace } from '@/lib/api/school'

/** The workspace cookie only names a membership. The platform re-authorises every teaching call. */
export async function getTeacherWorkspace(): Promise<Workspace | null> {
  const session = await auth()
  if (!session?.accessToken || !session.user?.id) return null
  const membershipId = (await cookies()).get('colearner-school-membership')?.value
  if (!membershipId) return null
  try {
    const workspace = await schoolRequest<Workspace>(
      session.accessToken,
      `/school-identity/workspaces/${encodeURIComponent(membershipId)}`,
    )
    return workspace.role === 'TEACHER' && workspace.status === 'ACTIVE' ? workspace : null
  } catch {
    return null
  }
}

/** A navigation hint, not a gate. Used by the new B12 pages; legacy-only teacher pages do not call it. */
export async function requireTeacherWorkspace() {
  const session = await auth()
  if (!session?.accessToken || !session.user?.id) redirect('/login?callbackUrl=/workspaces')
  const workspace = await getTeacherWorkspace()
  if (!workspace) redirect('/workspaces?denied=1')
  return { workspace, session }
}
