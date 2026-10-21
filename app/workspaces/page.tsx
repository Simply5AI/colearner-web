import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { WorkspaceEntry } from '@/components/school/workspace-entry'
import { resolvePostLoginPath } from '@/lib/auth/post-login'
export default async function WorkspacesPage() {
  const session = await auth()
  if (!session?.accessToken || !session.user?.id)
    redirect('/login?callbackUrl=/workspaces')
  return <WorkspaceEntry personalHref={resolvePostLoginPath(session)} />
}
