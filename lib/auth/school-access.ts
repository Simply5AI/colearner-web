import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import {
  schoolRequest,
  type Workspace,
  type SchoolRole,
} from '@/lib/api/school'

export async function requireSchoolWorkspace(
  schoolId: string,
  roles: SchoolRole[],
) {
  const session = await auth()
  if (!session?.accessToken || !session.user?.id)
    redirect('/login?callbackUrl=/workspaces')
  // Live backend verification on every server entry. JWT roles and URL IDs do not grant school access.
  const membershipId = (await cookies()).get(
    'colearner-school-membership',
  )?.value
  if (!membershipId) redirect('/workspaces')
  // A cookie left by a different account is refused by the platform; send the person to pick a workspace again.
  let workspace: Workspace
  try {
    workspace = await schoolRequest<Workspace>(
      session.accessToken,
      `/school-identity/workspaces/${encodeURIComponent(membershipId)}`,
    )
  } catch (error) {
    // Only a refusal (wrong account's cookie, membership gone) sends the person back to choose again; an outage still surfaces as one.
    const status = (error as { status?: number } | null)?.status
    if (status === 403 || status === 404) redirect('/workspaces?denied=1')
    throw error
  }
  if (
    workspace.schoolId !== schoolId ||
    workspace.status !== 'ACTIVE' ||
    !roles.includes(workspace.role)
  )
    redirect('/workspaces?denied=1')
  return { workspace, session }
}
